import { createSign } from "node:crypto";
import { adminDisponivel, clienteAdmin } from "@/lib/supabase/admin";

/**
 * Autenticação Google das integrações (Calendar e Drive) — ADR-0006, revisão 2 (08/10/2026).
 * Ordem de preferência:
 *   1. Conta Google corporativa conectada por OAuth em Cadastros → Integrações (token de atualização em
 *      `integracao_credencial`, lido só com service_role). O app age como essa conta.
 *   2. Conta de serviço (GOOGLE_SERVICE_ACCOUNT_JSON), com impersonação opcional.
 * Sem nenhuma das duas, as integrações ficam "pendentes" e a fila degrada graciosamente.
 */

export const ESCOPO_CALENDAR = "https://www.googleapis.com/auth/calendar";
export const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive";
export const ESCOPOS_OAUTH = ["openid", "email", ESCOPO_CALENDAR, ESCOPO_DRIVE];

export interface CredencialGoogle { conta_email: string; refresh_token: string; escopos: string[]; atualizado_em: string }
interface ContaServico { client_email: string; private_key: string; token_uri?: string }

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const cache = new Map<string, { token: string; expira: number }>();

export function oauthClienteConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

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

/** Credencial OAuth salva (ou null). Só funciona no servidor com service_role. */
export async function credencialOAuth(): Promise<CredencialGoogle | null> {
  if (!adminDisponivel()) return null;
  try {
    const { data } = await clienteAdmin().from("integracao_credencial").select("conta_email, refresh_token, escopos, atualizado_em").eq("provedor", "google").maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export type OrigemGoogle = "oauth" | "conta_servico" | null;

export async function origemGoogle(): Promise<OrigemGoogle> {
  if (await credencialOAuth()) return "oauth";
  if (lerContaServico()) return "conta_servico";
  return null;
}

export async function googleConfigurado(): Promise<boolean> {
  return (await origemGoogle()) !== null;
}

export async function salvarCredencialOAuth(conta_email: string, refresh_token: string, escopos: string[], conectado_por: string | null): Promise<void> {
  const { error } = await clienteAdmin().from("integracao_credencial").upsert({ provedor: "google", conta_email, refresh_token, escopos, conectado_por, atualizado_em: new Date().toISOString() }, { onConflict: "provedor" });
  if (error) throw new Error(error.message);
  cache.delete("oauth");
}

export async function removerCredencialOAuth(): Promise<void> {
  await clienteAdmin().from("integracao_credencial").delete().eq("provedor", "google");
  cache.delete("oauth");
}

/** Token de acesso para o escopo; `sub` só se aplica à conta de serviço com delegação. */
export async function obterTokenGoogle(escopo: string, sub?: string): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const oauth = await credencialOAuth();
  if (oauth) {
    const emCache = cache.get("oauth");
    if (emCache && emCache.expira > agora + 60) return emCache.token;
    if (!oauthClienteConfigurado()) throw new Error("GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET não configurados");
    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: oauth.refresh_token, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET! }),
    });
    const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!r.ok || !j.access_token) throw new Error(`Google OAuth (${oauth.conta_email}): ${j.error ?? r.status} ${j.error_description ?? ""}. Reconecte a conta em Cadastros → Integrações.`.trim());
    cache.set("oauth", { token: j.access_token, expira: agora + (j.expires_in ?? 3600) });
    return j.access_token;
  }

  const sa = lerContaServico();
  if (!sa) throw new Error("Nenhuma conta Google conectada (OAuth) nem conta de serviço configurada");
  const chave = `sa|${escopo}|${sub ?? ""}`;
  const emCache = cache.get(chave);
  if (emCache && emCache.expira > agora + 60) return emCache.token;
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const cabecalho = b64({ alg: "RS256", typ: "JWT" });
  const corpo = b64({ iss: sa.client_email, scope: escopo, aud: sa.token_uri ?? TOKEN_URL, iat: agora, exp: agora + 3600, ...(sub ? { sub } : {}) });
  const assinatura = createSign("RSA-SHA256").update(`${cabecalho}.${corpo}`).sign(sa.private_key, "base64url");
  const r = await fetch(sa.token_uri ?? TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cabecalho}.${corpo}.${assinatura}` }),
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!r.ok || !j.access_token) throw new Error(`Google OAuth (conta de serviço): ${j.error ?? r.status} ${j.error_description ?? ""}`.trim());
  cache.set(chave, { token: j.access_token, expira: agora + (j.expires_in ?? 3600) });
  return j.access_token;
}

/** Troca o código de autorização por tokens (fluxo web, callback). */
export async function trocarCodigoPorTokens(code: string, redirectUri: string): Promise<{ refresh_token?: string; id_token?: string; scope?: string; access_token?: string }> {
  if (!oauthClienteConfigurado()) throw new Error("GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET não configurados");
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET! }),
  });
  const j = (await r.json()) as { refresh_token?: string; id_token?: string; scope?: string; access_token?: string; error?: string; error_description?: string };
  if (!r.ok) throw new Error(`Google OAuth: ${j.error ?? r.status} ${j.error_description ?? ""}`.trim());
  return j;
}

/** E-mail do id_token (JWT) sem validar assinatura: a origem é a própria troca de código com o segredo do cliente. */
export function emailDoIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}
