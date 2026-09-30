import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Convites de acesso (RF-01/RF-02).
 * Gera um link de uso único pelo Supabase Auth (admin.generateLink) sem depender do SMTP do Supabase:
 *  - usuário novo  → tipo "invite" (cria o usuário; o trigger tg_auth_usuario_criado aplica o perfil do convite)
 *  - usuário já existente → tipo "magiclink"
 * O link aponta para /auth/confirmar, que valida o token_hash no servidor e abre a sessão.
 * O e-mail é enviado pelo Resend quando configurado; caso contrário o link é devolvido para envio manual.
 */
export type ResultadoConvite =
  | { ok: true; link: string; emailEnviado: boolean; aviso?: string }
  | { ok: false; erro: string };

function urlApp(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
}

export async function gerarEEnviarConvite(email: string, nome: string | null, perfil: string, convidadoPor: string): Promise<ResultadoConvite> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    return { ok: false, erro: "SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel: o convite foi registrado, mas o link de acesso não pôde ser gerado." };
  }
  const admin = createClient<Database>(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

  // Descobre se o usuário já existe (lista paginada; base pequena)
  let existe = false;
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (lista?.users?.some((u) => u.email?.toLowerCase() === email.toLowerCase())) existe = true;

  const { data, error } = await admin.auth.admin.generateLink(
    existe
      ? { type: "magiclink", email }
      : { type: "invite", email, options: { data: { nome: nome ?? undefined } } },
  );
  if (error || !data?.properties?.hashed_token) {
    return { ok: false, erro: `Falha ao gerar o link: ${error?.message ?? "sem token"}` };
  }
  const tipo = existe ? "magiclink" : "invite";
  const link = `${urlApp()}/auth/confirmar?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${tipo}&next=${encodeURIComponent("/")}`;

  const envio = await enviarEmailConvite(email, nome, perfil, link, convidadoPor);
  return { ok: true, link, emailEnviado: envio.ok, aviso: envio.ok ? undefined : envio.erro };
}

const ROTULO_PERFIL: Record<string, string> = { fast: "Fast (equipe de campo)", analista: "Analista", supervisora: "Supervisora", admin: "Admin" };

async function enviarEmailConvite(email: string, nome: string | null, perfil: string, link: string, convidadoPor: string): Promise<{ ok: boolean; erro?: string }> {
  const chave = process.env.RESEND_API_KEY;
  const de = process.env.EMAIL_REMETENTE ?? "Fast Mídia Tools <no-reply@vanguardamartech.com.br>";
  if (!chave) return { ok: false, erro: "RESEND_API_KEY não configurada: envie o link manualmente." };
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
  const html = `
<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1523">
  <h2 style="color:#6d28d9;margin:0 0 12px">Fast Mídia Tools</h2>
  <p>${saudacao}</p>
  <p>${convidadoPor} convidou você para acessar a plataforma da Fast Mídia (Vanguarda Martech) com o perfil <strong>${ROTULO_PERFIL[perfil] ?? perfil}</strong>.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#6d28d9;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">Ativar meu acesso</a></p>
  <p style="font-size:13px;color:#6b6478">O link é de uso único e expira em pouco tempo. Se expirar, peça um novo convite à supervisão. Depois de entrar, defina uma senha em <em>Minha conta</em>.</p>
  <p style="font-size:12px;color:#6b6478">Se você não esperava este convite, ignore este e-mail.</p>
</div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: de, to: [email], subject: "Seu acesso ao Fast Mídia Tools", html, text: `${saudacao}\n\nAtive seu acesso ao Fast Mídia Tools: ${link}` }),
  });
  if (!r.ok) return { ok: false, erro: `Resend ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true };
}
