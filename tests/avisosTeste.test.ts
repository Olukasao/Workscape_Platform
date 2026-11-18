import { describe, expect, it, vi } from "vitest";

vi.mock("../src/stores/workspace", () => ({ useNotices: { getState: () => ({ add: () => undefined }) } }));
const { AVISOS_TESTE } = await import("../src/services/avisosTeste");

describe("catálogo do Teste de avisos", () => {
  it("cada aviso tem id único, título, texto e destino interno", () => {
    const ids = AVISOS_TESTE.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of AVISOS_TESTE) {
      expect(a.titulo.length).toBeGreaterThan(3);
      expect(a.corpo.length).toBeGreaterThan(3);
      expect(a.alvo.startsWith("/")).toBe(true);
    }
  });
  it("inclui o aviso de marketing com o texto pedido e a contratação nova", () => {
    expect(AVISOS_TESTE.find((a) => a.id === "marketing-wifi")?.titulo).toBe("Novo Dados de marketing obtidos por wifi-publico!");
    expect(AVISOS_TESTE.some((a) => a.id === "contratacao")).toBe(true);
  });
});
