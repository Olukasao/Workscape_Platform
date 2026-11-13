import { sgpReportKeys, sgpReports } from "./sgpReports";
import { listarChamadosSgp } from "./sgpChamados";
import {
  app,
  autoUpdater as nativeUpdater,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  safeStorage,
  session,
  shell,
  protocol,
  net,
  screen,
  dialog,
  clipboard,
  ClipboardItem,
  type IpcMainInvokeEvent,
} from "electron";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { createWriteStream, existsSync } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  defaultConfig,
  validateConfig,
  resolveRequest,
  isAppSender,
  conversationTarget,
  type ServerConfig,
} from "./policy";
import { resolveExternalUrl, resolveModuleTarget } from "./moduleNavigation";
import { isPinnedAgendaCertificate } from "./agendaTrust";
import { isPinnedUpdateCertificate } from "./updateTrust";
import { showToast, initToasts, closeAllToasts } from "./toast";
import { initDetachedWindows, openDetached, closeDetached, setDetachedOnTop, setDetachedCompact, captureDetachedLayout, closeAllDetached, detachedContents, detachedKindOf, detachedKinds, isDetachedOpen, type DetachedKind } from "./detachedWindows";
import { urlDoEscritorioValida } from "./escritorioDeployment";
import { initBrowserTabs, showBrowser, updateBrowserBounds, hideBrowser, moveBrowserTabs, browserAction, browserOpenUrl, closeBrowserTabs, resetBrowserTabs, setAgendaWebSession, browserSites, isKnownSite, registerCustomSites, type BrowserSite } from "./browserTabs";
import { deleteWorkspace, findWorkspace, listWorkspaces, saveWorkspace, tileLayout, workspaceItemSchema } from "./workspaces";
import { attachContextMenu, configureSpellChecker } from "./contextMenu";
import { startUpdates, consumeSilentRelaunch } from "./updates";
import { createDashboardFeed } from "./dashboardFeed";
import { LocalAi, type LocalAiTask } from "./localAi";
import { deviceInfo } from "./deviceInfo";
import { createPhone } from "./phone";
import { createRemoto } from "./remoto";
import { ServicoTerminal } from "./terminal";
import { nomeParaSalvar } from "./nomeArquivo";
import { conflitoDeRede, corrigirRotaVpn, listarVpns, redeDe, testarPorta, type LinhaTeste } from "./vpn";
import { updateOrigin } from "./updateDeployment";
import { ambienteTeste, nomeDoApp } from "./ambiente";
import { abrirAssinaturas, tokenValido } from "./assinaturasJanela";
import { abrirFicha, fecharFicha, fichaContents, fimDaLigacao } from "./fichaClienteJanela";
import log from "electron-log/main";
import { criarAtendimento } from "./atendimento";
import { atendimentoApiOrigin, atendimentoRedirectUri } from "./atendimentoDeployment";
import { abrirPostit, fecharPostits, postitContents, postitDe } from "./postit";
// App de testes: nome e pasta de dados próprios (não divide sessão, configuração nem trava de instância com o oficial).
if (ambienteTeste) {
  app.setName(nomeDoApp);
  app.setPath("userData", path.join(app.getPath("appData"), nomeDoApp));
}
if (!app.isPackaged && process.env.WORKSPACE_TEST_USER_DATA)
  app.setPath("userData", path.resolve(process.env.WORKSPACE_TEST_USER_DATA));
