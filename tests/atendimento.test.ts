import { describe, expect, it, vi } from "vitest";
import { caminhoPermitido, criarAtendimento, pedidoSchema } from "../electron/atendimento";

describe("Atendimento: caminhos permitidos", () => {
  it("aceita as operações do atendente", () => {
    expect(caminhoPermitido("GET", "/api/agent/conversations")).toBe(true);
    expect(caminhoPermitido("POST", "/api/agent/conversations/12/messages")).toBe(true);
    expect(caminhoPermitido("PATCH", "/api/agent/conversations/12/status")).toBe(true);
    expect(caminhoPermitido("GET", "/api/agent/quick-replies")).toBe(true);
  });
  it("recusa o que não é do dia a dia (admin, transferência, exclusão, outras APIs)", () => {
    expect(caminhoPermitido("GET", "/api/agent/admin/agents")).toBe(false);
    expect(caminhoPermitido("POST", "/api/agent/conversations/12/transfer")).toBe(false);
    expect(caminhoPermitido("POST", "/api/agent/campaigns")).toBe(false);
    expect(caminhoPermitido("GET", "/api/agent/conversations/12/../admin")).toBe(false);
    expect(caminhoPermitido("GET", "/api/agent/conversations/abc")).toBe(false);
    expect(caminhoPermitido("POST", "//evil.com/api/agent/conversations")).toBe(false);
  });
  it("valida o formato do pedido", () => {
    expect(() => pedidoSchema.parse({ method: "DELETE", path: "/x" })).toThrow();
    expect(() => pedidoSchema.parse({ method: "GET", path: "/x", extra: 1 })).toThrow();
  });
});

describe("Atendimento: login e chamadas", () => {
  const resp = (status: number, corpo: unknown) => new Response(status === 204 ? null : JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
  const montar = (fetchImpl: typeof fetch) => criarAtendimento({
    apiOrigin: "http://api.test", redirectUri: "http://api.test/", chatOrigin: () => "http://chat.test",
    sessaoChat: async () => "chat-token-123", enviar: () => undefined, fetchImpl,
  });
  const agente = { id: 1, name: "Ana", email: "ana@x.com", role: "agent" };

  it("troca a sessão do chat interno por tokens, sem enviar senha", async () => {
    const f = vi.fn(async (url: URL | string) => {
      const u = String(url);
      if (u.endsWith("/sso/code")) return resp(200, { code: "codigo-de-uso-unico-123" });
      if (u.endsWith("/internal-chat/callback")) return resp(200, { accessToken: "acesso-12345", refreshToken: "refresh-12345", agent: agente });
      return resp(404, {});
    }) as unknown as typeof fetch;
    const a = montar(f);
    const r = await a.entrar();
    expect(r.agente.email).toBe("ana@x.com");
    const corpos = (f as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[1]?.body ?? ""));
    expect(corpos.join("")).not.toMatch(/senha|password/i);
  });

  it("renova o token uma vez ao receber 401 e repete a chamada", async () => {
    let chamadas = 0;
    const f = vi.fn(async (url: URL | string, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/sso/code")) return resp(200, { code: "codigo-de-uso-unico-123" });
      if (u.endsWith("/internal-chat/callback")) return resp(200, { accessToken: "acesso-12345", refreshToken: "refresh-12345", agent: agente });
      if (u.endsWith("/auth/refresh")) return resp(200, { accessToken: "novo-acesso-1", refreshToken: "novo-refresh-1" });
      chamadas++;
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer novo-acesso-1" ? resp(200, { items: [] }) : resp(401, { error: "expired" });
    }) as unknown as typeof fetch;
    const a = montar(f);
    await a.entrar();
    await expect(a.chamar({ method: "GET", path: "/api/agent/conversations" })).resolves.toEqual({ items: [] });
    expect(chamadas).toBe(2);
  });

  it("recusa caminho fora da lista e chamada sem login", async () => {
    const a = montar(vi.fn() as unknown as typeof fetch);
    await expect(a.chamar({ method: "GET", path: "/api/agent/admin/agents" })).rejects.toThrow("não permitida");
    await expect(a.chamar({ method: "GET", path: "/api/agent/conversations" })).rejects.toThrow("desconectado");
  });

  it("mostra o erro do servidor quando não é atendente cadastrado", async () => {
    const f = vi.fn(async (url: URL | string) => (String(url).endsWith("/sso/code") ? resp(200, { code: "codigo-de-uso-unico-123" }) : resp(403, { error: "agent_not_registered" }))) as unknown as typeof fetch;
    await expect(montar(f).entrar()).rejects.toThrow("agent_not_registered");
  });
});
