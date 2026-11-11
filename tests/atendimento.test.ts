import { describe, expect, it, vi } from "vitest";
import { caminhoPermitido, criarAtendimento, pedidoSchema } from "../electron/atendimento";

describe("Atendimento: caminhos permitidos", () => {
  it("aceita as operações do atendente", () => {
    expect(caminhoPermitido("GET", "/api/agent/conversations")).toBe(true);
    expect(caminhoPermitido("POST", "/api/agent/conversations/12/messages")).toBe(true);
    expect(caminhoPermitido("PATCH", "/api/agent/conversations/12/status")).toBe(true);
    expect(caminhoPermitido("GET", "/api/agent/quick-replies")).toBe(true);
    expect(caminhoPermitido("POST", "/api/agent/conversations/start-from-ticket")).toBe(true);
    expect(caminhoPermitido("GET", "/api/agent/ops/overview")).toBe(true);
    expect(caminhoPermitido("PUT", "/api/agent/ops/conversations/5/sector")).toBe(true);
    expect(caminhoPermitido("PUT", "/api/agent/ops/settings")).toBe(true);
    expect(caminhoPermitido("DELETE", "/api/agent/ops/settings")).toBe(false);
    expect(caminhoPermitido("PATCH", "/api/agent/users/me/status")).toBe(true);
    // Mudar o status de OUTRO atendente não é exposto.
    expect(caminhoPermitido("PATCH", "/api/agent/users/7/status")).toBe(false);
    expect(caminhoPermitido("GET", "/api/agent/ops/other")).toBe(false);
    expect(caminhoPermitido("GET", "/api/agent/ops/candidates")).toBe(true);
    expect(caminhoPermitido("GET", "/api/agent/ops/transfer-targets")).toBe(true);
    expect(caminhoPermitido("PUT", "/api/agent/ops/agents/3/queue")).toBe(true);
    expect(caminhoPermitido("DELETE", "/api/agent/ops/agents/3/queue")).toBe(false);
    expect(caminhoPermitido("POST", "/api/agent/ops/agents")).toBe(true);
    expect(caminhoPermitido("PATCH", "/api/agent/ops/agents/9")).toBe(true);
    // O cadastro direto da chat-api (que pede senha) não é exposto: o Workspace só usa as rotas de /ops.
    expect(caminhoPermitido("POST", "/api/agent/admin/agents")).toBe(false);
    // O caminho antigo por CPF não é exposto à interface.
    expect(caminhoPermitido("POST", "/api/agent/conversations/start")).toBe(false);
  });
  it("recusa o que não é do dia a dia (admin, transferência, exclusão, outras APIs)", () => {
    expect(caminhoPermitido("GET", "/api/agent/admin/agents")).toBe(false);
    expect(caminhoPermitido("POST", "/api/agent/conversations/12/transfer")).toBe(true); // a chat-api só aceita supervisor/admin
    expect(caminhoPermitido("PATCH", "/api/agent/conversations/12/tags")).toBe(true);
    expect(caminhoPermitido("POST", "/api/agent/conversations/12/archive")).toBe(true);
    expect(caminhoPermitido("DELETE", "/api/agent/conversations/12")).toBe(false); // excluir conversa não é exposto
    // Telas do painel
    expect(caminhoPermitido("GET", "/api/agent/monitoring/overview")).toBe(true);
    expect(caminhoPermitido("GET", "/api/agent/sales")).toBe(true);
    expect(caminhoPermitido("POST", "/api/agent/campaigns/abc-123/send")).toBe(true);
    expect(caminhoPermitido("DELETE", "/api/agent/macros/m1")).toBe(true);
    expect(caminhoPermitido("PATCH", "/api/agent/automations/a1")).toBe(true);
    expect(caminhoPermitido("DELETE", "/api/agent/campaigns/c1")).toBe(false); // campanha não se apaga, cancela
    expect(caminhoPermitido("POST", "/api/agent/conversations/start")).toBe(false); // início por CPF não é exposto
    expect(caminhoPermitido("PATCH", "/api/agent/users/5/role")).toBe(false); // mudar cargo só pelas rotas de /ops
    expect(caminhoPermitido("GET", "/api/agent/macros/../admin/agents")).toBe(false);
    expect(caminhoPermitido("POST", "/api/agent/conversations/12/delete")).toBe(false);
    // Campanhas agora são parte das telas do painel; quem pode criar/enviar é decidido pelo cargo, no servidor.
    expect(caminhoPermitido("POST", "/api/agent/campaigns")).toBe(true);
    expect(caminhoPermitido("POST", "/api/agent/campaigns/9/transfer")).toBe(false);
    expect(caminhoPermitido("GET", "/api/agent/conversations/12/../admin")).toBe(false);
    expect(caminhoPermitido("GET", "/api/agent/conversations/abc")).toBe(false);
    expect(caminhoPermitido("POST", "//evil.com/api/agent/conversations")).toBe(false);
  });
  it("valida o formato do pedido", () => {
    expect(() => pedidoSchema.parse({ method: "OPTIONS", path: "/x" })).toThrow();
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
