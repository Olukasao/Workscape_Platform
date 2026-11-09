import { describe, expect, it } from "vitest";
import { deveEsconder } from "../electron/browserHide";

describe("quem pode esconder a página nativa", () => {
  it("sem página visível, não há o que esconder", () => {
    expect(deveEsconder(null)).toBe(false);
    expect(deveEsconder(null, "agendaweb")).toBe(false);
  });
  it("a agenda web que sai de cena NÃO esconde a página do Navegador que acabou de aparecer", () => {
    expect(deveEsconder("sgp", "agendaweb")).toBe(false);
    expect(deveEsconder("olt", "agendaweb")).toBe(false);
  });
  it("o Navegador que sai de cena NÃO esconde a agenda web", () => {
    expect(deveEsconder("agendaweb", "navegador")).toBe(false);
  });
  it("cada um esconde a sua", () => {
    expect(deveEsconder("agendaweb", "agendaweb")).toBe(true);
    expect(deveEsconder("sgp", "navegador")).toBe(true);
  });
  it("o processo principal (sem escopo) esconde qualquer uma, por exemplo ao recarregar a tela", () => {
    expect(deveEsconder("agendaweb")).toBe(true);
    expect(deveEsconder("sgp")).toBe(true);
  });
});
