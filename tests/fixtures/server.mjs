// Isolated contract fixtures. These are never packaged into the application.
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as connectSource } from "socket.io-client";
let relayUpdate = null;
let realRelay = null;
if (process.env.WORKSPACE_TEST_DASHBOARD_SOURCE) {
  realRelay = { connected: false, update: null, customers: null, error: null };
  const source = connectSource(process.env.WORKSPACE_TEST_DASHBOARD_SOURCE, { transports: ["polling"], upgrade: false });
  source.on("connect", () => { realRelay.connected = true; realRelay.error = null; });
  source.on("disconnect", () => { realRelay.connected = false; });
  source.on("update", (p) => { realRelay.update = p; realRelay.updateReceivedAt = new Date().toISOString(); });
  source.on("clientes", (p) => { realRelay.customers = p; realRelay.customersReceivedAt = new Date().toISOString(); });
}
const user = {
  id: 1,
  nome: "Pessoa de Teste",
  email: "teste@example.test",
  perfil: "admin",
  empresa_id: 1,
  empresa_nome: "Ambiente de Teste",
  setor_nome: "QA",
};
const contact = {
  id: 2,
  nome: "Colega de Teste",
  email: "colega@example.test",
  status: "online",
};
const group = {
  id: 7,
  nome: "Grupo de Teste",
  tem_acesso: true,
  nao_lidas: 2,
  unreadCount: 2,
};
let unread = 1,
  readEvents = 0;
