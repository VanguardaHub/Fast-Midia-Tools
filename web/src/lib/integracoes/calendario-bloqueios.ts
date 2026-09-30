export type Slot = "manha" | "tarde";
export interface JanelaSlots { manha: { inicio: number; fim: number }; tarde: { inicio: number; fim: number } }
export const SLOTS_PADRAO: JanelaSlots = { manha: { inicio: 8, fim: 12 }, tarde: { inicio: 13, fim: 17 } };

export interface IntervaloOcupado {
  fastEmail: string;
  /** ISO com fuso, ou data (YYYY-MM-DD) para evento de dia inteiro */
  inicio: string;
  fim: string;
  diaInteiro?: boolean;
}

export interface Bloqueio { fast_email: string; data: string; slot: Slot }

/** Deslocamento (em horas) do fuso `tz` em relação ao UTC no dia indicado (Manaus/São Paulo não têm horário de verão). */
export function offsetHoras(dataISO: string, tz: string): number {
  const meioDiaUtc = new Date(`${dataISO}T12:00:00Z`);
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false, day: "numeric" }).formatToParts(meioDiaUtc);
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "12") % 24;
  const dia = Number(partes.find((p) => p.type === "day")?.value ?? meioDiaUtc.getUTCDate());
  const ajusteDia = dia === meioDiaUtc.getUTCDate() ? 0 : dia > meioDiaUtc.getUTCDate() || dia === 1 ? 24 : -24;
  return hora + ajusteDia - 12;
}

/** Instante UTC (ms) de `dataISO` às `hora` horas locais no fuso `tz`. */
export function instanteLocal(dataISO: string, hora: number, tz: string): number {
  return Date.parse(`${dataISO}T00:00:00Z`) + (hora - offsetHoras(dataISO, tz)) * 3_600_000;
}

/**
 * RF-10 / RF-62 — converte intervalos ocupados do Google Calendar em bloqueios de slot (Fast × dia × manhã/tarde).
 * Um evento bloqueia o slot quando se sobrepõe à janela do slot no fuso operacional; eventos de dia inteiro
 * bloqueiam os dois slots do dia. Função pura, sem I/O, para ser testada.
 */
export function intervalosParaBloqueios(intervalos: IntervaloOcupado[], dias: string[], slots: JanelaSlots = SLOTS_PADRAO, tz = "America/Manaus"): Bloqueio[] {
  const chaves = new Set<string>();
  const saida: Bloqueio[] = [];
  const adicionar = (email: string, data: string, slot: Slot) => {
    const k = `${email}|${data}|${slot}`;
    if (chaves.has(k)) return;
    chaves.add(k);
    saida.push({ fast_email: email, data, slot });
  };

  for (const it of intervalos) {
    const email = it.fastEmail.toLowerCase();
    if (it.diaInteiro) {
      // fim de evento de dia inteiro é exclusivo (Google): [inicio, fim)
      for (const d of dias) if (d >= it.inicio.slice(0, 10) && d < it.fim.slice(0, 10)) { adicionar(email, d, "manha"); adicionar(email, d, "tarde"); }
      continue;
    }
    const ini = Date.parse(it.inicio);
    const fim = Date.parse(it.fim);
    if (Number.isNaN(ini) || Number.isNaN(fim) || fim <= ini) continue;
    for (const d of dias) {
      for (const slot of ["manha", "tarde"] as Slot[]) {
        const sIni = instanteLocal(d, slots[slot].inicio, tz);
        const sFim = instanteLocal(d, slots[slot].fim, tz);
        if (ini < sFim && fim > sIni) adicionar(email, d, slot);
      }
    }
  }
  return saida;
}
