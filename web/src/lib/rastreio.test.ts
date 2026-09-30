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
