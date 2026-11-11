import { test, expect } from "@playwright/test";

// Teste visual do módulo Atendimento com a chat-api simulada (não depende de servidor real nem de SGP).
const servers = { chat: "http://127.0.0.1:14179", agenda: "http://127.0.0.1:14180", dashboard: "http://127.0.0.1:14182", allowInsecureLan: false, launchAtLogin: false, closeToTray: true, authorizedAgendaGateway: false };

test("Atendimento: fila com SLA, Ficha 360, chamados abertos, supervisão, relatórios e configurações", async ({ page }) => {
  await page.addInitScript((cfg) => {
    localStorage.setItem("workspace-servers-v1", JSON.stringify(cfg));
    const agora = Date.now();
    const conv = (id: number, nome: string, status: string, assigned: number | null) => ({
      id, customerId: `c${id}`, contractId: "3005", ticketId: `${900000 + id}`, assignedAgentId: assigned, status,
      createdAt: new Date(agora - 600000).toISOString(), updatedAt: new Date(agora - 120000).toISOString(), closedAt: null, tags: [],
      ticketMetadata: { customer: { name: nome, phone: "(24) 99999-1234" }, contract: { planName: "700 Mega", city: "Franco" }, ticket: { title: "Sem conexão" } },
    });
    const chamar = async (r: { method: string; path: string; query?: Record<string, string> }) => {
      const p = r.path;
      if (p === "/api/agent/conversations") return { items: [conv(1, "Maria Souza", "new", null), conv(2, "João Lima", "waiting_agent", 3)], nextCursor: null };
      if (p === "/api/agent/auth/me") return { agent: { id: 3, name: "Lucas", role: "admin", attendanceStatus: "AVAILABLE" } };
      if (p === "/api/agent/quick-replies") return { items: [{ id: 1, shortcut: "/boleto", title: "Boleto", body: "Segue a segunda via." }] };
      if (p === "/api/agent/ops/config") return { sectors: [{ id: 1, slug: "suporte", name: "Suporte", active: true, mine: true }, { id: 2, slug: "financeiro", name: "Financeiro", active: true, mine: true }, { id: 3, slug: "comercial", name: "Comercial", active: true, mine: true }], settings: { hours: { timezone: "America/Sao_Paulo", days: [0, 1, 2, 3, 4, 5, 6], start: "07:00", end: "19:00" }, sla: { firstResponseSeconds: 300, warnAtSeconds: 180, replySeconds: 600 }, afterHoursMessage: "Fora do horário.", defaultSectorSlug: "suporte" }, open: true };
      if (p === "/api/agent/ops/sla") return { items: [{ conversationId: 1, sectorId: 1, state: "breached", kind: "first_response", waitingSeconds: 600, targetSeconds: 300 }, { conversationId: 2, sectorId: 2, state: "warning", kind: "reply", waitingSeconds: 420, targetSeconds: 600 }] };
      if (/\/messages$/.test(p) && r.method === "GET") return { items: [{ id: 1, conversationId: 1, senderType: "customer", senderId: "c1", message: "Minha internet caiu.", createdAt: new Date(agora - 600000).toISOString(), readAt: null }], nextCursor: null };
      if (/\/read$/.test(p)) return null;
      if (p === "/api/agent/ops/overview") return { open: true, sla: { firstResponseSeconds: 300, warnAtSeconds: 180, replySeconds: 600 }, bySector: [{ sectorId: 1, name: "Suporte", active: 3, waiting: 2, warning: 1, breached: 1, longestWaitSeconds: 600, agentsOnline: 2 }, { sectorId: 2, name: "Financeiro", active: 1, waiting: 0, warning: 0, breached: 0, longestWaitSeconds: null, agentsOnline: 1 }], agents: [{ id: 3, name: "Lucas", role: "admin", attendanceStatus: "AVAILABLE", sectorIds: [], activeConversations: 1 }], atRisk: [{ conversationId: 1, customerName: "Maria Souza", state: "breached", kind: "first_response", waitingSeconds: 600, sectorId: 1, assignedAgentId: null }] };
      if (p === "/api/agent/ops/reports") return { totals: { created: 12, closed: 9, stillOpen: 3 }, avgFirstResponseSeconds: 210, avgResolutionSeconds: 1800, bySector: [{ sectorId: 1, created: 8, closed: 6, avgFirstResponseSeconds: 200 }], byAgent: [{ agentId: 3, name: "Lucas", handled: 12, closed: 9, avgFirstResponseSeconds: 210 }], byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour >= 8 && hour <= 17 ? hour % 5 + 1 : 0 })), byDay: [], byCloseReason: [{ reason: "resolved", count: 7 }, { reason: "duplicate", count: 2 }], sectors: [{ id: 1, name: "Suporte" }] };
      if (p === "/api/agent/ops/agents") return { agents: [{ id: 3, name: "Lucas", email: "l@x.com", role: "admin", sectorIds: [] }] };
      throw new Error(`rota não simulada: ${r.method} ${p}`);
    };
    (window as any).desktop = {
      getConfig: async () => cfg, getSession: async () => null, saveSession: async () => {}, clearSession: async () => {},
      notify: async () => {}, unread: async () => {}, setZoom: async () => {}, onZoomStep: () => () => {}, onNavigate: () => () => {},
      updateStatus: async () => ({ phase: "idle", currentVersion: "0.6.38", message: "ok" }), onUpdateStatus: () => () => {},
      request: async (r: any) => {
        if (r.path === "/api/clientes/ligacao/contrato/3005") return { status: 200, data: { valido: true, encontrado: true, cliente: { contrato: "3005", nome: "Maria Souza", plano: "700 Mega", cidade: "Franco", situacao: "Ativo", clienteDesde: "2021-03-10", endereco: { linha: "Rua A, 10", bairro: "Centro", cidade: "Franco", uf: "RJ", cep: "", complemento: "", referencia: "", coordenadas: null }, financeiro: { emAberto: 129.9, titulosAReceber: 1, vencimentoDia: 10, promessasMes: 0, isento: false }, conexao: { status: "online", online: true, ultimaQueda: null, onlineDesde: null, sinalOnuDbm: -26.4, sinalOltDbm: -22, modelo: "ONU X", olt: "OLT1", porta: "1/1", leituraEm: null }, historico: { ultimos30Dias: 2, abertos: 1, tempoMedioDias: 1, assuntoMaisComum: { tipo: "Suporte", vezes: 2 }, visitaAgendada: null }, chamados: [{ protocolo: "A1", tipo: "Suporte", metodo: "Telefone", status: "Aberta", abertoEm: "2026-11-10", encerradoEm: "", assunto: "sem conexão" }], totalChamados: 2, ultimaAvaliacao: { nota: 5, comentario: "ótimo", respondidoEm: "2026-11-01", tecnico: "Ana" }, contatos: [{ tipo: "telefone", valor: "(24) 99999-1234" }] } } };
        if (r.path.startsWith("/api/chamados/site")) return { status: 200, data: { items: [{ ticketId: "900001", contractId: "3005", protocol: "261111001", customerName: "Maria Souza", title: "Sem conexão", openedAt: new Date().toISOString(), status: "open", statusLabel: "Aberto" }], page: 1, limit: 100, total: 1, truncated: false } };
        // Agenda/dashboard não existem neste teste: respostas vazias no formato que a interface espera.
        if (r.service !== "chat") return { status: 200, data: { totais: { naoAtendidos: 0 }, items: [] } };
        const response = await fetch((cfg as any)[r.service] + r.path, { method: r.method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + r.token }, body: r.body ? JSON.stringify(r.body) : undefined });
        return { status: response.status, data: await response.json() };
      },
      atendimentoEntrar: async () => ({ agente: { id: 3, name: "Lucas", email: "l@x.com", role: "admin" } }),
      atendimentoEstado: async () => ({ agente: null, conectado: true }),
      atendimentoChamar: async (r: any) => chamar(r),
      atendimentoSair: async () => {}, atendimentoDigitando: async () => {}, atendimentoEntrarNas: async () => {},
      onAtendimento: () => () => {},
      onPhoneEvent: () => () => {}, phoneState: async () => ({ motor: "indisponivel", registro: "desconectado", mensagem: "", ramal: "", chamadas: [], naoPerturbe: false, dispositivos: { capture: [], playback: [] } }),
    };
  }, servers);
  await page.goto("/");
  await page.getByLabel("E-mail corporativo").fill("teste@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no Workspace" }).click();
  // Avisos de novidades podem cobrir a tela (aparecem depois de alguns segundos): fecha os que surgirem.
  for (const nome of ["Entendi", "Agora não"]) await page.getByRole("button", { name: nome, exact: true }).first().click({ timeout: 9000 }).catch(() => undefined);
  await page.getByRole("button", { name: "Atendimento", exact: true }).click();

  // Fila com SLA e setor
  await expect(page.getByText("Maria Souza").first()).toBeVisible();
  await expect(page.locator(".atd-sla.breached")).toBeVisible();
  await expect(page.locator(".atd-sla.warning")).toBeVisible();
  // Conversa + Ficha 360
  await page.locator(".atd-item").first().click();
  await expect(page.getByText("Minha internet caiu.")).toBeVisible();
  await expect(page.getByText("129,90")).toBeVisible();
  await expect(page.getByText(/Sinal da ONU -26.4 dBm/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Ligar/ })).toBeDisabled(); // telefone desconectado neste teste
  await page.screenshot({ path: "test-results/atendimento/1-conversa.png" });
  // Chamados abertos
  await page.getByRole("tab", { name: "Chamados abertos" }).click();
  await expect(page.getByRole("button", { name: "Abrir atendimento" })).toBeVisible();
  await page.screenshot({ path: "test-results/atendimento/2-chamados.png" });
  // Supervisão
  await page.getByRole("tab", { name: "Supervisão" }).click();
  await expect(page.getByRole("heading", { name: "Filas por setor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Em risco \(1\)/ })).toBeVisible();
  await page.screenshot({ path: "test-results/atendimento/3-supervisao.png" });
  // Relatórios
  await page.getByRole("tab", { name: "Relatórios" }).click();
  await expect(page.getByText("conversas criadas")).toBeVisible();
  await page.screenshot({ path: "test-results/atendimento/4-relatorios.png" });
  // Configurações
  await page.getByRole("tab", { name: "Configurações" }).click();
  await expect(page.getByRole("heading", { name: "Metas de SLA" })).toBeVisible();
  await page.screenshot({ path: "test-results/atendimento/5-config.png" });
});
