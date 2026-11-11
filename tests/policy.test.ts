import { describe, it, expect } from "vitest";
import {
  defaultConfig,
  validateConfig,
  resolveRequest,
  isAppSender,
  conversationTarget,
} from "../electron/policy";
const config = {
  ...defaultConfig,
  chat: "https://chat.example.org",
  agenda: "https://agenda.example.org",
};
describe("fronteira Electron", () => {
  it("preenche o Chat Interno corporativo em instalações novas e configurações antigas vazias", () => {
    expect(defaultConfig.chat).toBe("http://192.168.1.133:8600");
    expect(validateConfig(defaultConfig).allowInsecureLan).toBe(false);
    for (const chat of ["", "https://chat.suaempresa.com.br", "https://chat.suaempresa.com.br/"]) {
      expect(validateConfig({ ...defaultConfig, chat }).chat).toBe(defaultConfig.chat);
    }
    expect(validateConfig({ ...defaultConfig, chat: defaultConfig.chat + "/" }).chat).toBe(defaultConfig.chat);
    expect(validateConfig({ ...defaultConfig, chat: "https://chat.personalizado.example.org" }).chat).toBe("https://chat.personalizado.example.org");
  });
  it("permite HTTP corporativo do chat somente na origem e no serviço configurados", () => {
    for (const chat of ["http://192.168.1.133:8601", "http://192.168.1.134:8600", "http://192.168.1.133:8600.evil.example", "http://user:secret@192.168.1.133:8600", "http://192.168.1.133:8600/api"]) {
      expect(() => validateConfig({ ...config, chat })).toThrow();
    }
    expect(() => validateConfig({ ...config, agenda: defaultConfig.chat })).toThrow();
    expect(() => validateConfig({ ...config, dashboard: defaultConfig.chat })).toThrow();
  });
  it("permite somente origens e HTTPS por padrão", () => {
    expect(validateConfig(config).chat).toBe("https://chat.example.org");
    for (const chat of [
      "file:///tmp/",
      "javascript:alert(1)",
      "https://user:secret@example.org",
      "https://example.org/api",
      "https://example.org?token=secret",
      "http://10.0.0.4",
    ])
      expect(() => validateConfig({ ...config, chat })).toThrow();
  });
  it("conecta o Painel NOC corporativo por padrão, sem liberar outros HTTP", () => {
    for (const dashboard of ["http://192.168.1.133", "http://192.168.1.133/", "http://192.168.1.133:80/"]) {
      expect(validateConfig({ ...config, dashboard }).dashboard).toBe(defaultConfig.dashboard);
    }
    expect(defaultConfig.dashboard).toBe("http://192.168.1.133:5000");
    expect(validateConfig({ ...config, dashboard: "" }).dashboard).toBe(
      "http://192.168.1.133:5000",
    );
    expect(
      validateConfig({ ...config, dashboard: "http://192.168.1.133:5000" })
        .dashboard,
    ).toBe("http://192.168.1.133:5000");
    expect(() =>
      validateConfig({ ...config, dashboard: "http://192.168.1.133:5001" }),
    ).toThrow();
    expect(() =>
      validateConfig({ ...config, chat: "http://192.168.1.133:5000" }),
    ).toThrow();
  });
  it("permite HTTP local e exige opção explícita para legado", () => {
    expect(
      validateConfig({ ...config, chat: "http://127.0.0.1:4179" }).chat,
    ).toContain("4179");
    expect(
      validateConfig({
        ...config,
        chat: "http://10.0.0.4",
        allowInsecureLan: true,
      }).chat,
    ).toBe("http://10.0.0.4");
  });
  it("corrige a agenda salva no campo do dashboard e preserva os outros servidores", () => {
    for (const dashboard of ["http://192.168.1.133:8500", "https://192.168.1.133:8500/", " http://192.168.1.133:8500/ "]) {
      for (const allowInsecureLan of [false, true]) {
        const input = { ...config, dashboard, allowInsecureLan };
        const migrated = validateConfig(input);
        expect(migrated.dashboard).toBe("http://192.168.1.133:5000");
        expect(migrated.agenda).toBe(config.agenda);
        expect(migrated.chat).toBe(config.chat);
        expect(input.dashboard).toBe(dashboard);
      }
    }
    expect(validateConfig({ ...config, dashboard: "https://dashboard.personalizado.example.org" }).dashboard)
      .toBe("https://dashboard.personalizado.example.org");
  });
  it("recusa destinos externos, travessia e chaves IPC desconhecidas", () => {
    for (const path of [
      "https://evil.example/api/x",
      "//evil.example/api/x",
      "/api/../../secret",
      "/api/%2e%2e/secret",
      "/api/\\evil",
      "/api/x\r\nAuthorization: secret",
    ])
      expect(() =>
        resolveRequest(config, { service: "chat", path, method: "GET" }),
      ).toThrow();
    expect(() =>
      resolveRequest(config, {
        service: "chat",
        path: "/api/me",
        method: "GET",
        headers: { Host: "evil" },
      }),
    ).toThrow();
  });
  it("permite somente o caminho API configurado", () => {
    expect(
      resolveRequest(config, {
        service: "chat",
        path: "/api/me?x=1",
        method: "GET",
      }).url.href,
    ).toBe("https://chat.example.org/api/me?x=1");
  });
  it("bloqueia mutações de agenda sem gateway autorizado", () => {
    expect(() =>
      resolveRequest(config, {
        service: "agenda",
        path: "/api/agenda-tecnicos/ordens-servico/1/tecnico-responsavel",
        method: "POST",
      }),
    ).toThrow("gateway");
    expect(
      resolveRequest(
        { ...config, authorizedAgendaGateway: true },
        {
          service: "agenda",
          path: "/api/agenda-tecnicos/ordens-servico/1/tecnico-responsavel",
          method: "POST",
        },
      ).r.method,
    ).toBe("POST");
  });
  it("aceita só as escritas conhecidas da agenda quando há sessão do chat", () => {
    const ok = (path: string, method: string, session: string | null = "agenda.x.y") =>
      resolveRequest(config, { service: "agenda", path, method, ...(session ? { agendaSession: session } : {}) });
    expect(ok("/api/technician-absences", "POST").r.method).toBe("POST");
    expect(ok("/api/technician-absences/7/complete", "POST").r.method).toBe("POST");
    expect(ok("/api/technician-team-colors/3", "DELETE").r.method).toBe("DELETE");
    expect(ok("/api/agenda-instalacao/almocos/9", "PUT").r.method).toBe("PUT");
    expect(() => ok("/api/technician-absences", "POST", null)).toThrow("gateway");
    expect(() => ok("/api/agenda-tecnicos/historico", "POST")).toThrow("gateway");
    expect(() => ok("/api/technician-absences/7", "PATCH")).toThrow("gateway");
    expect(() => resolveRequest(config, { service: "dashboard", path: "/api/technician-absences", method: "POST", agendaSession: "agenda.x.y" })).toThrow("gateway");
  });
  it("valida remetentes e destinos das notificações", () => {
    expect(isAppSender("app://workspace/index.html")).toBe(true);
    expect(isAppSender("app://evil/index.html")).toBe(false);
    expect(isAppSender("http://127.0.0.1:5178", false)).toBe(false);
    expect(isAppSender("http://127.0.0.1:5178", true)).toBe(true);
    expect(conversationTarget("/chat?grupo=7")).toBe(true);
    expect(conversationTarget("/atendimento")).toBe(true);
    expect(conversationTarget("/chat?conversa=2")).toBe(true);
    expect(conversationTarget("/chamados?aba=avaliacoes")).toBe(true);
    expect(conversationTarget("/chamados?aba=outra")).toBe(false);
    expect(conversationTarget("/")).toBe(true);
    expect(conversationTarget("/rede")).toBe(true);
    expect(conversationTarget("/rede?x=1")).toBe(false);
    expect(conversationTarget("/contratacoes")).toBe(true);
    expect(conversationTarget("/contratacoes?x=https://evil.example")).toBe(false);
    expect(conversationTarget("https://evil.example")).toBe(false);
    expect(
      conversationTarget("/chat?grupo=7&redirect=https://evil.example"),
    ).toBe(false);
  });
});
