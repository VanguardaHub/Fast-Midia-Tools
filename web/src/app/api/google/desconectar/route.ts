import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/sessao";
import { removerCredencialOAuth } from "@/lib/integracoes/google-auth";

/** Admin desconecta a conta Google (remove o token de atualização). Revogar também em myaccount.google.com/permissions. */
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const s = await obterSessao();
  if (!s.ehAdmin) return NextResponse.redirect(`${origin}/cadastros/integracoes?google=sem_permissao`, 303);
  await removerCredencialOAuth();
  return NextResponse.redirect(`${origin}/cadastros/integracoes?google=desconectada`, 303);
}
