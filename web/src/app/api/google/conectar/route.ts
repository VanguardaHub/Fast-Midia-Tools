import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { obterSessao } from "@/lib/sessao";
import { ESCOPOS_OAUTH, oauthClienteConfigurado } from "@/lib/integracoes/google-auth";

/** Admin inicia a conexão da conta Google corporativa (OAuth, acesso offline) — ADR-0006 rev. 2. */
export async function GET(request: Request) {
  const s = await obterSessao();
  const { origin } = new URL(request.url);
  if (!s.ehAdmin) return NextResponse.redirect(`${origin}/cadastros/integracoes?google=sem_permissao`);
  if (!oauthClienteConfigurado()) return NextResponse.redirect(`${origin}/cadastros/integracoes?google=sem_cliente`);

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? origin}/api/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ESCOPOS_OAUTH.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("fmt_google_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google", maxAge: 600 });
  return res;
}
