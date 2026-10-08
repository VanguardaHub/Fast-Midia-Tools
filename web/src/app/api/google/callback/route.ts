import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { obterSessao } from "@/lib/sessao";
import { emailDoIdToken, salvarCredencialOAuth, trocarCodigoPorTokens } from "@/lib/integracoes/google-auth";

/** Retorno do consentimento Google: troca o código, guarda o token de atualização (service_role) e volta à tela. */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const voltar = (status: string) => NextResponse.redirect(`${origin}/cadastros/integracoes?google=${status}`);
  const s = await obterSessao();
  if (!s.ehAdmin) return voltar("sem_permissao");

  const jar = await cookies();
  const esperado = jar.get("fmt_google_state")?.value;
  const state = searchParams.get("state");
  const code = searchParams.get("code");
  if (searchParams.get("error")) return voltar("recusado");
  if (!code || !state || !esperado || state !== esperado) return voltar("estado_invalido");

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? origin}/api/google/callback`;
    const t = await trocarCodigoPorTokens(code, redirectUri);
    if (!t.refresh_token) return voltar("sem_refresh");
    const email = emailDoIdToken(t.id_token) ?? "conta-google";
    await salvarCredencialOAuth(email, t.refresh_token, (t.scope ?? "").split(" ").filter(Boolean), s.usuarioId);
    const res = voltar("conectada");
    res.cookies.delete("fmt_google_state");
    return res;
  } catch (e) {
    return voltar(`erro:${encodeURIComponent((e as Error).message.slice(0, 120))}`);
  }
}
