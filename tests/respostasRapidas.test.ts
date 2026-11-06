import { describe, expect, it } from "vitest";
import { expansaoPara } from "../src/services/respostasRapidas";

const r = [{ nome: "bomdia", texto: "Bom dia! Como posso ajudar?" }];
describe("respostas rápidas", () => {
  it("troca /nome no fim do texto", () => {
    expect(expansaoPara("/bomdia", r)).toEqual({ inicio: 0, texto: r[0].texto });
    expect(expansaoPara("Oi, /BomDia", r)).toEqual({ inicio: 4, texto: r[0].texto });
  });
  it("não troca no meio de palavra, endereço ou nome desconhecido", () => {
    expect(expansaoPara("http://x/bomdia", r)).toBeNull();
    expect(expansaoPara("/outro", r)).toBeNull();
    expect(expansaoPara("bomdia", r)).toBeNull();
  });
});
