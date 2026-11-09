import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: class {}, session: {}, shell: {} }));
const { tokenValido } = await import("../electron/assinaturasJanela");

describe("login entregue ao gerador de assinaturas", () => {
  it("aceita só um token no formato JWT, de tamanho razoável", () => {
    expect(tokenValido("aaa.bbb_1.ccc-2")).toBe(true);
    for (const ruim of ["", "abc", "a.b", "a.b.c.d", "a b.c.d", "a.b.c'); alert(1);//", 123, null, `${"a".repeat(2000)}.b.c`])
      expect(tokenValido(ruim)).toBe(false);
  });
});
