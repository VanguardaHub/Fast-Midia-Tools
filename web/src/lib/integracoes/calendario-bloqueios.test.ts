import { describe, expect, it } from "vitest";
import { instanteLocal, intervalosParaBloqueios, offsetHoras } from "./calendario-bloqueios";

const dias = ["2026-10-05", "2026-10-06", "2026-10-07"];

describe("fuso operacional", () => {
  it("Manaus é UTC-4 e São Paulo UTC-3 (sem horário de verão)", () => {
    expect(offsetHoras("2026-10-05", "America/Manaus")).toBe(-4);
    expect(offsetHoras("2026-10-05", "America/Sao_Paulo")).toBe(-3);
  });
  it("converte hora local em instante UTC", () => {
    expect(new Date(instanteLocal("2026-10-05", 8, "America/Manaus")).toISOString()).toBe("2026-10-05T12:00:00.000Z");
  });
});

describe("intervalosParaBloqueios (RF-10 / RF-62)", () => {
  it("evento das 9h às 10h locais bloqueia só a manhã", () => {
    const b = intervalosParaBloqueios([{ fastEmail: "d@x.com", inicio: "2026-10-05T09:00:00-04:00", fim: "2026-10-05T10:00:00-04:00" }], dias);
    expect(b).toEqual([{ fast_email: "d@x.com", data: "2026-10-05", slot: "manha" }]);
  });
  it("evento das 11h às 14h bloqueia manhã e tarde", () => {
    const b = intervalosParaBloqueios([{ fastEmail: "d@x.com", inicio: "2026-10-05T11:00:00-04:00", fim: "2026-10-05T14:00:00-04:00" }], dias);
    expect(b.map((x) => x.slot)).toEqual(["manha", "tarde"]);
  });
  it("evento no almoço (12h–13h) não bloqueia nenhum slot", () => {
    const b = intervalosParaBloqueios([{ fastEmail: "d@x.com", inicio: "2026-10-05T12:00:00-04:00", fim: "2026-10-05T13:00:00-04:00" }], dias);
    expect(b).toEqual([]);
  });
  it("evento de dia inteiro bloqueia os dois slots e respeita fim exclusivo", () => {
    const b = intervalosParaBloqueios([{ fastEmail: "D@X.com", inicio: "2026-10-06", fim: "2026-10-07", diaInteiro: true }], dias);
    expect(b).toEqual([
      { fast_email: "d@x.com", data: "2026-10-06", slot: "manha" },
      { fast_email: "d@x.com", data: "2026-10-06", slot: "tarde" },
    ]);
  });
  it("não duplica bloqueios e ignora intervalos inválidos", () => {
    const b = intervalosParaBloqueios([
      { fastEmail: "d@x.com", inicio: "2026-10-05T09:00:00-04:00", fim: "2026-10-05T09:30:00-04:00" },
      { fastEmail: "d@x.com", inicio: "2026-10-05T10:00:00-04:00", fim: "2026-10-05T11:00:00-04:00" },
      { fastEmail: "d@x.com", inicio: "x", fim: "y" },
    ], dias);
    expect(b).toHaveLength(1);
  });
});
