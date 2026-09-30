import type { Contexto, ResultadoIntegracao } from "./tipos";
import { fmtData } from "@/lib/formato";

/**
 * RF-60 — WhatsApp Cloud API (mesma API de apps-script/whatsapp.gs).
 * Sandbox não entrega a números não verificados (README); sem chip dedicado o worker
 * registra o erro e o e-mail/push assume como contingência (premissa 4 do escopo).
 */
async function enviarTexto(para: string, texto: string): Promise<{ ok: boolean; erro?: string; id?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, erro: "WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados" };
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto } }),
  });
  const j = (await r.json()) as { messages?: { id: string }[]; error?: { message: string; code: number } };
  if (!r.ok) return { ok: false, erro: `WhatsApp ${r.status} ${j.error?.code ?? ""}: ${j.error?.message ?? "erro"}` };
  return { ok: true, id: j.messages?.[0]?.id };
}

export function montarMensagens(ctx: Contexto, evento: string): { para: string; texto: string; destinatario: string }[] {
  const j = ctx.job;
  const linkJob = `${ctx.urlApp}/jobs/${j.id}`;
  const linkCampo = `${ctx.urlApp}/campo/jobs/${j.id}`;
  const quando = `${fmtData(j.data, "dd/MM")} ${j.slot === "manha" ? "08:00" : "13:00"}`;
  const msgs: { para: string; texto: string; destinatario: string }[] = [];

  if (evento === "novo_job") {
    if (j.analista_whatsapp) {
      msgs.push({
        destinatario: "analista",
        para: j.analista_whatsapp,
        texto: [
          "📋 *Fast Mídia — Novo Job Agendado*", "",
          `📅 Data: ${quando}`, `🎯 Cliente: ${j.cliente?.nome ?? ""}`, `📸 Fast: ${j.fast?.nome ?? ""}`, "",
          "👉 *Preenche o briefing agora:*", linkJob, "",
          j.pasta_ingest_url ? `📁 Pasta de ingest:\n${j.pasta_ingest_url}` : "⚠️ Pasta de ingest ainda não criada — aguarda aviso da supervisora.",
        ].join("\n"),
      });
    }
    if (j.fast?.telefone) {
      msgs.push({
        destinatario: "fast",
        para: j.fast.telefone,
        texto: [
          "📸 *Novo job confirmado!*", "",
          `📅 Data: ${quando}`, `🎯 Cliente: ${j.cliente?.nome ?? ""}`, "",
          `📱 Job no app (briefing, check-in, comprovantes):\n${linkCampo}`, "",
          j.pasta_ingest_url ? `📁 *Sobe o material aqui:*\n${j.pasta_ingest_url}` : "⚠️ Pasta de ingest ainda não criada — aguarda confirmação.", "",
          `⏰ Prazo para entrega do material: ${j.prazo_material ? fmtData(j.prazo_material) : "—"}`,
          j.data_edicao ? `✂️ Edição agendada: ${fmtData(j.data_edicao)} (${j.bloco_edicao === "manha" ? "manhã" : "tarde"})` : "",
        ].filter(Boolean).join("\n"),
      });
    }
  } else if (evento === "cancelado") {
    for (const [dest, para] of [["fast", j.fast?.telefone], ["analista", j.analista_whatsapp]] as const) {
      if (para) msgs.push({ destinatario: dest, para, texto: `❌ *Job cancelado* — ${j.cliente?.nome ?? ""} em ${quando}.` });
    }
  } else if (evento === "reagendado") {
    for (const [dest, para] of [["fast", j.fast?.telefone], ["analista", j.analista_whatsapp]] as const) {
      if (para) msgs.push({ destinatario: dest, para, texto: `🔁 *Job reagendado* — ${j.cliente?.nome ?? ""} agora em ${quando} com ${j.fast?.nome ?? ""}.\n${dest === "fast" ? linkCampo : linkJob}` });
    }
  }
  return msgs;
}

export async function enviarWhatsapp(ctx: Contexto, evento: string): Promise<ResultadoIntegracao> {
  const msgs = montarMensagens(ctx, evento);
  if (msgs.length === 0) return { ok: true, resultado: { enviados: 0 } };
  const resultados: Record<string, unknown> = {};
  const erros: string[] = [];
  for (const m of msgs) {
    const r = await enviarTexto(m.para, m.texto);
    resultados[m.destinatario] = r;
    if (!r.ok) erros.push(`${m.destinatario}: ${r.erro}`);
  }
  if (erros.length) return { ok: false, erro: erros.join(" | ") };
  return { ok: true, resultado: resultados };
}
