import { createSign } from "node:crypto";
import type { Contexto, ResultadoIntegracao } from "./tipos";
import { intervalosParaBloqueios, type Bloqueio, type IntervaloOcupado, type JanelaSlots, SLOTS_PADRAO } from "./calendario-bloqueios";

/**
 * RF-10 / RF-62 — Google Calendar pela API oficial, com conta de serviço (ADR-0006).
 * Dois modos:
 *   • impersonar (padrão): delegação em todo o domínio (Workspace Admin) — a conta de serviço age como o
 *     próprio Fast (`sub` = e-mail do calendário) e grava no calendário principal dele; bloqueios são lidos
 *     do calendário do Fast.
 *   • compartilhado: `GOOGLE_CALENDAR_ID` de um calendário corporativo compartilhado com a conta de serviço
 *     (permissão "fazer alterações"); o Fast entra como convidado e os bloqueios são lidos desse calendário.
 * Idempotência: cada evento carrega `extendedProperties.private.fmt_job_id`; o id do evento fica em `job.calendar_event_id`.
 */

interface ContaServico { client_email: string; private_key: string; token_uri?: string }
const ESCOPO = "https://www.googleapis.com/auth/calendar";
const API = "https://www.googleapis.com/calendar/v3";

function lerContaServico(): ContaServico | null {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!bruto) return null;
  try {
    const texto = bruto.trim().startsWith("{") ? bruto : Buffer.from(bruto, "base64").toString("utf8");
    const j = JSON.parse(texto) as ContaServico;
    if (!j.client_email || !j.private_key) return null;
    return { ...j, private_key: j.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function googleCalendarConfigurado(): boolean {
  return lerContaServico() !== null;
}

export function modoCalendar(): "impersonar" | "compartilhado" {
  return process.env.GOOGLE_CALENDAR_ID ? "compartilhado" : "impersonar";
}

const cacheToken = new Map<string, { token: string; expira: number }>();

/** Token OAuth 2.0 por JWT assinado (RS256); `sub` = usuário a impersonar (delegação em todo o domínio); `escopo` padrão Calendar. */
export async function obterToken(sub?: string, escopo: string = ESCOPO): Promise<string> {
  const sa = lerContaServico();
  if (!sa) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurada");
  const chave = `${escopo}|${sub ?? "__sa__"}`;
  const agora = Math.floor(Date.now() / 1000);
  const emCache = cacheToken.get(chave);
  if (emCache && emCache.expira > agora + 60) return emCache.token;

  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const cabecalho = b64({ alg: "RS256", typ: "JWT" });
  const corpo = b64({ iss: sa.client_email, scope: escopo, aud: sa.token_uri ?? "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600, ...(sub ? { sub } : {}) });
  const assinatura = createSign("RSA-SHA256").update(`${cabecalho}.${corpo}`).sign(sa.private_key, "base64url");
  const r = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cabecalho}.${corpo}.${assinatura}` }),
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!r.ok || !j.access_token) throw new Error(`Google OAuth: ${j.error ?? r.status} ${j.error_description ?? ""}`.trim());
  cacheToken.set(chave, { token: j.access_token, expira: agora + (j.expires_in ?? 3600) });
  return j.access_token;
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
  if (modoCalendar() === "compartilhado") return { token: await obterToken(), calendarId: process.env.GOOGLE_CALENDAR_ID!, convidado: email };
  return { token: await obterToken(email), calendarId: "primary" };
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
  if (idAtual) {
    const r = await gapi<{ id?: string; error?: { message?: string } }>(alvo.token, `/calendars/${encodeURIComponent(alvo.calendarId)}/events/${encodeURIComponent(idAtual)}`, { method: "PATCH", body: JSON.stringify(corpo) });
    if (r.status < 300 && r.body.id) return r.body.id;
    if (r.status !== 404 && r.status !== 410) throw new Error(`Calendar PATCH ${r.status}: ${r.body.error?.message ?? ""}`);
  }
  // procura por id do job (idempotência quando o id gravado se perdeu)
  const busca = await gapi<{ items?: { id: string }[] }>(alvo.token, `/calendars/${encodeURIComponent(alvo.calendarId)}/events?privateExtendedProperty=${encodeURIComponent(`fmt_chave=${evento.extendedProperties.private.fmt_chave}`)}&maxResults=1`);
  const existente = busca.body.items?.[0]?.id;
  if (existente) {
    const r = await gapi<{ id?: string }>(alvo.token, `/calendars/${encodeURIComponent(alvo.calendarId)}/events/${encodeURIComponent(existente)}`, { method: "PATCH", body: JSON.stringify(corpo) });
    if (r.status < 300 && r.body.id) return r.body.id;
  }
  const r = await gapi<{ id?: string; error?: { message?: string } }>(alvo.token, `/calendars/${encodeURIComponent(alvo.calendarId)}/events?sendUpdates=${alvo.convidado ? "all" : "none"}`, { method: "POST", body: JSON.stringify(corpo) });
  if (r.status >= 300 || !r.body.id) throw new Error(`Calendar POST ${r.status}: ${r.body.error?.message ?? ""}`);
  return r.body.id;
}

async function excluirEvento(alvo: Alvo, id: string): Promise<void> {
  const r = await gapi<{ error?: { message?: string } }>(alvo.token, `/calendars/${encodeURIComponent(alvo.calendarId)}/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (r.status >= 300 && r.status !== 404 && r.status !== 410) throw new Error(`Calendar DELETE ${r.status}: ${r.body.error?.message ?? ""}`);
}

function fuso(): string {
  return process.env.FMT_TIMEZONE ?? "America/Manaus";
}

/** RF-62 — cria/atualiza o evento do job (e o da edição, quando houver) no calendário do Fast. */
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

  return { ok: true, resultado: { calendar_event_id: idJob, calendar_event_edicao_id: idEdicao, modo: modoCalendar() }, patchJob: { calendar_event_id: idJob, calendar_event_edicao_id: idEdicao } };
}

/** RF-62 — remove os eventos do job (cancelamento). */
export async function calendarDelete(ctx: Contexto): Promise<ResultadoIntegracao> {
  const j = ctx.job;
  if (!j.fast?.email_calendario) return { ok: true, resultado: { ignorado: "sem e-mail de calendário" } };
  const alvo = await alvoDoFast(j.fast.email_calendario);
  for (const id of [j.calendar_event_id, j.calendar_event_edicao_id]) if (id) await excluirEvento(alvo, id);
  return { ok: true, resultado: { excluidos: [j.calendar_event_id, j.calendar_event_edicao_id].filter(Boolean) }, patchJob: { calendar_event_id: null, calendar_event_edicao_id: null } };
}

interface EventoLista {
  id: string; status?: string; transparency?: string;
  start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
  attendees?: { email?: string; self?: boolean; responseStatus?: string }[];
}

/**
 * RF-10 — bloqueios externos: eventos do Google Calendar do Fast (ou do calendário compartilhado) que ocupam
 * um slot da semana. Ignora eventos criados pelo próprio app, eventos "livre" (transparent) e recusados.
 */
export async function carregarBloqueiosGoogle(fasts: { email: string }[], inicio: string, fim: string, slots: JanelaSlots = SLOTS_PADRAO): Promise<Bloqueio[]> {
  const dias: string[] = [];
  for (let t = Date.parse(`${inicio}T00:00:00Z`); t <= Date.parse(`${fim}T00:00:00Z`); t += 86_400_000) dias.push(new Date(t).toISOString().slice(0, 10));
  const timeMin = new Date(Date.parse(`${inicio}T00:00:00Z`) - 12 * 3_600_000).toISOString();
  const timeMax = new Date(Date.parse(`${fim}T00:00:00Z`) + 36 * 3_600_000).toISOString();
  const intervalos: IntervaloOcupado[] = [];

  const listar = async (token: string, calendarId: string) => {
    const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", maxResults: "250", orderBy: "startTime" });
    const r = await gapi<{ items?: EventoLista[] }>(token, `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
    return r.status < 300 ? (r.body.items ?? []) : [];
  };
  const usar = (e: EventoLista) => e.status !== "cancelled" && e.transparency !== "transparent" && !e.extendedProperties?.private?.fmt_job_id;

  if (modoCalendar() === "compartilhado") {
    const eventos = await listar(await obterToken(), process.env.GOOGLE_CALENDAR_ID!);
    for (const e of eventos) {
      if (!usar(e)) continue;
      for (const a of e.attendees ?? []) {
        if (!a.email || a.responseStatus === "declined") continue;
        if (!fasts.some((f) => f.email.toLowerCase() === a.email!.toLowerCase())) continue;
        intervalos.push(paraIntervalo(a.email, e));
      }
    }
  } else {
    await Promise.all(fasts.map(async (f) => {
      try {
        const eventos = await listar(await obterToken(f.email), "primary");
        for (const e of eventos) {
          if (!usar(e)) continue;
          if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
          intervalos.push(paraIntervalo(f.email, e));
        }
      } catch {
        // Fast sem delegação/permissão: sem bloqueios para ele, agenda continua operando
      }
    }));
  }
  return intervalosParaBloqueios(intervalos, dias, slots, fuso());
}

function paraIntervalo(email: string, e: EventoLista): IntervaloOcupado {
  if (e.start?.date) return { fastEmail: email, inicio: e.start.date, fim: e.end?.date ?? e.start.date, diaInteiro: true };
  return { fastEmail: email, inicio: e.start?.dateTime ?? "", fim: e.end?.dateTime ?? "" };
}