const dev =
  !app.isPackaged && process.env.WORKSPACE_DEV_URL === "http://127.0.0.1:5178";
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      // Vídeos de Novidades da Home: buffer e avanço no <video>.
      stream: true,
    },
  },
]);
let config: ServerConfig = { ...defaultConfig };
let win: BrowserWindow;
let tray: Tray;
let quitting = false;
let activeTransfers = 0;
/** O cartão do softphone está aberto na tela (avisado pela janela principal): atualização espera ele fechar. */
let telefoneAbertoNaTela = false;
let lastNotification = 0;
let lastNotificationKey = "";
const configPath = () => path.join(app.getPath("userData"), "config.json");
const tokenPath = () => path.join(app.getPath("userData"), "session.enc");
// Cada janela destacada só pode usar os canais de que precisa (nada de ações da janela principal).
const BASE_CHANNELS = ["config:get", "api:request", "session:get", "window:zoom", "detached:status", "detached:close", "detached:pin", "detached:compact"];
const DETACHED_CHANNELS: Record<DetachedKind, Set<string>> = {
  agenda: new Set([...BASE_CHANNELS, "clipboard:write-text", "browser:show", "browser:bounds", "browser:hide", "browser:action", "agenda-web:session"]),
  chat: new Set([...BASE_CHANNELS, "clipboard:write-text", "clipboard:write-image", "asset:download", "localai:status", "localai:complete"]),
  navegador: new Set([...BASE_CHANNELS, "browser:show", "browser:bounds", "browser:hide", "browser:action", "browser:sites"]),
  rede: new Set([...BASE_CHANNELS, "clipboard:write-text"]),
  dashboard: new Set([...BASE_CHANNELS, "dashboard:refresh", "external:open"]),
  resumo: new Set([...BASE_CHANNELS, "dashboard:refresh", "external:open"]),
  terminal: new Set([...BASE_CHANNELS, "clipboard:write-text", "terminal:listar", "terminal:importar-locais", "terminal:salvar", "terminal:excluir", "terminal:esquecer-chave", "terminal:conectar", "terminal:entrada", "terminal:tamanho", "terminal:anti-idle", "terminal:fechar"]),
  // O telefone destacado só mostra e comanda a sessão que vive no processo principal (nunca a desliga).
  telefone: new Set([...BASE_CHANNELS, "phone:state", "phone:connect", "phone:call", "phone:answer", "phone:reject", "phone:hangup", "phone:mute", "phone:hold", "phone:dtmf", "phone:transfer", "phone:dnd", "phone:devices", "phone:set-devices"]),
};
function trusted(e: IpcMainInvokeEvent, channel: string) {
  // Janela da ficha do cliente: só lê configuração/sessão, consulta a API e pede para fechar.
  if (
    e.sender === fichaContents() &&
    e.senderFrame === e.sender.mainFrame &&
    (BASE_CHANNELS.includes(channel) || channel === "ficha:fechar") &&
    isAppSender(e.senderFrame?.url || "", dev)
  )
    return;
  // Post-it (nota rápida em janelinha): só lê sessão/configuração, consulta a API e controla a própria janela.
  if (
    postitContents().includes(e.sender) &&
    e.senderFrame === e.sender.mainFrame &&
    (BASE_CHANNELS.includes(channel) || channel === "postit:fixar" || channel === "postit:fechar") &&
    isAppSender(e.senderFrame?.url || "", dev)
  )
    return;
  const kind = detachedKindOf(e.sender);
  if (
    kind &&
    e.senderFrame === e.sender.mainFrame &&
    DETACHED_CHANNELS[kind].has(channel) &&
    isAppSender(e.senderFrame?.url || "", dev)
  )
    return;
  if (
    e.sender !== win.webContents ||
    e.senderFrame !== win.webContents.mainFrame ||
    !isAppSender(e.senderFrame?.url || "", dev)
  )
    throw new Error("Origem IPC recusada.");
}
function handle(channel: string, cb: (payload: unknown, e: IpcMainInvokeEvent) => unknown) {
  ipcMain.handle(channel, async (e, payload) => {
    trusted(e, channel);
    const transfer = channel === "asset:download" ||
      (channel === "api:request" && payload?.method && payload.method !== "GET");
    if (transfer) activeTransfers++;
    try { return await cb(payload, e); }
    finally { if (transfer) activeTransfers--; }
  });
}
function encryptionAvailable() {
  return (
    safeStorage.isEncryptionAvailable() &&
    (process.platform !== "linux" ||
      safeStorage.getSelectedStorageBackend() !== "basic_text")
  );
}
function csp() {
  const origins = [
    ...new Set(
      Object.values(config).filter(
        (v): v is string => typeof v === "string" && !!v,
      ),
    ),
  ];
  const sockets = origins.map((o) => o.replace(/^http/, "ws"));
  // Mapas da agenda (Coordenador de Rota e Mapa de Chamados): somente imagens
  // dos mesmos provedores usados pela agenda original.
  const mapTiles = [
    "https://*.tile.openstreetmap.org",
    "https://services.arcgisonline.com",
  ];
  return `default-src 'self'; script-src 'self' ${dev && /^[A-Za-z0-9_-]{22}$/.test(process.env.WORKSPACE_CSP_NONCE || "") ? "'nonce-" + process.env.WORKSPACE_CSP_NONCE + "'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${origins.join(" ")} ${mapTiles.join(" ")}; connect-src 'self' ${origins.join(" ")} ${sockets.join(" ")} ${dev ? "ws://127.0.0.1:5178" : ""}; media-src 'self' blob: ${origins.join(" ")}; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
}
async function bootstrap() {
  // Identidade do app no Windows (agrupamento na barra de tarefas).
  if (process.platform === "win32") app.setAppUserModelId("br.com.acessanet.workspace");
  try {
    config = validateConfig(JSON.parse(await readFile(configPath(), "utf8")));
  } catch {}
  // Trust only the exact, independently verified certificate of the existing
  // agenda deployment and of the update channel. All other certificates retain Chromium verification.
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    callback(
      isPinnedAgendaCertificate(
        config.agenda,
        request.hostname,
        request.certificate.data,
      ) ||
        isPinnedUpdateCertificate(request.hostname, request.certificate.data)
        ? 0
        : -3,
    );
  });
  protocol.handle("app", async (request) => {
    const u = new URL(request.url);
    if (u.host !== "workspace")
      return new Response("Forbidden", { status: 403 });
    if (
      u.pathname.startsWith("/uploads/") ||
      u.pathname.startsWith("/sounds/")
    ) {
      if (!config.chat)
        return new Response("Servidor não configurado", { status: 503 });
      return net.fetch(new URL(u.pathname, config.chat).href, {
        redirect: "error",
      });
    }
    const relative =
      decodeURIComponent(u.pathname).replace(/^\//, "") || "index.html";
    const root = path.resolve(app.getAppPath(), "dist");
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep))
      return new Response("Forbidden", { status: 403 });
    const range = request.headers.get("range");
    return net.fetch(
      pathToFileURL(file).href,
      range ? { headers: { range } } : undefined,
    );
  });
  // Notificações, e o microfone só para o próprio app (ditado por voz): nunca a câmera nem outras páginas.
  const microfoneDoApp = (url: string, tipos?: readonly string[]) =>
    isAppSender(url, dev) && (!tipos || (tipos.length > 0 && tipos.every((t) => t === "audio")));
  session.defaultSession.setPermissionRequestHandler((web, permission, callback, details) =>
    callback(
      permission === "notifications" ||
        (permission === "media" && microfoneDoApp(web.getURL(), (details as { mediaTypes?: string[] }).mediaTypes)),
    ),
  );
  session.defaultSession.setPermissionCheckHandler((web, permission, _origin, details) =>
    permission === "notifications" ||
    (permission === "media" && microfoneDoApp(web?.getURL() || details.requestingUrl || "", (details as { mediaType?: string }).mediaType ? [(details as { mediaType?: string }).mediaType as string] : undefined)),
  );
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (isAppSender(details.url, dev))
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [csp()],
        },
      });
    else callback({});
  });
  // Em telas pequenas ou com escala alta a janela padrão não pode passar da área útil (o fundo ficaria fora da tela).
  const area = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1440, area.width),
    height: Math.min(920, area.height),
    minWidth: 800,
    minHeight: 600,
    frame: false,
    show: false,
    backgroundColor: "#f4f7fc",
    icon: path.join(
      app.getAppPath(),
      process.platform === "win32" ? "assets/icon.ico" : "assets/icon.png",
    ),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  configureSpellChecker();
  attachContextMenu(win.webContents);
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !(input.control || input.meta) || input.alt) return;
    const action = ["+", "=", "Add"].includes(input.key) ? "in"
      : ["-", "_", "Subtract"].includes(input.key) ? "out"
      : input.key === "0" || input.code === "Numpad0" ? "reset" : null;
    if (!action) return;
    event.preventDefault();
    win.webContents.send("zoom:step", action);
  });
  win.webContents.on("zoom-changed", (event, direction) => {
    event.preventDefault();
    win.webContents.send("zoom:step", direction);
  });
  const navigateLink = (url: string) => {
    const target = resolveModuleTarget(url, config);
    if (target) {
      win.webContents.send("navigate", target);
      return;
    }
    const external = resolveExternalUrl(url);
    if (external) void shell.openExternal(external);
  };
  win.webContents.on("will-navigate", (e, url) => {
    e.preventDefault();
    navigateLink(url);
  });
  win.webContents.on("will-attach-webview", (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    navigateLink(url);
    return { action: "deny" };
  });
  win.on("ready-to-show", async () => {
    // Depois de uma atualização silenciosa, volta como estava (minimizado ou na bandeja), sem chamar atenção.
    const mode = await consumeSilentRelaunch();
    if (mode === "hidden" && tray) return;
    win.show();
    if (mode === "minimized") win.minimize();
  });
  win.on("close", (e) => {
    if (!quitting && config.closeToTray && tray) {
      e.preventDefault();
      win.hide();
    }
  });
  const icon = nativeImage.createFromPath(
    path.join(
      app.getAppPath(),
      process.platform === "win32" ? "assets/icon.ico" : "assets/icon.png",
    ),
  );
  tray = new Tray(icon);
  tray.setToolTip(nomeDoApp);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Abrir Workspace",
        click: () => {
          win.show();
          win.focus();
        },
      },
      { type: "separator" },
      { label: "Sair", click: () => app.quit() },
    ]),
  );
  tray.on("double-click", () => {
    win.show();
    win.focus();
  });
  // Painel NOC: o processo principal mantém a conexão e repassa os eventos à janela.
  let dashboardRunning = false;
  const dashboardFeed = createDashboardFeed(
    () => config.dashboard,
    (channel, payload) => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    },
  );
  // Workscape Phone: o motor SIP é um processo filho; a senha SIP vai do backend ao motor sem passar pela interface.
  const phoneEngineFile = process.platform === "win32" ? "workscape-phone-engine.exe" : "workscape-phone-engine";
  const phoneEnginePath = (() => {
    const candidato = process.env.WORKSCAPE_PHONE_ENGINE && !app.isPackaged
      ? path.resolve(process.env.WORKSCAPE_PHONE_ENGINE)
      : app.isPackaged ? path.join(process.resourcesPath, "phone", phoneEngineFile) : path.join(app.getAppPath(), "resources", "phone-win-x64", phoneEngineFile);
    return existsSync(candidato) ? candidato : null;
  })();
  const remotoExe = process.platform === "win32"
    ? (app.isPackaged ? path.join(process.resourcesPath, "remote", "rustdesk.exe") : path.join(app.getAppPath(), "resources", "remote-win-x64", "rustdesk.exe"))
    : null;
  const remoto = createRemoto({ exePath: remotoExe, configDir: process.env.APPDATA ? path.join(process.env.APPDATA, "RustDesk", "config") : null });
  const phone = createPhone({
    enginePath: phoneEnginePath,
    gravacaoDir: path.join(app.getPath("userData"), "gravacoes"),
    chatOrigin: () => config.chat,
    send: (event) => {
      if (!win.isDestroyed()) win.webContents.send("phone:event", event);
      const fora = detachedContents("telefone");
      if (fora && !fora.isDestroyed()) fora.send("phone:event", event);
      // Com o Workspace minimizado, na bandeja ou sem foco, a faixa dentro da janela não é vista: avisa pelo canto da tela.
      const segundoPlano = win.isDestroyed() || win.isMinimized() || !win.isVisible() || !win.isFocused();
      if (!segundoPlano) return;
      const abrirCartao = () => {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
        win.webContents.send("phone:event", { type: "abrir" });
      };
      const base = dev ? "http://127.0.0.1:5178" : "app://workspace";
      if (event.type === "incoming") {
        const quem = nomesPorRamal.get(event.call.numero) || event.call.nome;
        showToast(base, { title: "Chamada recebida", body: quem ? `${quem} · Ramal ${event.call.numero || "?"}` : event.call.numero ? `Ramal ${event.call.numero}` : "Número desconhecido", kind: "system", tone: "warn" }, abrirCartao);
        if (process.platform === "win32") win.flashFrame(true);
      } else if (event.type === "history" && event.direcao === "in" && event.resultado === "nao_atendida" && !event.silenciosa) {
        const quem = nomesPorRamal.get(event.numero);
        showToast(base, { title: "Chamada perdida", body: quem ? `${quem} (ramal ${event.numero}) ligou para você` : event.numero ? `Ramal ${event.numero} ligou para você` : "Alguém ligou para você", kind: "system", tone: "crit" }, abrirCartao);
        if (process.platform === "win32") win.flashFrame(true);
      }
    },
    log: (nivel, mensagem) => console[nivel === "info" ? "log" : nivel](`[phone] ${mensagem}`),
  });
  const phoneCall = async (acao: () => unknown) => {
    try { await acao(); return { ok: true as const }; }
    catch (e) { return { ok: false as const, erro: e instanceof Error ? e.message.slice(0, 200) : "Falha no telefone." }; }
  };
  handle("remoto:iniciar", async () => {
    try { const r = await remoto.iniciar(); return { ok: true as const, id: r.id, senha: r.senha }; }
    catch (e) { return { ok: false as const, erro: e instanceof Error ? e.message.slice(0, 200) : "Falha no suporte remoto." }; }
  });
  handle("remoto:reiniciar", async () => {
    try { const r = await remoto.reiniciar(); return { ok: true as const, id: r.id, senha: r.senha }; }
    catch (e) { return { ok: false as const, erro: e instanceof Error ? e.message.slice(0, 200) : "Falha ao reiniciar o suporte remoto." }; }
  });
  handle("remoto:conectar", (payload) => {
    try {
      const { id, senha } = z.object({ id: z.string(), senha: z.string().optional() }).strict().parse(payload);
      remoto.conectar(id, senha);
      return { ok: true as const };
    } catch (e) { return { ok: false as const, erro: e instanceof Error ? e.message.slice(0, 200) : "Falha no suporte remoto." }; }
  });
  handle("phone:state", () => phone.snapshot());
  handle("phone:connect", (payload) => phoneCall(() => phone.conectar(z.object({ token: z.string().min(1).max(16384) }).strict().parse(payload).token)));
  handle("phone:disconnect", () => phoneCall(() => phone.desconectar()));
  handle("phone:call", (payload) => phoneCall(() => phone.ligar(z.object({ numero: z.string().max(40) }).strict().parse(payload).numero)));
  handle("phone:answer", (payload) => phoneCall(() => phone.atender(payload)));
  handle("phone:reject", (payload) => phoneCall(() => phone.rejeitar(payload)));
  handle("phone:hangup", (payload) => phoneCall(() => phone.desligar(payload)));
  handle("phone:mute", (payload) => phoneCall(() => phone.mudo(payload)));
  handle("phone:hold", (payload) => phoneCall(() => phone.espera(payload)));
  handle("phone:dtmf", (payload) => phoneCall(() => phone.dtmf(payload)));
  handle("phone:transfer", (payload) => phoneCall(() => phone.transferir(payload)));
  // Nomes da equipe por ramal, enviados pela interface: servem só para o aviso de chamada no canto da tela.
  const nomesPorRamal = new Map<string, string>();
  handle("phone:diretorio", (payload) => phoneCall(() => {
    const lista = z.array(z.object({ ramal: z.string().regex(/^\d{1,20}$/), nome: z.string().max(100) }).strict()).max(2000).parse(payload);
    nomesPorRamal.clear();
    for (const r of lista) nomesPorRamal.set(r.ramal, r.nome.replace(/[\r\n]/g, " ").trim());
  }));
  handle("phone:dnd", (payload) => phoneCall(() => phone.definirNaoPerturbe(z.object({ on: z.boolean() }).strict().parse(payload).on)));
  handle("phone:devices", () => phoneCall(() => phone.dispositivos()));
  handle("phone:set-devices", (payload) => phoneCall(() => phone.definirDispositivos(payload)));
  handle("phone:diagnostico", () => ({ motor: phoneEnginePath ? path.basename(phoneEnginePath) : null, log: phone.stderrTail() }));
  app.on("before-quit", () => { void phone.parar(); });
  // Terminal SSH/Telnet: a conexão fica aqui; a interface só recebe os bytes e nunca vê senhas salvas.
  const donosTerminal = new Map<string, Electron.WebContents>();
  // Token do login atual, informado pela interface nas ações do Terminal (nada de ler arquivo no meio da ação).
  let tokenTerminalAtual = "";
  const tokenDaSessaoGuardada = async (): Promise<string> => {
    if (!encryptionAvailable()) throw new Error("Armazenamento seguro indisponível neste sistema.");
    try { return JSON.parse(safeStorage.decryptString(await readFile(tokenPath()))).token as string; }
    catch { throw new Error("Sessão não encontrada. Saia e entre de novo no Workspace."); }
  };
  const terminal = new ServicoTerminal(
    (dono) => path.join(app.getPath("userData"), `terminal-equipamentos-${dono.replace(/[^A-Za-z0-9_-]/g, "_")}.json`),
    path.join(app.getPath("userData"), "terminal-chaves.json"),
    {
      disponivel: encryptionAvailable,
      cifrar: (t) => safeStorage.encryptString(t).toString("base64"),
      decifrar: (b) => safeStorage.decryptString(Buffer.from(b, "base64")),
    },
    // Cada sessão responde à janela que a abriu (principal ou Terminal destacado).
    (canal, payload) => {
      const dono = donosTerminal.get((payload as { sessao?: string } | null)?.sessao ?? "");
      const alvo = dono && !dono.isDestroyed() ? dono : win.isDestroyed() ? null : win.webContents;
      alvo?.send(canal, payload);
    },
    // Lista central do servidor: o token do login vem da interface a cada conexão (e, na falta dele, da sessão guardada).
    async (id) => {
      const token = tokenTerminalAtual || (await tokenDaSessaoGuardada());
      const r = await fetch(new URL(`/api/terminal/equipamentos/${encodeURIComponent(id)}/credencial`, config.chat), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(15000) });
      const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) throw new Error(typeof corpo.error === "string" ? corpo.error : "Não foi possível obter o acesso do equipamento.");
      return z.object({ protocolo: z.enum(["ssh", "telnet"]), host: z.string(), porta: z.number().int(), usuario: z.string(), senha: z.string().optional() }).parse(corpo);
    },
  );
  const donoTerminal = z.string().min(1).max(64);
  handle("terminal:listar", (p) => terminal.listar(donoTerminal.parse(p)));
  handle("terminal:salvar", (p) => { const v = z.object({ dono: donoTerminal, equipamento: z.unknown() }).strict().parse(p); return terminal.salvar(v.dono, v.equipamento); });
  handle("terminal:excluir", (p) => { const v = z.object({ dono: donoTerminal, id: z.string().max(64) }).strict().parse(p); return terminal.excluir(v.dono, v.id); });
  handle("terminal:importar-locais", async (p) => {
    const v = z.object({ dono: donoTerminal, token: z.string().min(1).max(16384).optional() }).strict().parse(p);
    if (v.token) tokenTerminalAtual = v.token;
    const lista = await terminal.exportarLocais(v.dono);
    log.info(`Terminal: importação dos equipamentos locais (${lista.length} encontrados)`);
    if (!lista.length) return { novos: 0, atualizados: 0, ignorados: 0, total: 0 };
    const token = tokenTerminalAtual || (await tokenDaSessaoGuardada());
    const r = await fetch(new URL("/api/admin/terminal/importar", config.chat), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ equipamentos: lista }), redirect: "error", signal: AbortSignal.timeout(60000) });
    const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      log.warn(`Terminal: o servidor recusou a importação (HTTP ${r.status}): ${typeof corpo.error === "string" ? corpo.error : "sem detalhe"}`);
      throw new Error(r.status === 403 ? "Só administradores podem enviar equipamentos para a lista de todos." : typeof corpo.error === "string" ? corpo.error : `O servidor recusou a importação (HTTP ${r.status}).`);
    }
    return { ...corpo, total: lista.length };
  });
  handle("terminal:esquecer-chave", (p) => { const v = z.object({ host: z.string().max(253), porta: z.number().int().min(1).max(65535) }).strict().parse(p); return terminal.esquecerChave(v.host, v.porta); });
  handle("terminal:conectar", (p, e) => {
    const v = z.object({ dono: donoTerminal, conexao: z.unknown(), token: z.string().min(1).max(16384).optional() }).strict().parse(p);
    if (v.token) tokenTerminalAtual = v.token;
    const sessao = (v.conexao as { sessao?: unknown } | null)?.sessao;
    if (typeof sessao === "string") donosTerminal.set(sessao, e.sender);
    return terminal.conectar(v.dono, v.conexao);
  });
  handle("terminal:entrada", (p) => { const v = z.object({ sessao: z.string().max(64), dados: z.string().max(65536) }).strict().parse(p); terminal.entrada(v.sessao, v.dados); });
  handle("terminal:tamanho", (p) => { const v = z.object({ sessao: z.string().max(64), cols: z.number().int().min(10).max(500), rows: z.number().int().min(2).max(200) }).strict().parse(p); terminal.tamanho(v.sessao, v.cols, v.rows); });
  handle("terminal:anti-idle", (p) => { const v = z.object({ sessao: z.string().max(64), config: z.unknown() }).strict().parse(p); terminal.configurarAntiIdle(v.sessao, v.config); });
  handle("terminal:fechar", (p) => { const sessao = z.object({ sessao: z.string().max(64) }).strict().parse(p).sessao; terminal.fechar(sessao); donosTerminal.delete(sessao); });
  app.on("before-quit", () => terminal.fecharTodas());
  // Diagnóstico de conexão (útil pela VPN): testa a porta de cada servidor e confere a VPN do Windows.
  const alvos = () => [
    ["Chat, IA e lembretes", config.chat], ["Agenda técnica", config.agenda], ["Dashboard", config.dashboard], ["Atualizações do app", updateOrigin],
  ].filter((x): x is [string, string] => !!x[1]);
  handle("vpn:testar", async () => {
    const linhas: LinhaTeste[] = await Promise.all(alvos().map(async ([servico, url]) => {
      const u = new URL(url);
      const porta = Number(u.port) || (u.protocol === "https:" ? 443 : 80);
      return { servico, host: u.hostname, porta, ...(await testarPorta(u.hostname, porta)) };
    }));
    const rede = redeDe(new URL(config.chat).hostname);
    const vpns = await listarVpns(rede).catch(() => []);
    return { linhas, rede, vpns, conflito: rede ? conflitoDeRede(rede) : null, windows: process.platform === "win32" };
  });
  handle("vpn:corrigir", async () => {
    const rede = redeDe(new URL(config.chat).hostname);
    if (!rede) return { ok: false, mensagem: "O servidor do chat não está numa rede interna conhecida.", corrigidas: [], jaTinham: [] };
    return corrigirRotaVpn(rede).catch((e: Error) => ({ ok: false, mensagem: e.message || "Não foi possível corrigir a VPN.", corrigidas: [], jaTinham: [] }));
  });
  handle("dashboard:start", () => { dashboardRunning = true; dashboardFeed.start(); });
  handle("dashboard:stop", () => { dashboardRunning = false; dashboardFeed.stop(); });
  handle("dashboard:refresh", () => dashboardFeed.refresh());
  app.on("before-quit", () => { dashboardFeed.stop(); closeBrowserTabs(); closeAllDetached(); });
  handle("config:get", () => config);
  handle("config:save", async (payload) => {
    const next = validateConfig(payload);
    await rm(tokenPath(), { force: true });
    closeAllDetached();
    await writeFile(configPath(), JSON.stringify(next, null, 2), {
      mode: 0o600,
    });
    const dashboardMudou = config.dashboard !== next.dashboard;
    config = next;
    if (dashboardMudou && dashboardRunning) dashboardFeed.start();
    if (process.platform === "win32")
      app.setLoginItemSettings({ openAtLogin: config.launchAtLogin });
    return config;
  });
  handle("api:request", async (payload) => {
    const { r, url } = resolveRequest(config, payload);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (r.token) headers.Authorization = `Bearer ${r.token}`;
    if (r.service === "agenda" && r.agendaSession) headers["x-agenda-session"] = r.agendaSession;
    let body: string | FormData | undefined;
    if (r.files) {
      body = new FormData();
      let size = 0;
      for (const f of r.files) {
        size += f.bytes?.byteLength || f.value?.length || 0;
        if (size > 750 * 1024 * 1024)
          throw new Error("Arquivo excede o limite do backend.");
        if (f.bytes)
          body.append(
            f.name,
            new Blob([new Uint8Array(f.bytes)], { type: f.type }),
            f.filename || "arquivo",
          );
        else body.append(f.name, f.value || "");
      }
    } else if (r.body !== undefined) {
      body = JSON.stringify(r.body);
      headers["Content-Type"] = "application/json";
    }
    const requestOptions = {
      method: r.method,
      headers,
      body,
      redirect: "error" as const,
      signal: AbortSignal.timeout(r.files ? 180000 : 30000),
    };
    // Agenda e relay do dashboard usam a rede Chromium. O relay evita o
    // acesso direto do desktop à porta 5000 e às bibliotecas WebSocket do Node.
    const response =
      r.service === "agenda" || (r.service === "chat" && url.pathname === "/api/integrations/dashboard")
        ? await net.fetch(url.href, requestOptions)
        : await fetch(url, requestOptions);
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: "Resposta inválida do servidor." };
    }
    return { status: response.status, data };
  });
  handle("asset:download", async (payload, e) => {
    const value = z
      .object({
        url: z.string().max(4096),
        name: z.string().max(300),
        token: z.string().max(16384).optional(),
      })
      .strict()
      .parse(payload);
    if (!config.chat) throw new Error("Servidor não configurado.");
    const url = new URL(value.url, config.chat);
    if (
      url.origin !== new URL(config.chat).origin ||
      !url.pathname.startsWith("/uploads/") ||
      url.username ||
      url.password
    )
      throw new Error("Arquivo fora do servidor autorizado.");
    // Pede o arquivo antes de abrir o diálogo: o tipo informado pelo servidor completa a extensão quando o nome não tem.
    const response = await fetch(url, {
      headers: value.token ? { Authorization: `Bearer ${value.token}` } : {},
      redirect: "error",
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok || !response.body)
      throw new Error("Não foi possível baixar o arquivo.");
    const nome = nomeParaSalvar(value.name, url.pathname, response.headers.get("content-type"));
    const ext = path.extname(nome).replace(/^\./, "");
    const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender) ?? win, {
      title: "Salvar arquivo",
      defaultPath: path.join(app.getPath("downloads"), nome),
      // O filtro faz o Windows manter a extensão mesmo que a pessoa apague ou troque o nome.
      filters: ext
        ? [{ name: `Arquivo ${ext.toUpperCase()}`, extensions: [ext] }, { name: "Todos os arquivos", extensions: ["*"] }]
        : [{ name: "Todos os arquivos", extensions: ["*"] }],
    });
    if (result.canceled || !result.filePath) {
      void response.body.cancel().catch(() => undefined);
      return false;
    }
    const temporary = result.filePath + ".workspace-part";
    let size = 0;
    try {
      await pipeline(
        Readable.fromWeb(response.body as never),
        new Transform({
          transform(chunk, _encoding, callback) {
            size += chunk.length;
            callback(
              size > 750 * 1024 * 1024
                ? new Error("Arquivo excede o limite.")
                : null,
              chunk,
            );
          },
        }),
        createWriteStream(temporary, { mode: 0o600 }),
      );
      const { rename } = await import("node:fs/promises");
      await rename(temporary, result.filePath);
      return true;
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  });
  handle("session:save", async (payload) => {
    const value = z
      .object({ token: z.string().min(1).max(16384) })
      .strict()
      .parse(payload);
    if (!encryptionAvailable())
      throw new Error("Armazenamento seguro indisponível neste sistema.");
    await writeFile(
      tokenPath(),
      safeStorage.encryptString(
        JSON.stringify({ token: value.token, origin: config.chat }),
      ),
      { mode: 0o600 },
    );
  });
  handle("session:get", async () => {
    if (!encryptionAvailable()) return null;
    try {
      const v = JSON.parse(
        safeStorage.decryptString(await readFile(tokenPath())),
      );
      return v.origin === config.chat ? { token: v.token } : null;
    } catch {
      return null;
    }
  });
  // Gerador de assinaturas de e-mail: janela própria do Workspace; o login do chat vai direto para ela, sem passar por URL.
  handle("assinaturas:abrir", async (payload) => {
    const { token } = z.object({ token: z.string().max(2000) }).strict().parse(payload);
    if (!tokenValido(token)) throw new Error("Entre no Workspace de novo para abrir o gerador de assinaturas.");
    await abrirAssinaturas(config.chat, token);
    return { ok: true as const };
  });
  // Ficha do cliente na ligação: a janela principal avisa quando uma ligação externa começa e quando termina.
  handle("ficha:abrir", async (payload) => {
    const v = z.object({ numero: z.string().min(1).max(40), nome: z.string().max(80), direcao: z.enum(["in", "out"]), estado: z.enum(["tocando", "chamando", "conversando"]), atendidaMs: z.number().int().positive().nullable() }).strict().parse(payload);
    await abrirFicha(v, { base: detachedBase, preload: path.join(__dirname, "preload.cjs"), icon: path.join(app.getAppPath(), process.platform === "win32" ? "assets/icon.ico" : "assets/icon.png") });
    return { ok: true as const };
  });
  // Atendimento (chat com clientes): login, tokens e tempo real ficam aqui; a interface só recebe os dados.
  const atendimento = criarAtendimento({
    apiOrigin: atendimentoApiOrigin,
    redirectUri: atendimentoRedirectUri,
    chatOrigin: () => config.chat,
    sessaoChat: async () => {
      if (!encryptionAvailable()) throw new Error("Armazenamento seguro indisponível neste sistema.");
      return JSON.parse(safeStorage.decryptString(await readFile(tokenPath()))).token as string;
    },
    enviar: (canal, payload) => { if (!win.isDestroyed()) win.webContents.send(canal, payload); },
  });
  handle("atendimento:entrar", () => atendimento.entrar());
  handle("atendimento:estado", () => atendimento.estado());
  handle("atendimento:chamar", (p) => atendimento.chamar(p));
  handle("atendimento:sair", () => atendimento.sair());
  handle("atendimento:digitando", (p) => { const v = z.object({ conversationId: z.number().int().positive(), ligado: z.boolean() }).strict().parse(p); atendimento.digitando(v.conversationId, v.ligado); });
  handle("atendimento:entrar-nas", (p) => { const v = z.object({ ids: z.array(z.number().int().positive()).max(200) }).strict().parse(p); atendimento.entrarNas(v.ids); });
  app.on("before-quit", () => { void atendimento.sair(); });
  handle("postit:abrir", async (payload) => {
    const v = z.object({ id: z.number().int().positive() }).strict().parse(payload);
    await abrirPostit(v.id, { base: detachedBase, preload: path.join(__dirname, "preload.cjs"), icon: path.join(app.getAppPath(), process.platform === "win32" ? "assets/icon.ico" : "assets/icon.png") });
    return { ok: true as const };
  });
  handle("postit:fixar", (payload, e) => { const v = z.object({ ligado: z.boolean() }).strict().parse(payload); postitDe(e.sender)?.setAlwaysOnTop(v.ligado, v.ligado ? "floating" : "normal"); });
  handle("postit:fechar", (_p, e) => { postitDe(e.sender)?.close(); });
  app.on("before-quit", () => fecharPostits());
  handle("ficha:fim", () => { fimDaLigacao(); return { ok: true as const }; });
  handle("ficha:fechar", () => { fecharFicha(); return { ok: true as const }; });
  app.on("before-quit", () => fecharFicha());
  handle("session:clear", async () => {
    void atendimento.sair();
    fecharFicha();
    fecharPostits();
    await rm(tokenPath(), { force: true });
    await resetBrowserTabs();
    closeAllDetached();
  });
  handle("window:zoom", (payload, e) => {
    const percent = z.number().finite().min(50).max(200).parse(payload);
    // Cada janela (principal ou da agenda) aplica o zoom em si mesma.
    e.sender.setZoomFactor(percent / 100);
  });
  handle("window:action", (payload) => {
    switch (
      z.enum(["minimize", "maximize", "close", "reload"]).parse(payload)
    ) {
      case "minimize":
        win.minimize();
        break;
      case "maximize":
        win.isMaximized() ? win.unmaximize() : win.maximize();
        break;
      case "close":
        win.close();
        break;
      case "reload":
        win.reload();
        break;
    }
  });
  initToasts();
  initBrowserTabs(win, () => config.agenda);
  const detachedBase = dev ? "http://127.0.0.1:5178" : "app://workspace";
  const kindSchema = z.enum(detachedKinds);
  initDetachedWindows(
    (kind, open) => {
      if (!win.isDestroyed()) win.webContents.send("detached:state", { kind, open });
    },
    // O Navegador devolve as páginas abertas à janela principal antes de a janela destacada fechar.
    (kind, closing) => {
      // Sessões do Terminal abertas na janela destacada acabam junto com ela.
      if (kind === "terminal") for (const [sessao, dono] of donosTerminal) if (dono === closing.webContents) { terminal.fechar(sessao); donosTerminal.delete(sessao); }
      // Páginas abertas (Navegador ou versão web da agenda) voltam à janela principal antes de a destacada fechar.
      moveBrowserTabs(win, closing);
    },
  );
  handle("detached:status", (payload) => ({ open: isDetachedOpen(kindSchema.parse(payload)) }));
  handle("detached:open", async (payload) => {
    const v = z
      .object({ kind: kindSchema, search: z.string().max(300).regex(/^\??[A-Za-z0-9_=&%.\-]*$/).optional() })
      .strict()
      .parse(payload);
    await openDetached(v.kind, {
      base: detachedBase,
      preload: path.join(__dirname, "preload.cjs"),
      icon: path.join(app.getAppPath(), process.platform === "win32" ? "assets/icon.ico" : "assets/icon.png"),
      search: v.search,
    });
  });
  handle("detached:close", (payload, e) => {
    const v = z.object({ kind: kindSchema, reintegrar: z.boolean() }).strict().parse(payload);
    // Uma janela destacada só fecha a si mesma.
    const own = detachedKindOf(e.sender);
    if (own && own !== v.kind) throw new Error("Origem IPC recusada.");
    closeDetached(v.kind);
    if (v.reintegrar && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.webContents.send("navigate", `/${v.kind}`);
    }
  });
  handle("detached:pin", (payload, e) => {
    const v = z.object({ kind: kindSchema, ligado: z.boolean() }).strict().parse(payload);
    // Cada janela só controla a si mesma.
    const own = detachedKindOf(e.sender);
    if (own !== v.kind) throw new Error("Origem IPC recusada.");
    setDetachedOnTop(v.kind, v.ligado);
  });
  handle("detached:compact", (payload, e) => {
    const v = z.object({ kind: kindSchema, compacto: z.boolean() }).strict().parse(payload);
    if (detachedKindOf(e.sender) !== v.kind) throw new Error("Origem IPC recusada.");
    setDetachedCompact(v.kind, v.compacto);
  });
  // ---- Workspaces personalizados (só a janela principal gerencia) ----
  const ownerSchema = z.string().min(1).max(64);
  const abrirItens = async (items: z.infer<typeof workspaceItemSchema>[]) => {
    for (const it of items) {
      await openDetached(it.kind, {
        base: detachedBase,
        preload: path.join(__dirname, "preload.cjs"),
        icon: path.join(app.getAppPath(), process.platform === "win32" ? "assets/icon.ico" : "assets/icon.png"),
        bounds: { x: it.x, y: it.y, width: it.width, height: it.height },
        pinned: it.pinned,
        compact: it.compact,
      });
    }
  };
  handle("workspaces:list", async (payload) => ({ lista: await listWorkspaces(ownerSchema.parse(payload)), abertas: captureDetachedLayout() }));
  handle("workspaces:save", async (payload) => {
    const v = z.object({ owner: ownerSchema, name: z.string().trim().min(1).max(60), items: z.array(workspaceItemSchema).min(1).max(detachedKinds.length).optional() }).strict().parse(payload);
    // Sem itens informados, guarda exatamente a disposição das janelas abertas agora.
    const items = v.items ?? captureDetachedLayout();
    if (!items.length) throw new Error("Abra ao menos um painel em janela própria antes de salvar.");
    return saveWorkspace(v.owner, v.name, items);
  });
  handle("workspaces:delete", async (payload) => {
    const v = z.object({ owner: ownerSchema, id: z.string().min(1).max(64) }).strict().parse(payload);
    await deleteWorkspace(v.owner, v.id);
  });
  handle("workspaces:open", async (payload) => {
    const v = z.object({ owner: ownerSchema, id: z.string().min(1).max(64) }).strict().parse(payload);
    const w = await findWorkspace(v.owner, v.id);
    if (!w) throw new Error("Workspace não encontrado.");
    // Se a tela onde foi salvo não existe mais, redistribui na tela principal.
    const visivel = (it: (typeof w.items)[number]) => screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return Math.min(it.x + it.width, a.x + a.width) - Math.max(it.x, a.x) >= 120 && Math.min(it.y + it.height, a.y + a.height) - Math.max(it.y, a.y) >= 80;
    });
    await abrirItens(w.items.every(visivel) ? w.items : tileLayout(w.items.map((i) => i.kind), { pinned: w.items[0].pinned, compact: w.items[0].compact }).map((t, i) => ({ ...t, pinned: w.items[i].pinned, compact: w.items[i].compact })));
  });
  handle("workspaces:tile", async (payload) => {
    const v = z.object({ kinds: z.array(kindSchema).min(1).max(detachedKinds.length), pinned: z.boolean(), compact: z.boolean() }).strict().parse(payload);
    const kinds = [...new Set(v.kinds)];
    await abrirItens(tileLayout(kinds, { pinned: v.pinned, compact: v.compact }));
    return captureDetachedLayout();
  });
  handle("workspaces:close-all", () => { closeAllDetached(); });
  const siteSchema = z.string().refine(isKnownSite, "Site desconhecido.").transform((s) => s as BrowserSite);
  // Sites extras cadastrados pelo administrador: a tela manda a lista que veio do servidor; o endereço é revalidado aqui.
  handle("browser:sites", (payload) => {
    const lista = z.array(z.object({ id: z.string().max(20), label: z.string().max(30), url: z.string().max(300) }).strict()).max(30).parse(payload);
    registerCustomSites(lista);
    return { ok: true as const };
  });
  const boundsSchema = z.object({ x: z.number().finite(), y: z.number().finite(), width: z.number().finite().min(0), height: z.number().finite().min(0) }).strict();
  // O Navegador pode estar na janela principal ou na destacada: tudo é relativo à janela que chamou.
  const callerWindow = (e: IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender);
  handle("browser:show", (payload, e) => {
    const v = z.object({ site: siteSchema, bounds: boundsSchema }).strict().parse(payload);
    showBrowser(v.site, v.bounds, callerWindow(e));
  });
  handle("browser:bounds", (payload, e) => updateBrowserBounds(boundsSchema.parse(payload), callerWindow(e)));
  handle("browser:hide", (payload, e) => hideBrowser(callerWindow(e), z.object({ somente: z.enum(["agendaweb", "escritorio", "navegador"]).optional() }).strict().optional().parse(payload)?.somente));
  handle("agenda-web:session", async (payload) => {
    const v = z.object({ token: z.string().max(4096) }).strict().parse(payload);
    await setAgendaWebSession(v.token);
  });
  // Abre uma página do SGP dentro do Navegador do Workspace (aba SGP), em vez do navegador do computador.
  handle("browser:open-sgp", (payload) => {
    const url = new URL(z.string().url().max(2048).parse(payload));
    if (url.hostname !== "acessanet.sgp.net.br" || url.protocol !== "https:" || url.username || url.password)
      throw new Error("Link fora do domínio do SGP.");
    browserOpenUrl("sgp", url.href);
  });
  // Escritório: carrega o endereço de login único (bilhete de uso único) na visão nativa do Escritório.
  handle("escritorio:abrir", (payload) => {
    const url = urlDoEscritorioValida(z.string().max(2048).parse(payload));
    if (!url) throw new Error("Endereço fora do Escritório.");
    browserOpenUrl("escritorio", url);
  });
  handle("browser:action", (payload) => {
    const v = z.object({ site: siteSchema, action: z.enum(["back", "forward", "reload", "home", "go", "zoomIn", "zoomOut", "zoomReset"]), value: z.string().max(2048).optional() }).strict().parse(payload);
    browserAction(v.site, v.action, v.value);
  });
  // Alarme de lembrete: traz a janela para a frente (mesmo minimizada ou na bandeja) e pisca na barra de tarefas.
  handle("alarm:attention", () => {
    if (win.isMinimized()) win.restore();
    win.show();
    if (process.platform === "win32") win.flashFrame(true);
  });
  handle("notification:show", (payload) => {
    const n = z
      .object({
        title: z.string().max(120),
        body: z.string().max(500),
        target: z.string().refine(conversationTarget),
        sender: z.string().max(120).optional(),
        context: z.string().max(120).optional(),
        kind: z.enum(["direct", "group", "system"]).optional(),
        tone: z.enum(["crit", "warn", "info"]).optional(),
        size: z.enum(["normal", "grande"]).optional(),
        // Miniatura da foto de quem enviou, já reduzida pela interface.
        avatar: z
          .string()
          .max(40000)
          .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
          .optional(),
      })
      .strict()
      .parse(payload);
    // Evita rajada idêntica (mesmo evento entregue duas vezes).
    const key = `${n.target}|${n.body}`;
    if (key === lastNotificationKey && Date.now() - lastNotification < 1500)
      return;
    lastNotification = Date.now();
    lastNotificationKey = key;
    // Pop-up próprio no canto inferior direito, inclusive com o app na bandeja.
    showToast(
      dev ? "http://127.0.0.1:5178" : "app://workspace",
      {
        title: n.title,
        body: n.body,
        sender: n.sender,
        context: n.context,
        kind: n.kind,
        tone: n.tone,
        size: n.size,
        avatar: n.avatar,
      },
      () => {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
        win.webContents.send("navigate", n.target);
      },
    );
    if (process.platform === "win32" && !win.isFocused()) win.flashFrame(true);
  });
  // O renderizador escolhe apenas uma chave; a URL (fixa, HTTPS) só existe aqui.
  handle("external:open", async (payload) => {
    const key = z.enum(["painel-contratacoes", ...sgpReportKeys]).parse(payload);
    await shell.openExternal(
      key === "painel-contratacoes"
        ? "https://acessanet.com.br/admin/contratacoes"
        : sgpReports[key],
    );
  });
  handle("sgp:listar-chamados", async (payload) => {
    const key = z.enum(sgpReportKeys).parse(payload);
    return listarChamadosSgp(sgpReports[key]);
  });
  // Link de uma linha lida da própria tabela do SGP: só abre se continuar no domínio do SGP.
  handle("external:open-sgp-link", async (payload) => {
    const value = z.string().url().max(2048).parse(payload);
    const url = new URL(value);
    if (url.hostname !== "acessanet.sgp.net.br" || url.protocol !== "https:")
      throw new Error("Link fora do domínio do SGP.");
    await shell.openExternal(url.href);
  });
  // Copia uma imagem (PNG) para a área de transferência: o renderizador converte e manda os bytes.
  handle("clipboard:write-image", async (payload) => {
    const bytes = z.instanceof(Uint8Array).refine((b) => b.byteLength > 0 && b.byteLength <= 40 * 1024 * 1024).parse(payload);
    const png = Buffer.from(bytes);
    if (nativeImage.createFromBuffer(png).isEmpty()) throw new Error("Não foi possível ler a imagem.");
    await clipboard.write([new ClipboardItem({ "image/png": new Blob([png], { type: "image/png" }) })]);
  });
  handle("clipboard:write-text", (payload) => {
    const text = z.string().min(1).max(1_000_000).parse(payload);
    clipboard.writeText(text);
    return true;
  });
  handle("unread:set", (payload) => {
    const total = z.number().int().min(0).max(1000000).parse(payload);
    app.setBadgeCount(total);
    tray.setToolTip(
      total ? `${nomeDoApp} · ${total} não lidas` : nomeDoApp,
    );
    win.setTitle(total ? `(${total}) ${nomeDoApp}` : nomeDoApp);
    if (process.platform === "win32")
      win.setOverlayIcon(
        total ? icon : null,
        total ? `${total} mensagens não lidas` : "",
      );
  });
  const updates = await startUpdates(win, () => { closeAllToasts(); }, () => activeTransfers === 0 && !phone.temChamadaAtiva() && !telefoneAbertoNaTela && !isDetachedOpen("telefone"));
  win.webContents.on("did-start-loading", () => { telefoneAbertoNaTela = false; hideBrowser(win); }); // recarregou: a tela avisa de novo se o cartão estiver aberto
  // A tela principal recarregou ou caiu: a página nativa (Navegador/agenda web) não pode ficar solta por cima do app novo.
  win.webContents.on("render-process-gone", () => hideBrowser(win));
  handle("phone:ui", (payload) => { telefoneAbertoNaTela = z.object({ aberto: z.boolean() }).strict().parse(payload).aberto; return { ok: true as const }; });
  handle("updates:status", () => updates.status());
  handle("device:info", () => deviceInfo());
  handle("updates:check", () => updates.check());
  handle("updates:install", () => updates.install());
  // IA local (resumo de chamados / ajuda no chat): nada do texto sai do PC.
  const localAi = new LocalAi((value) => { if (!win.isDestroyed()) win.webContents.send("localai:status", value); });
  app.on("before-quit", () => localAi.stop());
  handle("localai:status", () => localAi.getStatus());
  handle("localai:complete", async (payload) => {
    const v = z
      .object({
        task: z.enum(["resumo-chamado", "chat-resumir", "chat-reescrever", "chat-sugerir", "resumo-dia", "corrigir-texto", "explicar-erro"]),
        texto: z.string().min(1).max(20000),
      })
      .strict()
      .parse(payload);
    return localAi.complete(v.task as LocalAiTask, v.texto);
  });
  handle("localai:chat", async (payload) => {
    const v = z
      .object({
        mensagens: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }).strict())
          .min(1)
          .max(40),
      })
      .strict()
      .parse(payload);
    return localAi.chat(v.mensagens);
  });
  if (await updates.startup()) return;
  await win.loadURL(
    dev ? "http://127.0.0.1:5178" : "app://workspace/index.html",
  );
}
// The installer invokes the already installed executable with this argument.
// A second instance forwards it to the primary instance (including tray mode).
// With no app running the helper exits without opening a window or loading data.
const quitForUpdate = process.argv.includes("--quit-for-update");
if (!app.requestSingleInstanceLock() || quitForUpdate) app.quit();
else {
  app.on("second-instance", (_event, argv) => {
    if (argv.includes("--quit-for-update")) {
      quitting = true;
      app.quit();
      return;
    }
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  app
    .whenReady()
    .then(bootstrap)
    .catch((e) => {
      console.error(e.message);
      app.exit(1);
    });
  nativeUpdater.on("before-quit-for-update", () => { quitting = true; closeAllToasts(); });
  app.on("before-quit", () => {
    closeAllToasts();
    quitting = true;
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    win?.show();
  });
}
