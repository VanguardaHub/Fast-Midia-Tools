/**
 * Regras de negócio puras (sem I/O) — espelham as validações do banco para
 * feedback imediato no cliente. A fonte de verdade continua sendo o Postgres
 * (migração 0003). Cobertas por testes automatizados (RNF-11, critério 13.3).
 *
 * Origem: docs/processos-operacionais.md v1.0 e escopo RF-12, RF-13, RF-31..RF-34, RNF-06.
 */

export type Slot = "manha" | "tarde";

export interface SlotConfig {
  inicio: number; // hora local
  fim: number;
  label: string;
}

export const SLOTS_PADRAO: Record<Slot, SlotConfig> = {
  manha: { inicio: 8, fim: 12, label: "08:00 – 12:00" },
  tarde: { inicio: 13, fim: 17, label: "13:00 – 17:00" },
};

export interface IntervaloJob {
  id?: string;
  fastId: string;
  data: string; // YYYY-MM-DD
  slot: Slot;
  status?: string;
}

export interface ConflitoAgenda {
  tipo: "agendamento_duplo" | "buffer_2h";
  jobConflitante: IntervaloJob;
}

/** Converte data + slot em instantes (minutos desde epoch local) para comparação. */
export function intervaloMinutos(data: string, slot: Slot, slots = SLOTS_PADRAO): [number, number] {
  const [y, m, d] = data.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d) / 60000; // dia em minutos (fuso irrelevante para comparação relativa)
  const cfg = slots[slot];
  return [base + cfg.inicio * 60, base + cfg.fim * 60];
}

/**
 * RF-12 e RF-13 — detecta agendamento duplo no mesmo dia e violação do buffer
 * mínimo (padrão 120 min) entre jobs do mesmo Fast.
 * Jobs cancelados não contam.
 */
export function detectarConflitos(
  novo: IntervaloJob,
  existentes: IntervaloJob[],
  bufferMinutos = 120,
  slots = SLOTS_PADRAO,
): ConflitoAgenda[] {
  const conflitos: ConflitoAgenda[] = [];
  const [ini, fim] = intervaloMinutos(novo.data, novo.slot, slots);

  for (const j of existentes) {
    if (j.fastId !== novo.fastId) continue;
    if (j.status === "cancelado") continue;
    if (novo.id && j.id === novo.id) continue;

    if (j.data === novo.data) {
      conflitos.push({ tipo: "agendamento_duplo", jobConflitante: j });
      continue;
    }
    const [jIni, jFim] = intervaloMinutos(j.data, j.slot, slots);
    const sobrepoeComBuffer = jIni - bufferMinutos < fim && jFim + bufferMinutos > ini;
    if (sobrepoeComBuffer) conflitos.push({ tipo: "buffer_2h", jobConflitante: j });
  }
  return conflitos;
}

/** Distância geodésica (Haversine) em metros. */
export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface AvaliacaoCheckin {
  dentroGeofence: boolean | null;
  distanciaM: number | null;
  precisaoAceitavel: boolean;
  exigeJustificativa: boolean;
  motivos: string[];
}

/**
 * RF-31, RF-33, RF-34, RNF-06 — avalia uma leitura de GPS contra a geofence do job.
 * Sem ponto do job → não é possível validar → exige justificativa.
 */
export function avaliarCheckin(
  leitura: { lat: number; lng: number; precisaoM: number },
  geofence: { lat: number; lng: number; raioM: number } | null,
  precisaoMaximaM = 100,
): AvaliacaoCheckin {
  const motivos: string[] = [];
  const precisaoAceitavel = leitura.precisaoM <= precisaoMaximaM;
  if (!precisaoAceitavel) motivos.push(`Precisão do GPS de ${Math.round(leitura.precisaoM)} m acima do limite de ${precisaoMaximaM} m`);

  let dentroGeofence: boolean | null = null;
  let distanciaM: number | null = null;
  if (geofence) {
    distanciaM = distanciaMetros(leitura.lat, leitura.lng, geofence.lat, geofence.lng);
    dentroGeofence = distanciaM <= geofence.raioM;
    if (!dentroGeofence) motivos.push(`Fora da geofence: ${Math.round(distanciaM)} m do ponto (raio ${geofence.raioM} m)`);
  } else {
    motivos.push("Job sem ponto geográfico confirmado");
  }

  return {
    dentroGeofence,
    distanciaM,
    precisaoAceitavel,
    exigeJustificativa: motivos.length > 0,
    motivos,
  };
}

