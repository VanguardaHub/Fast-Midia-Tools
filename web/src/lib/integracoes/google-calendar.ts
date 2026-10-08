import type { Contexto, ResultadoIntegracao } from "./tipos";
import { ESCOPO_CALENDAR, googleConfigurado, obterTokenGoogle, origemGoogle } from "./google-auth";

/**
 * RF-62 — espelho opcional do job no Google Calendar (ADR-0006, revisões de 08/10/2026).
 * Com conta Google conectada por OAuth (padrão): o evento é criado no calendário dessa conta
 * (ou em GOOGLE_CALENDAR_ID) com o Fast como convidado — ele recebe o convite no calendário dele.
 * Com conta de serviço: impersona o Fast (delegação) ou usa o calendário compartilhado.
 * Não lê nada do calendário dos Fasts. Idempotência por `extendedProperties.private.fmt_chave`.
 */

const API = "https://www.googleapis.com/calendar/v3";

export async function googleCalendarConfigurado(): Promise<boolean> {
  return googleConfigurado();
}

async function gapi<T>(token: string, caminho: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const r = await fetch(`${API}${caminho}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const texto = await r.text();
  let body: T = {} as T;
  try { body = texto ? (JSON.parse(texto) as T) : ({} as T); } catch { /* corpo vazio */ }
  return { status: r.status, body };
}

interface Alvo { token: string; calendarId: string; convidado?: string }

async function alvoDoFast(email: string): Promise<Alvo> {
  const origem = await origemGoogle();
  if (origem === "oauth" || process.env.GOOGLE_CALENDAR_ID) {
    return { token: await obterTokenGoogle(ESCOPO_CALENDAR), calendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary", convidado: email };
  }
  return { token: await obterTokenGoogle(ESCOPO_CALENDAR, email), calendarId: "primary" };
}

type Evento = {
  summary: string; description?: string; location?: string;
  start: { dateTime: string; timeZone?: string } | { date: string };
  end: { dateTime: string; timeZone?: string } | { date: string };
  extendedProperties: { private: Record<string, string> };
  attendees?: { email: string }[];
  colorId?: string;
  reminders?: { useDefault: boolean };
};

async function upsertEvento(alvo: Alvo, idAtual: string | null, evento: Evento): Promise<string> {
  const corpo = { ...evento, ...(alvo.convidado ? { attendees: [{ email: alvo.convidado }] } : {}) };
  const cal = encodeURIComponent(alvo.calendarId);
  if (idAtual) {
    const r = await gapi<{ id?: string; error?: { message?: string } }>(alvo.token, `/calendars/${cal}/events/${encodeURIComponent(idAtual)}?sendUpdates=${alvo.convidado ? "all" : "none"}`, { method: "PATCH", body: JSON.stringify(corpo) });
    if (r.status < 300 && r.body.id) return r.body.id;
    if (r.status !== 404 && r.status !== 410) throw new Error(`Calendar PATCH ${r.status}: ${r.body.error?.message ?? ""}`);
  }
  const busca = await gapi<{ items?: { id: string }[] }>(alvo.token, `/calendars/${cal}/events?privateExtendedProperty=${encodeURIComponent(`fmt_chave=${evento.extendedProperties.private.fmt_chave}`)}&maxResults=1`);
  const existente = busca.body.items?.[0]?.id;
  if (existente) {
    const r = await gapi<{ id?: string }>(alvo.token, `/calendars/${cal}/events/${encodeURIComponent(existente)}`, { method: "PATCH", body: JSON.stringify(corpo) });
    if (r.status < 300 && r.body.id) return r.body.id;
  }
  const r = await gapi<{ id?: string; error?: { message?: string } }>(alvo.token, `/calendars/${cal}/events?sendUpdates=${alvo.convidado ? "all" : "none"}`, { method: "POST", body: JSON.stringify(corpo) });
  if (r.status >= 300 || !r.body.id) throw new Error(`Calendar POST ${r.status}: ${r.body.error?.message ?? ""}`);
  return r.body.id;
}

async function excluirEvento(alvo: Alvo, id: string): Promise<void> {
  const r = await gapi<{ error?: { message?: string } }>(alvo.token, `/calendars/${encodeURIComponent(alvo.calendarId)}/events/${encodeURIComponent(id)}?sendUpdates=${alvo.convidado ? "all" : "none"}`, { method: "DELETE" });
  if (r.status >= 300 && r.status !== 404 && r.status !== 410) throw new Error(`Calendar DELETE ${r.status}: ${r.body.error?.message ?? ""}`);
}

function fuso(): string {
  return process.env.FMT_TIMEZONE ?? "America/Manaus";
}

/** RF-62 — cria/atualiza o evento do job (e o da edição, quando houver). */
export async function calendarUpsert(ctx: Contexto): Promise<ResultadoIntegracao> {
  const j = ctx.job;
  if (!j.fast?.email_calendario) return { ok: false, erro: "job sem e-mail de calendário do Fast", descartar: true };
  const alvo = await alvoDoFast(j.fast.email_calendario);
  const link = `${ctx.urlApp}/jobs/${j.id}`;
  const descricao = [
    `Job #${j.codigo} · ${j.cliente?.nome ?? ""}`,
    j.briefing ? `Local: ${j.briefing.local}` : "Briefing pendente",
    j.briefing?.roteiro ? `Roteiro: ${j.briefing.roteiro}` : null,
    j.precisa_99 ? "Precisa de 99 (guardar comprovantes de ida e volta)" : null,
    j.prazo_material ? `Prazo do material bruto: ${j.prazo_material}` : null,
    j.pasta_ingest_url ? `Pasta de ingest: ${j.pasta_ingest_url}` : null,
    `Abrir no app: ${link}`,
  ].filter(Boolean).join("\n");

  const idJob = await upsertEvento(alvo, j.calendar_event_id, {
    summary: `🎬 Gravação · ${j.cliente?.nome ?? "cliente"} (Job #${j.codigo})`,
    description: descricao,
    location: j.briefing?.local ?? j.endereco ?? undefined,
    start: { dateTime: j.inicio, timeZone: fuso() },
    end: { dateTime: j.fim, timeZone: fuso() },
    extendedProperties: { private: { fmt_job_id: j.id, fmt_chave: `job:${j.id}` } },
    colorId: "9",
    reminders: { useDefault: true },
  });

  let idEdicao: string | null = j.calendar_event_edicao_id;
  if (j.data_edicao) {
    const fimExclusivo = new Date(Date.parse(`${j.data_edicao}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    idEdicao = await upsertEvento(alvo, j.calendar_event_edicao_id, {
      summary: `✂️ Edição · ${j.cliente?.nome ?? "cliente"} (Job #${j.codigo})${j.bloco_edicao ? ` · ${j.bloco_edicao === "manha" ? "manhã" : "tarde"}` : ""}`,
      description: `Bloco de edição do job #${j.codigo}.\nAbrir no app: ${link}`,
      start: { date: j.data_edicao },
      end: { date: fimExclusivo },
      extendedProperties: { private: { fmt_job_id: j.id, fmt_chave: `edicao:${j.id}` } },
      colorId: "7",
      reminders: { useDefault: false },
    });
  } else if (j.calendar_event_edicao_id) {
    await excluirEvento(alvo, j.calendar_event_edicao_id);
    idEdicao = null;
  }

  return { ok: true, resultado: { calendar_event_id: idJob, calendar_event_edicao_id: idEdicao, calendario: alvo.calendarId, origem: await origemGoogle() }, patchJob: { calendar_event_id: idJob, calendar_event_edicao_id: idEdicao } };
}

/** RF-62 — remove os eventos do job (cancelamento). */
export async function calendarDelete(ctx: Contexto): Promise<ResultadoIntegracao> {
  const j = ctx.job;
  if (!j.fast?.email_calendario) return { ok: true, resultado: { ignorado: "sem e-mail de calendário" } };
  const alvo = await alvoDoFast(j.fast.email_calendario);
  for (const id of [j.calendar_event_id, j.calendar_event_edicao_id]) if (id) await excluirEvento(alvo, id);
  return { ok: true, resultado: { excluidos: [j.calendar_event_id, j.calendar_event_edicao_id].filter(Boolean) }, patchJob: { calendar_event_id: null, calendar_event_edicao_id: null } };
}
