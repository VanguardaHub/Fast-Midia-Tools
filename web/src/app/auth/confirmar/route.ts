import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Confirma links de convite/magic link gerados pelo servidor (token_hash) e abre a sessão em cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const destino = next.startsWith("/") ? next : "/";

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?erro=${encodeURIComponent("Link de convite inválido")}`);
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=${encodeURIComponent("Link expirado ou já utilizado. Peça um novo convite.")}`);
  }
  return NextResponse.redirect(`${origin}${destino}`);
}
