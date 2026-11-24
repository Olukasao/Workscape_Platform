import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: class {}, session: {} }));
vi.mock("electron-log/main", () => ({ default: { warn: () => {}, info: () => {}, error: () => {} } }));
const { urlDoPainelValida } = await import("../electron/roteadorPainel");

const TOKEN = "ab12".repeat(12);
describe("endereço do painel do roteador", () => {
  it("aceita só o visualizador do agente, no servidor interno", () => {
    expect(urlDoPainelValida(`http://192.168.1.133:8796/v/${TOKEN}`)).toBe(`http://192.168.1.133:8796/v/${TOKEN}`);
  });
  it("recusa outro host, porta, protocolo, caminho, token curto ou dados extras", () => {
    const ruins = [
      `http://192.168.1.134:8796/v/${TOKEN}`, `http://192.168.1.133:8797/v/${TOKEN}`, `https://192.168.1.133:8796/v/${TOKEN}`,
      `http://192.168.1.133:8796/panel/open`, `http://192.168.1.133:8796/v/${TOKEN.slice(1)}`, `http://192.168.1.133:8796/v/${TOKEN}/x`,
      `http://192.168.1.133:8796/v/${TOKEN}?a=1`, `http://u:p@192.168.1.133:8796/v/${TOKEN}`, `http://100.64.1.2:80/`, "file:///etc/passwd", "javascript:alert(1)", "não é url", "",
    ];
    for (const r of ruins) expect(() => urlDoPainelValida(r), r).toThrow();
  });
});
