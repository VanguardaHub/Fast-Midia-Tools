import { describe, expect, it } from "vitest";
import { caminhosParaData, estruturaConfigurada, tokensDaData } from "./drive-estrutura";

describe("estrutura de pastas de ingest (RF-16)", () => {
  it("monta MM NOME e DD-MM a partir da data", () => {
    expect(tokensDaData("2026-10-15")).toEqual({ MES: "10 OUTUBRO", DIA: "15-10" });
    expect(tokensDaData("2026-03-02")).toEqual({ MES: "03 MARÇO", DIA: "02-03" });
  });
  it("caminho de ingest e irmão de vídeos conforme o padrão da Fast Mídia", () => {
    const c = caminhosParaData("2026-10-15");
    expect(c.ingest).toEqual(["!INSTITUCIONAL", "BANCO DE IMAGENS", "10 OUTUBRO", "15-10"]);
    expect(c.extras).toEqual([["!INSTITUCIONAL", "VÍDEOS", "10 OUTUBRO", "15-10"]]);
  });
  it("aceita estrutura configurada e cai no padrão quando inválida", () => {
    const e = estruturaConfigurada(JSON.stringify({ raiz: [], ingest: ["INGEST", "{DIA}"], extras: [] }));
    expect(caminhosParaData("2026-01-05", e).ingest).toEqual(["INGEST", "05-01"]);
    expect(estruturaConfigurada("{nao é json")).toBe(estruturaConfigurada(undefined));
  });
});
