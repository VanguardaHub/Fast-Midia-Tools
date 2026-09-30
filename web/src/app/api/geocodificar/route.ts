import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * RF-36 — geocodificação do endereço do briefing, com confirmação manual no mapa.
 * Usa Nominatim (OpenStreetMap) por padrão; se GOOGLE_GEOCODING_KEY estiver definida, usa Google.
 * Exige sessão autenticada (RNF-01).
 */
export async function GET(request: Request) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 5) return NextResponse.json({ resultados: [] });

  try {
    const chave = process.env.GOOGLE_GEOCODING_KEY;
    if (chave) {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=br&language=pt-BR&key=${chave}`);
      const j = (await r.json()) as { results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[] };
      return NextResponse.json({
        resultados: (j.results ?? []).slice(0, 5).map((x) => ({ rotulo: x.formatted_address, lat: x.geometry.location.lat, lng: x.geometry.location.lng })),
      });
    }
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "FastMidiaTools/2.0 (uso interno; contato: ti@vanguardamartech.com.br)" },
      next: { revalidate: 3600 },
    });
    const j = (await r.json()) as { display_name: string; lat: string; lon: string }[];
    return NextResponse.json({
      resultados: j.map((x) => ({ rotulo: x.display_name, lat: Number(x.lat), lng: Number(x.lon) })),
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message, resultados: [] }, { status: 502 });
  }
}
