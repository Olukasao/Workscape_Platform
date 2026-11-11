import { describe, expect, it } from "vitest";
import { atualizacoesDaSemana, inicioDaSemana } from "../src/services/atualizacoesSemana";

const lista = [
  { versao: "3", data: "2026-11-11", itens: [] },
  { versao: "2", data: "2026-11-09", itens: [] },
  { versao: "1", data: "2026-11-08", itens: [] },
];

describe("atualizações da semana", () => {
  it("a semana começa na segunda-feira", () => {
    expect(inicioDaSemana("2026-11-11")).toBe("2026-11-09");
    expect(inicioDaSemana("2026-11-09")).toBe("2026-11-09");
    expect(inicioDaSemana("2026-11-15")).toBe("2026-11-09");
  });
  it("conta só as versões da semana atual", () => {
    expect(atualizacoesDaSemana("2026-11-11", lista)).toMatchObject({ total: 2, versoes: ["3", "2"] });
    expect(atualizacoesDaSemana("2026-11-08", lista).total).toBe(1);
  });
});
