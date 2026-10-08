/**
 * RF-16 — estrutura de pastas de ingest no Drive do cliente (Processos 1.3):
 *   pasta do cliente / !INSTITUCIONAL / BANCO DE IMAGENS / "MM NOME" / "DD-MM"   ← pasta de ingest
 *                                     / VÍDEOS           / "MM NOME" / "DD-MM"
 * Função pura: recebe a data do job e devolve os caminhos a garantir. Sem I/O.
 */
export const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

export interface EstruturaDrive {
  /** segmentos fixos a partir da pasta do cliente */
  raiz: string[];
  /** caminho (abaixo da raiz) cuja última pasta é a de ingest; aceita {MES} e {DIA} */
  ingest: string[];
  /** caminhos irmãos a garantir (não retornados), ex.: VÍDEOS/{MES}/{DIA} */
  extras: string[][];
}

export const ESTRUTURA_PADRAO: EstruturaDrive = {
  raiz: ["!INSTITUCIONAL"],
  ingest: ["BANCO DE IMAGENS", "{MES}", "{DIA}"],
  extras: [["VÍDEOS", "{MES}", "{DIA}"]],
};

/** "2026-10-15" → { MES: "10 OUTUBRO", DIA: "15-10" } */
export function tokensDaData(dataISO: string): { MES: string; DIA: string } {
  const [, mm, dd] = dataISO.split("-");
  const m = Number(mm);
  return { MES: `${mm} ${MESES[m - 1] ?? ""}`.trim(), DIA: `${dd}-${mm}` };
}

function aplicar(segmentos: string[], t: { MES: string; DIA: string }): string[] {
  return segmentos.map((s) => s.replace("{MES}", t.MES).replace("{DIA}", t.DIA));
}

/** Caminhos completos (a partir da pasta do cliente) a garantir para a data: o de ingest e os extras. */
export function caminhosParaData(dataISO: string, estrutura: EstruturaDrive = ESTRUTURA_PADRAO): { ingest: string[]; extras: string[][] } {
  const t = tokensDaData(dataISO);
  return {
    ingest: [...estrutura.raiz, ...aplicar(estrutura.ingest, t)],
    extras: estrutura.extras.map((e) => [...estrutura.raiz, ...aplicar(e, t)]),
  };
}

/** Estrutura vinda da variável DRIVE_ESTRUTURA (JSON) ou padrão; inválida cai no padrão. */
export function estruturaConfigurada(json?: string | null): EstruturaDrive {
  if (!json) return ESTRUTURA_PADRAO;
  try {
    const e = JSON.parse(json) as Partial<EstruturaDrive>;
    if (!Array.isArray(e.ingest) || e.ingest.length === 0) return ESTRUTURA_PADRAO;
    return { raiz: Array.isArray(e.raiz) ? e.raiz : [], ingest: e.ingest, extras: Array.isArray(e.extras) ? e.extras : [] };
  } catch {
    return ESTRUTURA_PADRAO;
  }
}
