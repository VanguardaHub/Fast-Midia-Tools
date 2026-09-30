import type { Contexto, ResultadoIntegracao } from "./tipos";

/**
 * RF-16 / RF-62 — Apps Script como serviço interno de Calendar e Drive (decisão 7.1 do escopo).
 * Contrato do endpoint (a implementar na branch da Fase 0, com token e access DOMAIN):
 *   POST { token, acao: 'calendar_upsert' | 'calendar_delete' | 'drive_verificar', job: {...} }
 *   → { ok, calendar_event_id?, calendar_event_edicao_id?, pasta_ingest_url?, status? }
 */
export async function chamarAppsScript(ctx: Contexto, acao: "calendar_upsert" | "calendar_delete" | "drive_verificar"): Promise<ResultadoIntegracao> {
  const url = process.env.APPS_SCRIPT_URL;
  const token = process.env.APPS_SCRIPT_TOKEN;
  if (!url || !token) return { ok: false, erro: "APPS_SCRIPT_URL/APPS_SCRIPT_TOKEN não configurados" };
  const j = ctx.job;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token, acao,
      job: {
        id: j.id, codigo: j.codigo, cliente: j.cliente?.nome, cliente_pasta_id: j.cliente?.pasta_drive_id, cliente_grupo: j.cliente?.grupo,
        fast_email: j.fast?.email_calendario, fast_nome: j.fast?.nome, data: j.data, slot: j.slot, inicio: j.inicio, fim: j.fim,
        data_edicao: j.data_edicao, bloco_edicao: j.bloco_edicao, calendar_event_id: j.calendar_event_id, calendar_event_edicao_id: j.calendar_event_edicao_id,
        link_app: `${ctx.urlApp}/jobs/${j.id}`,
      },
    }),
    redirect: "follow",
  });
  const texto = await r.text();
  let body: { ok?: boolean; erro?: string; calendar_event_id?: string; calendar_event_edicao_id?: string; pasta_ingest_url?: string } = {};
  try { body = JSON.parse(texto); } catch { return { ok: false, erro: `Apps Script resposta inválida: ${texto.slice(0, 200)}` }; }
  if (!r.ok || body.ok === false) return { ok: false, erro: body.erro ?? `Apps Script ${r.status}` };
  const patch: Record<string, string | null> = {};
  if (body.calendar_event_id !== undefined) patch.calendar_event_id = body.calendar_event_id;
  if (body.calendar_event_edicao_id !== undefined) patch.calendar_event_edicao_id = body.calendar_event_edicao_id;
  if (body.pasta_ingest_url !== undefined) patch.pasta_ingest_url = body.pasta_ingest_url;
  if (acao === "calendar_delete") { patch.calendar_event_id = null; patch.calendar_event_edicao_id = null; }
  return { ok: true, resultado: body as Record<string, unknown>, patchJob: Object.keys(patch).length ? patch : undefined };
}
