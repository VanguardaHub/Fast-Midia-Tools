import { describe, expect, it } from "vitest";
import { deveEnviarPosicao, posicaoDesatualizada, type Posicao } from "./rastreio";

const base: Posicao = { lat: -3.119, lng: -60.0217, precisaoM: 12, capturadoEm: "2026-09-30T14:00:00.000Z" };
const depois = (s: number, extra: Partial<Posicao> = {}): Posicao => ({ ...base, capturadoEm: new Date(Date.parse(base.capturadoEm) + s * 1000).toISOString(), ...extra });

describe("deveEnviarPosicao (RF-38, minimização de dados)", () => {
  it("envia a primeira leitura precisa", () => {
    expect(deveEnviarPosicao(null, base)).toBe(true);
  });
  it("nunca envia leitura com precisão pior que o limite", () => {
    expect(deveEnviarPosicao(null, { ...base, precisaoM: 500 })).toBe(false);
  });
  it("respeita o intervalo mínimo mesmo com deslocamento", () => {
    expect(deveEnviarPosicao(base, depois(10, { lat: -3.125 }))).toBe(false);
  });
  it("envia após o intervalo quando houve deslocamento relevante", () => {
    expect(deveEnviarPosicao(base, depois(31, { lat: -3.1195 }))).toBe(true); // ~55 m
  });
  it("parado: só envia sinal de vida a cada 4 intervalos", () => {
    expect(deveEnviarPosicao(base, depois(31))).toBe(false);
    expect(deveEnviarPosicao(base, depois(121))).toBe(true);
  });
});

describe("posicaoDesatualizada", () => {
  it("considera desatualizada após 3 intervalos", () => {
    const agora = Date.parse(base.capturadoEm);
    expect(posicaoDesatualizada(base.capturadoEm, 30_000, agora + 60_000)).toBe(false);
    expect(posicaoDesatualizada(base.capturadoEm, 30_000, agora + 100_000)).toBe(true);
  });
});

describe("acompanhamento ao vivo (RF-51): rumo, resumo da trilha e ETA", async () => {
  const { rumoGraus, resumoTrilha, etaSegundos, fmtDistancia, fmtDuracao } = await import("./rastreio");
  const p = (lat: number, lng: number, s: number) => ({ lat, lng, capturadoEm: new Date(Date.parse(base.capturadoEm) + s * 1000).toISOString() });

  it("rumo: norte = 0°, leste ≈ 90°, sul = 180°", () => {
    expect(Math.round(rumoGraus({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }))).toBe(0);
    expect(Math.round(rumoGraus({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }))).toBe(90);
    expect(Math.round(rumoGraus({ lat: 1, lng: 0 }, { lat: 0, lng: 0 }))).toBe(180);
  });
  it("trilha com um ponto não tem distância nem velocidade", () => {
    expect(resumoTrilha([p(-3.119, -60.0217, 0)])).toEqual({ distanciaM: 0, duracaoS: 0, velocidadeMs: null, emMovimento: false });
  });
  it("soma os trechos e calcula a velocidade recente (≈1 km em 10 min = 1,67 m/s)", () => {
    const r = resumoTrilha([p(-3.119, -60.0217, 0), p(-3.1235, -60.0217, 300), p(-3.128, -60.0217, 600)], 600);
    expect(r.distanciaM).toBeGreaterThan(950);
    expect(r.distanciaM).toBeLessThan(1050);
    expect(r.duracaoS).toBe(600);
    expect(r.velocidadeMs).toBeCloseTo(1.67, 1);
    expect(r.emMovimento).toBe(true);
  });
  it("parado no cliente: velocidade recente ~0 e sem ETA", () => {
    const r = resumoTrilha([p(-3.119, -60.0217, 0), p(-3.119, -60.0217, 30), p(-3.119, -60.02171, 60)]);
    expect(r.emMovimento).toBe(false);
    expect(etaSegundos(500, r.velocidadeMs)).toBeNull();
  });
  it("ETA = distância ÷ velocidade", () => {
    expect(etaSegundos(600, 2)).toBe(300);
  });
  it("formata distância e duração em pt-BR", () => {
    expect(fmtDistancia(850)).toBe("850 m");
    expect(fmtDistancia(2340)).toBe("2,3 km");
    expect(fmtDuracao(45)).toBe("45 s");
    expect(fmtDuracao(240)).toBe("4 min");
    expect(fmtDuracao(3900)).toBe("1 h 05");
  });
});
