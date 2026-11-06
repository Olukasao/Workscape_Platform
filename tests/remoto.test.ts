import { describe, expect, it } from "vitest";
import { configuracaoRemoto, idValido } from "../electron/remoto";

describe("suporte remoto", () => {
  it("monta a configuração apontando para o servidor interno", () => {
    const c = configuracaoRemoto("10.0.0.5", "CHAVE=");
    expect(c).toContain("rendezvous_server = '10.0.0.5:21116'");
    expect(c).toContain("relay-server = '10.0.0.5'");
    expect(c).toContain("key = 'CHAVE='");
  });
  it("só aceita IDs numéricos", () => {
    expect(idValido("123456789")).toBe(true);
    expect(idValido("123; calc.exe")).toBe(false);
    expect(idValido("12345")).toBe(false);
  });
});
