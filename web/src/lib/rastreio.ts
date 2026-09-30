import { distanciaMetros } from "@/lib/regras";

export interface Posicao {
  lat: number;
  lng: number;
  precisaoM: number;
  capturadoEm: string;
}

export interface PoliticaEnvio {
  /** intervalo mínimo entre envios (ms) — espelha `rastreio_intervalo_s` do banco */
  intervaloMs: number;
  /** deslocamento mínimo para enviar antes do intervalo "longo" (m) */
  deslocamentoMinM: number;
  /** leituras com precisão pior que isto não são enviadas (m) */
  precisaoMaxM: number;
}

export const POLITICA_PADRAO: PoliticaEnvio = { intervaloMs: 30_000, deslocamentoMinM: 25, precisaoMaxM: 150 };

/**
 * RF-38 / ADR-0005 — decide, no aparelho, se uma leitura de `watchPosition` deve ser enviada.
 * Minimização de dados: envia no máximo uma posição por intervalo e ignora leituras imprecisas
 * ou sem deslocamento relevante (o Fast parado no cliente gera um ponto a cada 4× o intervalo).
 * O banco reaplica o intervalo (trigger) — esta função só evita tráfego inútil.
 */
export function deveEnviarPosicao(anterior: Posicao | null, atual: Posicao, politica: PoliticaEnvio = POLITICA_PADRAO): boolean {
  if (atual.precisaoM > politica.precisaoMaxM) return false;
  if (!anterior) return true;
  const decorridoMs = new Date(atual.capturadoEm).getTime() - new Date(anterior.capturadoEm).getTime();
  if (decorridoMs < politica.intervaloMs) return false;
  const deslocamento = distanciaMetros(anterior.lat, anterior.lng, atual.lat, atual.lng);
  if (deslocamento >= politica.deslocamentoMinM) return true;
  // parado: mantém "sinal de vida" com frequência menor
  return decorridoMs >= politica.intervaloMs * 4;
}

/** Instante atual em ms (isolado para uso em Server Components, que não devem chamar Date.now diretamente no render). */
export function agoraMs(): number {
  return Date.now();
}

/** Idade de uma posição em segundos (para o rótulo "há Xs" e para o estado "sem sinal"). */
export function idadeSegundos(capturadoEm: string, agora: number = Date.now()): number {
  return Math.max(0, Math.round((agora - new Date(capturadoEm).getTime()) / 1000));
}

/** Limite a partir do qual a última posição é considerada desatualizada (3 intervalos). */
export function posicaoDesatualizada(capturadoEm: string, intervaloMs: number = POLITICA_PADRAO.intervaloMs, agora: number = Date.now()): boolean {
  return idadeSegundos(capturadoEm, agora) * 1000 > intervaloMs * 3;
}
