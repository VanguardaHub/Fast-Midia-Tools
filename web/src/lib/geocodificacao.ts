export interface ResultadoGeo { rotulo: string; lat: number; lng: number }

/** Área de operação (Manaus/AM) usada como viés dos provedores de geocodificação. */
const MANAUS = { lat: -3.119, lng: -60.0217, viewbox: "-60.25,-2.90,-59.80,-3.25" };

/** Acrescenta a cidade quando o endereço não a menciona (ex.: "av ramos ferreira, 2626"). */
export function normalizarEndereco(q: string): string {
  const t = q.trim().replace(/\s+/g, " ");
  if (t.length < 5) return t;
  return /manaus|\bam\b|amazonas/i.test(t) ? t : `${t}, Manaus - AM`;
}

/**
 * RF-36 — geocodificação do endereço (Google se GOOGLE_GEOCODING_KEY existir; senão Nominatim/OSM),
 * com viés para Manaus. Usada pela rota /api/geocodificar e pela definição automática do ponto do job.
 */
export async function geocodificar(q: string): Promise<ResultadoGeo[]> {
  const consulta = normalizarEndereco(q);
  if (consulta.length < 5) return [];
  const chave = process.env.GOOGLE_GEOCODING_KEY;
  if (chave) {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(consulta)}&region=br&language=pt-BR&components=country:BR&key=${chave}`);
    const j = (await r.json()) as { results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[] };
    return (j.results ?? []).slice(0, 5).map((x) => ({ rotulo: x.formatted_address, lat: x.geometry.location.lat, lng: x.geometry.location.lng }));
  }
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&accept-language=pt-BR&viewbox=${MANAUS.viewbox}&q=${encodeURIComponent(consulta)}`,
    { headers: { "User-Agent": "FastMidiaTools/2.0 (uso interno; contato: ti@vanguardamartech.com.br)" }, next: { revalidate: 3600 } },
  );
  const j = (await r.json()) as { display_name: string; lat: string; lon: string }[];
  return j.map((x) => ({ rotulo: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }));
}

/** Primeiro resultado plausível dentro da área de operação (até ~60 km do centro de Manaus). */
export async function geocodificarMelhor(q: string): Promise<ResultadoGeo | null> {
  try {
    const rs = await geocodificar(q);
    const perto = rs.find((r) => Math.abs(r.lat - MANAUS.lat) < 0.55 && Math.abs(r.lng - MANAUS.lng) < 0.55);
    return perto ?? rs[0] ?? null;
  } catch {
    return null;
  }
}
