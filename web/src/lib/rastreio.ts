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

// ---------- Acompanhamento ao vivo no Mapa do dia (RF-51, ADR-0005 rev. 08/10) ----------

export interface PontoTrilha {
  lat: number;
  lng: number;
  capturadoEm: string;
}

export interface ResumoTrilha {
  /** distância percorrida somando os trechos (m) */
  distanciaM: number;
  /** tempo entre o primeiro e o último ponto (s) */
  duracaoS: number;
  /** velocidade média dos pontos recentes (m/s); null sem base suficiente */
  velocidadeMs: number | null;
  emMovimento: boolean;
}

/** Rumo (0–360°, sentido horário a partir do norte) de A para B, para orientar a seta do Fast no mapa. */
export function rumoGraus(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Resume a trilha: distância, duração e velocidade recente (últimos `janelaRecenteS` segundos antes do último ponto).
 * Em movimento = velocidade recente ≥ 0,5 m/s (andando devagar); abaixo disso o Fast é tratado como parado.
 */
export function resumoTrilha(pontos: PontoTrilha[], janelaRecenteS = 180): ResumoTrilha {
  if (pontos.length < 2) return { distanciaM: 0, duracaoS: 0, velocidadeMs: null, emMovimento: false };
  let distanciaM = 0;
  for (let i = 1; i < pontos.length; i++) distanciaM += distanciaMetros(pontos[i - 1].lat, pontos[i - 1].lng, pontos[i].lat, pontos[i].lng);
  const t = (p: PontoTrilha) => new Date(p.capturadoEm).getTime();
  const duracaoS = Math.max(0, (t(pontos[pontos.length - 1]) - t(pontos[0])) / 1000);

  const fim = t(pontos[pontos.length - 1]);
  const recentes = pontos.filter((p) => fim - t(p) <= janelaRecenteS * 1000);
  let velocidadeMs: number | null = null;
  if (recentes.length >= 2) {
    let d = 0;
    for (let i = 1; i < recentes.length; i++) d += distanciaMetros(recentes[i - 1].lat, recentes[i - 1].lng, recentes[i].lat, recentes[i].lng);
    const s = (t(recentes[recentes.length - 1]) - t(recentes[0])) / 1000;
    velocidadeMs = s > 0 ? d / s : null;
  }
  return { distanciaM, duracaoS, velocidadeMs, emMovimento: (velocidadeMs ?? 0) >= 0.5 };
}

/** Estimativa de chegada (s) pela distância em linha reta e a velocidade recente; null se parado ou sem base. */
export function etaSegundos(distanciaM: number, velocidadeMs: number | null): number | null {
  if (velocidadeMs == null || velocidadeMs < 0.5) return null;
  return Math.round(distanciaM / velocidadeMs);
}

/** "850 m" ou "2,3 km". */
export function fmtDistancia(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** "45 s", "4 min" ou "1 h 05". */
export function fmtDuracao(s: number): string {
  if (s < 60) return `${Math.round(s)} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}
