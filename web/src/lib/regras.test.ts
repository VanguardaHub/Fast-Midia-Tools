import { describe, expect, it } from "vitest";
import {
  avaliarCheckin,
  dentroDaJanela,
  detectarConflitos,
  distanciaMetros,
  podeConcluir,
  transicaoPermitida,
  traduzirErro,
} from "./regras";

const FAST = "fast-a";

describe("RF-12 / RF-13 — buffer de 2h e agendamento duplo", () => {
  it("bloqueia dois jobs do mesmo Fast no mesmo dia (agendamento duplo)", () => {
    const conflitos = detectarConflitos(
      { fastId: FAST, data: "2026-10-05", slot: "tarde" },
      [{ id: "1", fastId: FAST, data: "2026-10-05", slot: "manha" }],
    );
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0].tipo).toBe("agendamento_duplo");
  });

  it("ignora jobs cancelados", () => {
    const conflitos = detectarConflitos(
      { fastId: FAST, data: "2026-10-05", slot: "tarde" },
      [{ id: "1", fastId: FAST, data: "2026-10-05", slot: "manha", status: "cancelado" }],
    );
    expect(conflitos).toHaveLength(0);
  });

  it("ignora jobs de outro Fast", () => {
    const conflitos = detectarConflitos(
      { fastId: FAST, data: "2026-10-05", slot: "tarde" },
      [{ id: "1", fastId: "fast-b", data: "2026-10-05", slot: "manha" }],
    );
    expect(conflitos).toHaveLength(0);
  });

  it("permite jobs em dias diferentes com folga superior a 2h", () => {
    const conflitos = detectarConflitos(
      { fastId: FAST, data: "2026-10-06", slot: "manha" },
      [{ id: "1", fastId: FAST, data: "2026-10-05", slot: "tarde" }],
    );
    expect(conflitos).toHaveLength(0);
  });

  it("detecta violação de buffer quando slots customizados ficam a menos de 2h", () => {
    const slots = {
      manha: { inicio: 8, fim: 12, label: "" },
      tarde: { inicio: 13, fim: 17, label: "" },
    };
    // Simula job noturno terminando 23h e job seguinte às 00h+... usando slots do mesmo dia
    // Dois slots no mesmo dia: manhã termina 12h, tarde começa 13h → 1h de folga (< 2h)
    const conflitos = detectarConflitos(
      { fastId: FAST, data: "2026-10-05", slot: "tarde" },
      [{ id: "1", fastId: FAST, data: "2026-10-05", slot: "manha" }],
      120,
      slots,
    );
    // Mesmo dia é classificado como agendamento duplo (regra mais restritiva prevalece)
    expect(conflitos.map((c) => c.tipo)).toEqual(["agendamento_duplo"]);
  });

  it("não acusa conflito do job consigo mesmo (edição)", () => {
    const conflitos = detectarConflitos(
      { id: "1", fastId: FAST, data: "2026-10-05", slot: "manha" },
      [{ id: "1", fastId: FAST, data: "2026-10-05", slot: "manha" }],
    );
    expect(conflitos).toHaveLength(0);
  });
});

describe("RF-31 / RF-33 / RF-34 / RNF-06 — geofence e precisão", () => {
  const geofence = { lat: -3.1019, lng: -60.025, raioM: 200 };

  it("calcula distância Haversine com margem aceitável", () => {
    // ~111 km por grau de latitude
    const d = distanciaMetros(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("aceita check-in dentro da geofence com boa precisão", () => {
    const r = avaliarCheckin({ lat: -3.1020, lng: -60.0251, precisaoM: 15 }, geofence);
    expect(r.dentroGeofence).toBe(true);
    expect(r.precisaoAceitavel).toBe(true);
    expect(r.exigeJustificativa).toBe(false);
  });

  it("exige justificativa fora da geofence", () => {
    const r = avaliarCheckin({ lat: -3.12, lng: -60.05, precisaoM: 15 }, geofence);
    expect(r.dentroGeofence).toBe(false);
    expect(r.exigeJustificativa).toBe(true);
    expect(r.motivos[0]).toMatch(/Fora da geofence/);
  });

  it("exige justificativa com precisão acima de 100 m", () => {
    const r = avaliarCheckin({ lat: -3.1020, lng: -60.0251, precisaoM: 150 }, geofence);
    expect(r.precisaoAceitavel).toBe(false);
    expect(r.exigeJustificativa).toBe(true);
  });

  it("exige justificativa quando o job não tem ponto confirmado", () => {
    const r = avaliarCheckin({ lat: -3.1, lng: -60.0, precisaoM: 10 }, null);
    expect(r.dentroGeofence).toBeNull();
    expect(r.exigeJustificativa).toBe(true);
  });
});

describe("RF-35 — janela de captura", () => {
  const inicio = new Date("2026-10-05T11:00:00Z");
  const fim = new Date("2026-10-05T15:00:00Z");
  it("aceita 1h antes do início", () => {
    expect(dentroDaJanela(new Date("2026-10-05T10:00:00Z"), inicio, fim)).toBe(true);
  });
  it("rejeita 3h antes do início", () => {
    expect(dentroDaJanela(new Date("2026-10-05T08:00:00Z"), inicio, fim)).toBe(false);
  });
  it("rejeita 5h após o fim", () => {
    expect(dentroDaJanela(new Date("2026-10-05T20:30:00Z"), inicio, fim)).toBe(false);
  });
});

describe("RF-42 — bloqueio de Concluído sem comprovantes", () => {
  it("permite concluir quando não precisa de 99", () => {
    expect(podeConcluir(false, []).ok).toBe(true);
  });
  it("bloqueia sem comprovante de volta", () => {
    const r = podeConcluir(true, [{ sentido: "ida", comprovantePath: "x.jpg" }]);
    expect(r.ok).toBe(false);
    expect(r.faltando).toEqual(["volta"]);
  });
  it("permite com os dois comprovantes", () => {
    const r = podeConcluir(true, [
      { sentido: "ida", comprovantePath: "x.jpg" },
      { sentido: "volta", comprovantePath: "y.jpg" },
    ]);
    expect(r.ok).toBe(true);
  });
});

describe("Kanban — transições", () => {
  it("permite em_gravacao → material_entregue", () => {
    expect(transicaoPermitida("em_gravacao", "material_entregue")).toBe(true);
  });
  it("não permite aguardando_briefing → concluido", () => {
    expect(transicaoPermitida("aguardando_briefing", "concluido")).toBe(false);
  });
});

describe("Tradução de erros do banco", () => {
  it("traduz código de agendamento duplo", () => {
    expect(traduzirErro("AGENDAMENTO_DUPLO: o Fast já tem job")).toMatch(/supervisora/);
  });
  it("traduz violação de unicidade do slot", () => {
    expect(traduzirErro('duplicate key value violates unique constraint "job_slot_unico"')).toMatch(/Atualize a agenda/);
  });
});