const events = [];
let expired = false;
let dashboardIo;
let dashboardConnections = 0;
let installationConnections = 0;
let installationRequests = 0;
let dashboardRequests = 0;
const dashboardPayload = () => ({
  atualizado: Date.now(),
  grupos: {
    BAIXA: 2,
    REGULAR: 3,
    ALTA: 1,
    OFFLINE: 0,
    "SUPER TÉCNICO 97": 4,
    "BACKBONE GPON ACESSANET | DAS": 2,
    "COMERCIAL CONTRATAÇÃO": 5,
    ALMOXARIFADO: 3,
  },
  contagens: { vendasEmExecucao: 8 },
  emAndamento: {
    total: 1,
    atualizado: Date.now(),
    desatualizado: false,
    chamados: [
      {
        idOrdemServico: 501,
        protocolo: "QA-501",
        cliente: "Cliente em execução de Teste",
        tecnico: "Técnico de Teste",
        equipe: "Equipe QA",
        tipo: "Manutenção",
        dataAgendamento: new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
        }).format(new Date()),
      },
    ],
  },
});
let messages = [
  {
    id: 10,
    remetente_id: 2,
    remetente_nome: contact.nome,
    mensagem: "Mensagem do ambiente de teste",
    tipo_mensagem: "texto",
    criada_em: new Date().toISOString(),
    conversa_direta_id: 21,
  },
];
const apiServer = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  );
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1:14179");
  if (url.pathname === "/" || url.pathname.endsWith(".html")) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Frontend antigo desligado" }));
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const json = () => {
    try {
      return JSON.parse(body || "{}");
    } catch {
      return {};
    }
  };
  const send = (data, status = 200) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/__test/reset") {
    unread = 1;
    readEvents = 0;
    expired = false;
    events.length = 0;
    messages = messages.filter((m) => m.id === 10);
    group.nao_lidas = 2;
    group.unreadCount = 2;
    send({ ok: true });
    return;
  }
  if (url.pathname === "/__test/state") {
    send({
      readEvents,
      profileWrites,
      events,
      unread,
      sockets: chatIo.sockets.sockets.size,
      dashboardConnections,
      installationConnections,
      installationRequests,
      dashboardRequests,
    });
    return;
  }
  if (url.pathname === "/__test/dashboard") {
    relayUpdate = json();
    dashboardIo?.emit("update", relayUpdate);
    send({ ok: true });
    return;
  }
  if (url.pathname === "/__test/expire") {
    expired = true;
    send({ ok: true });
    return;
  }
  if (url.pathname === "/__test/disconnect") {
    for (const s of chatIo.sockets.sockets.values()) s.conn.close();
    send({ ok: true });
    return;
  }
  if (url.pathname === "/__test/message") {
    const m = {
      id: Date.now(),
      remetente_id: 2,
      usuario_id: 1,
      remetente_nome: contact.nome,
      conversa_id: 21,
      conversa_direta_id: 21,
      mensagem: "Evento recebido em segundo plano",
      tipo_mensagem: "texto",
      criada_em: new Date().toISOString(),
      ...json(),
    };
    messages.push(m);
    unread++;
    chatIo.emit("receive_direct_message", m);
    chatIo.emit("new_direct_message_notification", m);
    send(m);
    return;
  }
  if (url.pathname === "/api/login") {
    const b = json();
    if (b.senha !== "teste-local")
      return send({ error: "Credenciais de teste inválidas." }, 401);
    return send({ token: "test-session-local-only", user });
  }
  if (url.pathname === "/uploads/chat/test.txt") {
    res.setHeader("Content-Type", "text/plain");
    res.end("arquivo de teste local");
    return;
  }
  if (!req.headers.authorization || expired)
    return send({ error: "Sessão expirada." }, 401);
  const p = url.pathname;
  if (p === "/api/integrations/dashboard") return send(realRelay || {
    connected: true,
    update: relayUpdate || dashboardPayload(),
    customers: { total: 1234, ativos: 1000, reduzido: 20, suspensos: 100, cancelados: 114, atualizado: 1792590496708 },
    updateReceivedAt: new Date().toISOString(), customersReceivedAt: new Date().toISOString(), error: null,
  });
  if (p === "/api/me") return send(user);
  // rotas que o app consulta ao abrir (sem elas as consultas voltavam vazias e a tela quebrava)
  if (p === "/api/me/funcoes") return send({ modulos: null });
  if (p === "/api/chamados/avaliacoes/destaques") return send({ itens: [] });
  if (p === "/api/phone/diretorio") return send({ ramais: [] });
  if (p === "/api/profile" && req.method === "PUT") {
    const b = json();
    if (b.email) {
      if (b.senha_atual !== "teste-local") return send({ error: "Senha atual inválida" }, 401);
      if (b.email === "usado@example.test") return send({ error: "Este e-mail já está em uso por outro usuário" }, 409);
      user.email = b.email;
      profileWrites.push({ email: b.email });
    }
    if (b.nova_senha) {
      if (b.senha_atual !== "teste-local") return send({ error: "Senha atual inválida" }, 401);
      profileWrites.push({ senha: b.nova_senha });
    }
    if (b.avatar !== undefined) {
      user.avatar = b.avatar || undefined;
      profileWrites.push({ avatar: b.avatar ? b.avatar.slice(0, 22) : "" });
    }
    return send(user);
  }
  if (p === "/api/integrations/agenda/session" && req.method === "POST") return send({ identificado: true, sessaoToken: "agenda.teste.assinatura" });
  if (p === "/api/me/quick-access")
    return send({
      available: [
        { id: "agenda", children: [] },
        { id: "notas-rapidas" },
        { id: "wiki" },
        { id: "calculadoras-intranet" },
        { id: "teste-conectividade-sites" },
        { id: "diagnostico-conexao-cliente" },
        { id: "controle-operacional" },
      ],
      selected: [],
    });
  if (p === "/api/connectivity/sites")
    return send({
      sites: [
        {
          id: 1,
          name: "Site QA",
          url: "https://example.test",
          isDefault: true,
        },
      ],
      canManage: false,
    });
  if (p === "/api/connectivity/packet-targets")
    return send({
      targets: [
        { id: 1, name: "Destino QA", host: "192.0.2.1", isDefault: true },
      ],
      canManage: false,
    });
  if (p === "/api/network-diagnostics/permissions/me")
    return send({
      access: {
        can_view: true,
        can_run: false,
        can_history: false,
        can_admin: false,
      },
      integrations: {},
    });
  if (p === "/api/network-diagnostics/customers/search")
    return send({
      customers: [
        {
          id: "qa-1",
          name: "Cliente QA Diagnóstico",
          customerId: 901,
          contractId: 101,
          status: "online",
        },
      ],
    });
  if (p === "/api/chat/conversas-diretas")
    return send([
      {
        id: 21,
        usuario_outro_id: 2,
        usuario_outro_nome: contact.nome,
        ultima_mensagem: messages.at(-1).mensagem,
        nao_lidas: unread,
      },
    ]);
  if (p === "/api/chat/usuarios") return send([contact]);
  // Rede (OLT Cloud): um incidente ativo de PON e a lista de clientes afetados.
  if (p === "/api/integrations/olt/incidentes")
    return send({
      configurada: true,
      atualizadoEm: new Date().toISOString(),
      incidentes: [
        { id: "inc-1", tipo: "pon_loss", oltId: "9", olt: "OLT Centro", inicio: new Date(Date.now() - 12 * 60000).toISOString(), descricao: "Perda de sinal na PON", totalDispositivos: 40, dispositivosAtivos: 20, pon: "3", slotPon: "1", cto: "" },
        { id: "inc-2", tipo: "cto_loss", oltId: "9", olt: "OLT Centro", inicio: new Date(Date.now() - 3600000).toISOString(), descricao: "", totalDispositivos: 8, dispositivosAtivos: 8, pon: "", slotPon: "", cto: "CTO 12" },
      ],
    });
  if (p === "/api/integrations/olt/panorama")
    return send({ configurada: true, atualizadoEm: new Date().toISOString(), total: 10446, online: 8782, semEnergia: 1159, loss: 455, totalPons: 377,
      porOlt: [{ olt: "GPON-OLT-MRT-001", semEnergia: 400, loss: 100 }, { olt: "GPON-OLT-SRP-001", semEnergia: 200, loss: 50 }],
      pons: [{ olt: "GPON-OLT-SRP-001", slot: "4", pon: "14", semEnergia: 16, loss: 0 }] });
  if (p === "/api/integrations/olt/incidentes/inc-1/clientes")
    return send({ configurada: true, total: 2, exibidos: 2, clientes: [
      { contrato: "5932", nome: "Maria Teste", serie: "ZTEG0001", ultimaQueda: new Date().toISOString() },
      { contrato: "7001", nome: null, serie: "ZTEG0002", ultimaQueda: null },
    ] });
  if (p === "/api/chat/grupos") return send({ grupos: [group] });
  if (p === "/api/chat/conversa-direta/2")
    return send({ conversa_id: 21, mensagens: messages, pinned_message: null });
  if (p === "/api/chat/grupo/7")
    return send({
      mensagens: [
        {
          ...messages[0],
          mensagem: "Histórico do grupo de teste",
          grupo_id: 7,
        },
      ],
      pinned_message: null,
    });
  if (p === "/api/chat/grupo/7/membros") return send([user, contact]);
  if (p.startsWith("/api/chat/appearance")) return send({});
  if (p === "/api/admin/usuarios")
    return send([user, contact].map((u) => ({ ...u, setor_id: 1, setor_nome: "NOC" })));
  if (p === "/api/admin/workspace/online")
    return send([
      { id: 2, nome: "Colega de Teste", email: "colega@example.test", setor_nome: "NOC", versao: "0.5.16", desde: new Date(Date.now() - 25 * 60000).toISOString(), janelas: 1 },
      { id: 1, nome: "Pessoa de Teste", email: "teste@example.test", setor_nome: "NOC", versao: "0.5.17", desde: new Date().toISOString(), janelas: 2 },
    ]);
  if (p === "/api/admin/setores") return send([{ id: 1, nome: "NOC" }]);
  if (p === "/api/admin/grupos") return send([{ id: 7, nome: "Equipe", total_membros: 2 }]);
  if (p === "/api/chat/upload") {
    if (
      !req.headers["content-type"]?.includes("multipart/form-data") ||
      !body.includes("arquivo")
    )
      return send({ error: "Multipart inválido" }, 400);
    return send({
      url: "/uploads/chat/test.txt",
      nome: "teste.txt",
      mime: "text/plain",
    });
  }
  if (p === "/api/chat/enviar-grupo") {
    return send({
      ...json(),
      id: Date.now(),
      remetente_id: 1,
      criada_em: new Date().toISOString(),
    });
  }
  if (p === "/api/chat/enviar-direto") {
    const m = {
      ...json(),
      id: Date.now(),
      remetente_id: 1,
      conversa_direta_id: 21,
      criada_em: new Date().toISOString(),
    };
    messages.push(m);
    return send(m);
  }
  if (p === "/api/chat/favoritos" && req.method === "PATCH")
    return send(json());
  if (p === "/api/messages/favorites") return send([]);
  return send([]);
});
const chatIo = new Server(apiServer, { cors: { origin: "*" } });
chatIo.use((s, next) =>
  s.handshake.auth.token === "test-session-local-only"
    ? next()
    : next(new Error("Token inválido")),
);
chatIo.on("connection", (s) => {
  for (const event of [
    "user_connect",
    "join_user_groups",
    "join_direct_chat",
    "join_group",
  ])
    s.on(event, (payload) => events.push({ event, payload }));
  // Como o backend real: ao entrar nas salas do usuário, envia o resumo das
  // contratações do site (sala "contratacoes").
  s.on("user_connect", () =>
    s.emit("contratacoes:resumo", {
      conectado: true,
      pendentes: 2,
      atualizadoEm: new Date().toISOString(),
      itens: [
        { id: 12, protocolo: "QA-2026-0012", cliente: "Cliente Contratação QA", plano: "800 Mega", cidade: "Franco da Rocha", criadoEm: new Date(Date.now() - 95 * 60000).toISOString() },
        { id: 11, protocolo: "QA-2026-0011", cliente: "Segundo Pedido QA", plano: "500 Mega", cidade: "Caieiras", criadoEm: new Date(Date.now() - 26 * 3600000).toISOString() },
      ],
    }),
  );
  s.on("mark_conversa_read", () => {
    readEvents++;
    unread = 0;
  });
  s.on("mark_group_read", () => {
    group.nao_lidas = 0;
    group.unreadCount = 0;
  });
  s.on("send_direct_message", (m) =>
    s.emit("receive_direct_message", {
      ...m,
      criada_em: new Date().toISOString(),
    }),
  );
});
apiServer.listen(14179, "127.0.0.1");
const agendaWrites = [];
const profileWrites = [];
const routeQueries = [];
for (const [port, type] of [
  [14180, "agenda"],
  [14181, "instalacao"],
  [14182, "dashboard"],
]) {
  const server = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, x-agenda-session",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") {
      res.end();
      return;
    }
    const p = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
    if (type === "agenda" && p === "/api/__writes") {
      res.end(JSON.stringify(agendaWrites));
      return;
    }
    if (type === "agenda" && p === "/api/__route") {
      res.end(JSON.stringify(routeQueries));
      return;
    }
    if (type === "agenda" && p === "/api/agenda-tecnicos/coordenador-rota") {
      routeQueries.push(Object.fromEntries(new URL(req.url, "http://x").searchParams));
      res.end(JSON.stringify({
        tecnicos: [
          { id: "Técnico de Teste", nome: "Técnico de Teste", regiao: "CAI", status: "Disponível", statusPosicaoGps: "atual" },
          { id: "Outro Técnico", nome: "Outro Técnico", regiao: "FCO", status: "Em atendimento" },
        ],
        chamados: [], rotas: [], pontosFixos: [],
        resumo: {}, gpsTecnicosResumo: {},
        opcoes: { regioes: ["CAI", "FCO"], tecnicos: ["Técnico de Teste", "Outro Técnico"], status: ["Aberta"], motivos: ["OFFLINE"] },
        chamadosSemLocalizacao: [{ id: "9", cliente: "Cliente Sem Local", tecnicoAtualNome: "Outro Técnico" }],
      }));
      return;
    }
    if (type === "agenda" && req.method !== "GET") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        agendaWrites.push({ method: req.method, path: p, session: req.headers["x-agenda-session"] || null, body: raw ? JSON.parse(raw) : null });
        res.end(JSON.stringify({ absences: [], teamColors: [], almocos: [] }));
      });
      return;
    }
    if (type === "instalacao") installationRequests++;
    // The fixture exposes APIs and sockets only. Former hosted frontends are absent.
    if (!p.startsWith("/api/")) {
      res.statusCode = 503;
      res.end(
        JSON.stringify({
          error: "Frontend antigo desligado para validar integração local",
        }),
      );
      return;
    }
    let data = {};
    if (p === "/api/agenda-instalacao/agenda")
      data = {
        data: new URL(req.url, `http://127.0.0.1:${port}`).searchParams.get("data"),
        tecnicos: [{ id: "inst-1", nome: "Técnico Instalação" }],
        items: [{ id: 601, idOrdemServico: 601, tecnico: "Técnico Instalação", cliente: "Cliente Instalação Separada", hora: "10:00", status: "Aberta" }],
      };
    else if (p === "/api/agenda-instalacao/tecnicos")
      data = { tecnicos: [{ id: "inst-1", nome: "Técnico Instalação" }] };
    else if (p === "/api/agenda-instalacao/ausencias")
      data = { absences: [{ technician_id: "inst-1", absence_reason: "ferias" }] };
    else if (p === "/api/agenda-instalacao/almocos")
      data = { almocos: [{ tecnicoId: "inst-1", horaInicio: "13:00", horaFim: "14:00" }] };
    else if (p.endsWith("/technician-absences"))
      data = {
        absences: [
          {
            id: 1,
            technician_id: "Técnico de Teste",
            absence_reason: "folga",
            absence_note: "Fixture local",
          },
        ],
      };
    else if (p.endsWith("/almocos"))
      data = {
        almocos: [
          {
            id: 1,
            tecnicoId: "Técnico de Teste",
            horaInicio: "12:00",
            horaFim: "13:00",
          },
        ],
      };
    else if (p.endsWith("/tecnicos"))
      data = { tecnicos: ["Técnico de Teste", "Outro Técnico"] };
    else if (p.endsWith("/tecnicos-sgp")) data = { podeTrocarTecnico: true };
    res.end(JSON.stringify(data));
  });
  const io = new Server(server, { cors: { origin: "*" } });
  if (type === "dashboard") dashboardIo = io;
  io.on("connection", (s) => {
    if (type === "instalacao") installationConnections++;
    if (type === "dashboard") {
      dashboardConnections++;
      s.emit("update", dashboardPayload());
      s.emit("clientes", {
        total: 1234,
        ativos: 1000,
        reduzido: 20,
        suspensos: 100,
        cancelados: 114,
      });
    }
    s.on("filtrarData", (date) => {
      const items = [
        {
          id: type === "agenda" ? 501 : 502,
          idOrdemServico: type === "agenda" ? 501 : 502,
          tecnico: "Técnico de Teste",
          cliente:
            type === "agenda"
              ? "Cliente de Teste Manutenção"
              : "Cliente de Teste Instalação",
          hora: "09:00",
          status: "Aberta",
          bairro: "Bairro de Teste",
          motivo: type === "agenda" ? "Manutenção" : "Instalação",
          latitude: -23.5,
          longitude: -46.6,
          turnoHorario: "08:00 às 18:00",
        },
      ];
      s.emit("agenda", type === "instalacao" ? { date, items } : items);
    });
    // O dashboard de produção usa push e não implementa request_update.
    s.on("request_update", () => { dashboardRequests++; });
  });
  server.listen(port, "127.0.0.1");
}
console.log("Fixtures locais prontas: 14179–14182");
