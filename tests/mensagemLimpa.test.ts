import { describe, expect, it } from "vitest";
import { mensagemLimpa } from "../src/services/terminal";

describe("mensagem de erro do Terminal", () => {
  it("tira o prefixo técnico do Electron", () => {
    expect(mensagemLimpa(new Error("Error invoking remote method 'terminal:importar-locais': Error: Só administradores podem enviar."))).toBe("Só administradores podem enviar.");
    expect(mensagemLimpa(new Error("Sessão não encontrada."))).toBe("Sessão não encontrada.");
    expect(mensagemLimpa(null)).toBe("Erro inesperado.");
  });
});
