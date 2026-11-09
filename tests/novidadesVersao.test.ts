import { describe, expect, it } from "vitest";
import { novidadesDesde } from "../src/services/novidades";

const lista = ["0.6.5", "0.6.4", "0.6.3", "0.6.2", "0.6.1"].map((versao) => ({ versao, data: "2026-11-01", itens: [`x ${versao}`] }));

describe("novidadesDesde", () => {
  it("sem registro anterior mostra só a versão instalada", () => {
    expect(novidadesDesde("0.6.5", null, lista).map((e) => e.versao)).toEqual(["0.6.5"]);
  });
  it("mostra as versões entre a última vista e a instalada", () => {
    expect(novidadesDesde("0.6.5", "0.6.3", lista).map((e) => e.versao)).toEqual(["0.6.5", "0.6.4"]);
  });
  it("limita a 3 versões", () => {
    expect(novidadesDesde("0.6.5", "0.6.1", lista).map((e) => e.versao)).toEqual(["0.6.5", "0.6.4", "0.6.3"]);
  });
  it("não mostra de novo a versão já vista nem em downgrade", () => {
    expect(novidadesDesde("0.6.4", "0.6.4", lista)).toEqual([]);
    expect(novidadesDesde("0.6.3", "0.6.5", lista)).toEqual([]);
  });
  it("versão fora do changelog não mostra nada", () => {
    expect(novidadesDesde("9.9.9", "0.6.1", lista)).toEqual([]);
  });
});
