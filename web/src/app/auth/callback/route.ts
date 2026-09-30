import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Troca o código OAuth/magic-link por sessão em cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const destino = next.startsWith("/") ? next : "/";

  if (code) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
    return NextResponse.redirect(`${origin}/login?erro=${encodeURIComponent(error.message)}`);
  }
  return NextResponse.redirect(`${origin}/login?erro=${encodeURIComponent("Link inválido ou expirado")}`);
}
