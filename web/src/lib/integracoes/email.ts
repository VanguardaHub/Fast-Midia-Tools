import type { Contexto, ResultadoIntegracao } from "./tipos";
import { fmtData } from "@/lib/formato";

/**
 * Contingência de notificação (premissa 4 / RNF-07) e aviso de briefing recebido
 * (briefing.gs → emailFallback). Usa Resend; sem chave, registra pendência.
 */
export async function enviarEmail(ctx: Contexto, evento: string): Promise<ResultadoIntegracao> {
  const chave = process.env.RESEND_API_KEY;
  const para = process.env.EMAIL_SUPERVISORA;
  const de = process.env.EMAIL_REMETENTE ?? "Fast Mídia Tools <no-reply@vanguardamartech.com.br>";
  if (!chave || !para) return { ok: false, erro: "RESEND_API_KEY/EMAIL_SUPERVISORA não configurados" };
  const j = ctx.job;
  const assunto = evento === "briefing_recebido"
    ? `[Fast Mídia] Briefing recebido — ${j.cliente?.nome ?? ""} (${j.fast?.nome ?? ""})`
    : `[Fast Mídia] ${evento} — ${j.cliente?.nome ?? ""}`;
  const corpo = [
    `Job #${j.codigo} · ${fmtData(j.data)} · ${j.slot === "manha" ? "manhã" : "tarde"}`,
    `Cliente: ${j.cliente?.nome ?? ""}`, `Fast: ${j.fast?.nome ?? ""}`,
    j.briefing ? `Local: ${j.briefing.local}\nPrecisa de 99: ${j.briefing.precisa_99 ? "SIM" : "Não"}\n\nRoteiro:\n${j.briefing.roteiro}` : "",
    "", `Ver no app: ${ctx.urlApp}/jobs/${j.id}`,
  ].join("\n");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: de, to: [para], subject: assunto, text: corpo }),
  });
  if (!r.ok) return { ok: false, erro: `Resend ${r.status}: ${await r.text()}` };
  return { ok: true, resultado: (await r.json()) as Record<string, unknown> };
}
