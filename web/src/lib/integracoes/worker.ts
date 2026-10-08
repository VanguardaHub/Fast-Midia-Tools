import type { Contexto, ItemFila, JobCompleto, ResultadoIntegracao } from "./tipos";
import { espelharNotion } from "./notion";
import { enviarWhatsapp } from "./whatsapp";
import { enviarEmail } from "./email";
import { chamarAppsScript } from "./apps-script";
import { calendarDelete, calendarUpsert, googleCalendarConfigurado } from "./google-calendar";
import { clienteAdmin } from "@/lib/supabase/admin";
import { driveVerificar, googleDriveConfigurado } from "./google-drive";

/**
 * RNF-08 — worker da outbox: idempotente (chave única), com fila e nova tentativa (backoff exponencial).
 * Executa com service_role; nunca exposto ao cliente. Disparado pelo cron do Vercel (vercel.json).
 */

async function carregarJob(admin: ReturnType<typeof clienteAdmin>, jobId: string): Promise<JobCompleto | null> {
  const { data } = await admin
    .from("job")
    .select("id, codigo, data, slot, inicio, fim, status, precisa_99, prazo_material, data_edicao, bloco_edicao, observacoes, pasta_ingest_url, notion_page_id, calendar_event_id, calendar_event_edicao_id, analista_whatsapp, endereco, cliente:cliente_id(nome, pasta_drive_id, grupo), fast:fast_id(nome, email_calendario, telefone, nome_notion), briefing(local, roteiro, observacoes, precisa_99)")
    .eq("id", jobId)
    .maybeSingle();
  return (data as unknown as JobCompleto | null) ?? null;
}

async function executar(item: ItemFila, ctx: Contexto): Promise<ResultadoIntegracao> {
  const payload = item.payload as { evento?: string };
  switch (item.tipo) {
    case "notion_upsert": return espelharNotion(ctx);
    case "whatsapp_send": {
      // Novo job: a mensagem leva o link da pasta de ingest; se o Drive está integrado e a pasta ainda não
      // existe, adia até 3 tentativas (backoff da fila) para não mandar "pasta ainda não criada" à toa.
      const evento = payload.evento ?? "novo_job";
      const driveIntegrado = (await googleDriveConfigurado()) || Boolean(process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_TOKEN);
      if (evento === "novo_job" && driveIntegrado && ctx.job.cliente?.pasta_drive_id && !ctx.job.pasta_ingest_url && item.tentativas < 3) {
        return { ok: false, erro: "aguardando a pasta de ingest (drive_verificar) para enviar o WhatsApp com o link" };
      }
      return enviarWhatsapp(ctx, evento);
    }
    case "email_send": return enviarEmail(ctx, payload.evento ?? "aviso");
    // Calendar: API oficial com conta de serviço (ADR-0006) quando configurada; senão, Apps Script (decisão 7.1)
    case "calendar_upsert": return (await googleCalendarConfigurado()) ? calendarUpsert(ctx) : chamarAppsScript(ctx, "calendar_upsert");
    case "calendar_delete": return (await googleCalendarConfigurado()) ? calendarDelete(ctx) : chamarAppsScript(ctx, "calendar_delete");
    // Drive: API oficial com a conta de serviço quando configurada; senão, Apps Script (decisão 7.1)
    case "drive_verificar": return (await googleDriveConfigurado()) ? driveVerificar(ctx) : chamarAppsScript(ctx, "drive_verificar");
    case "push_send": return { ok: true, resultado: { ignorado: "push não implementado nesta fase" } };
    default: return { ok: false, erro: `tipo desconhecido ${item.tipo}`, descartar: true };
  }
}

export async function processarFila(limite = 20): Promise<{ processados: number; ok: number; erros: number; detalhes: string[] }> {
  const admin = clienteAdmin();
  const urlApp = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  const { data: itens } = await admin
    .from("fila_integracao")
    .select("*")
    .in("status", ["pendente", "erro"])
    .lte("proximo_em", new Date().toISOString())
    .order("criado_em")
    .limit(limite);

  const detalhes: string[] = [];
  let ok = 0, erros = 0;
  for (const item of itens ?? []) {
    // Claim otimista: só processa se ainda estiver pendente/erro
    const { data: claimed } = await admin
      .from("fila_integracao")
      .update({ status: "processando", tentativas: item.tentativas + 1 })
      .eq("id", item.id)
      .in("status", ["pendente", "erro"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const jobId = (item.payload as { job_id?: string }).job_id;
    const job = jobId ? await carregarJob(admin, jobId) : null;
    let resultado: ResultadoIntegracao;
    if (!job) resultado = { ok: false, erro: "job não encontrado", descartar: true };
    else {
      try { resultado = await executar(item, { job, urlApp }); }
      catch (e) { resultado = { ok: false, erro: (e as Error).message }; }
    }

    if (resultado.ok) {
      ok++;
      await admin.from("fila_integracao").update({ status: "ok", resultado: (resultado.resultado ?? {}) as never, ultimo_erro: null }).eq("id", item.id);
      if (resultado.patchJob && jobId) await admin.from("job").update(resultado.patchJob as never).eq("id", jobId);
      detalhes.push(`ok ${item.tipo} ${item.chave_idempotencia}`);
    } else {
      erros++;
      const esgotou = item.tentativas + 1 >= item.max_tentativas || resultado.descartar;
      const backoffMin = Math.min(2 ** (item.tentativas + 1), 120);
      await admin.from("fila_integracao").update({
        status: esgotou ? "descartado" : "erro",
        ultimo_erro: resultado.erro.slice(0, 500),
        proximo_em: new Date(Date.now() + backoffMin * 60000).toISOString(),
      }).eq("id", item.id);
      detalhes.push(`erro ${item.tipo} ${item.chave_idempotencia}: ${resultado.erro}`);
    }
  }
  return { processados: itens?.length ?? 0, ok, erros, detalhes };
}