/**
 * RF-35 — janela em que a captura de localização é permitida.
 */
export function dentroDaJanela(
  agora: Date,
  inicio: Date,
  fim: Date,
  antesMin = 120,
  depoisMin = 240,
): boolean {
  const t = agora.getTime();
  return t >= inicio.getTime() - antesMin * 60000 && t <= fim.getTime() + depoisMin * 60000;
}

/**
 * RF-42 — bloqueio preventivo de "Concluído" sem os dois comprovantes de 99.
 */
export function podeConcluir(
  precisa99: boolean,
  corridas: { sentido: "ida" | "volta"; comprovantePath: string | null }[],
): { ok: boolean; faltando: ("ida" | "volta")[] } {
  if (!precisa99) return { ok: true, faltando: [] };
  const faltando: ("ida" | "volta")[] = [];
  for (const s of ["ida", "volta"] as const) {
    if (!corridas.some((c) => c.sentido === s && c.comprovantePath)) faltando.push(s);
  }
  return { ok: faltando.length === 0, faltando };
}

/** Transições de status permitidas à supervisora (Kanban RF-50). */
export const TRANSICOES: Record<string, string[]> = {
  aguardando_briefing: ["briefing_recebido", "cancelado"],
  briefing_recebido: ["em_gravacao", "aguardando_briefing", "cancelado"],
  em_gravacao: ["material_entregue", "cancelado"],
  material_entregue: ["em_edicao", "concluido", "cancelado"],
  em_edicao: ["concluido", "material_entregue", "cancelado"],
  concluido: ["em_edicao"],
  cancelado: [],
};

export function transicaoPermitida(de: string, para: string): boolean {
  return (TRANSICOES[de] ?? []).includes(para);
}

/** Traduz mensagens de erro do banco (códigos P0002..P0013) para o usuário. */
export function traduzirErro(mensagem: string | undefined | null): string {
  if (!mensagem) return "Erro desconhecido";
  const mapa: [RegExp, string][] = [
    [/AGENDAMENTO_DUPLO/, "O Fast já tem um job neste dia. Apenas a supervisora pode aprovar agendamento duplo, informando o motivo."],
    [/BUFFER_2H/, "Menos de 2h de folga em relação a outro job do Fast. Apenas a supervisora pode aprovar, informando o motivo."],
    [/COMPROVANTES_99_FALTANDO/, "Anexe os comprovantes de ida e volta da corrida 99 antes de concluir o job."],
    [/CONSENTIMENTO_PENDENTE/, "Aceite o termo de ciência sobre coleta de localização antes do check-in."],
    [/FORA_DA_JANELA/, "Check-in/out só é permitido na janela do job (2h antes até 4h depois)."],
    [/SEM_BRIEFING/, "Este job ainda não tem briefing. Nenhuma gravação começa sem briefing."],
    [/STATUS_INVALIDO_PARA_CHECKIN/, "O job não está em status que permita check-in."],
    [/SEM_CHECKIN/, "Registre a chegada antes da saída."],
    [/RASTREIO_DESABILITADO/, "O compartilhamento de posição está desligado pela administração."],
    [/RASTREIO_FORA_DA_GRAVACAO/, "A posição só é compartilhada entre a chegada e a saída do job."],
    [/BAIXA_PRECISAO_SEM_JUSTIFICATIVA/, "Precisão do GPS insuficiente. Informe uma justificativa."],
    [/FORA_GEOFENCE_SEM_JUSTIFICATIVA/, "Você está fora da geofence do job. Informe uma justificativa."],
    [/job_slot_unico|job_sem_sobreposicao/, "Este slot acabou de ser ocupado por outro agendamento. Atualize a agenda."],
    [/EMAIL_NAO_AUTORIZADO/, "E-mail fora do domínio corporativo e sem convite."],
    [/SEM_PERMISSAO/, "Você não tem permissão para esta ação."],
    [/row-level security/, "Você não tem permissão para esta ação."],
  ];
  for (const [re, txt] of mapa) if (re.test(mensagem)) return txt;
  return mensagem;
}
