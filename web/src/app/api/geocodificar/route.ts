import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";
import { geocodificar } from "@/lib/geocodificacao";

/**
 * RF-36 — geocodificação do endereço do briefing, com confirmação manual no mapa.
 * Provedor e viés (Manaus) em lib/geocodificacao. Exige sessão autenticada (RNF-01).
 */
export async function GET(request: Request) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 5) return NextResponse.json({ resultados: [] });
  try {
    return NextResponse.json({ resultados: await geocodificar(q) });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message, resultados: [] }, { status: 502 });
  }
}
