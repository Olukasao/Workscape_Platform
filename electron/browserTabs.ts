import { deveEsconder, type EscopoEsconder } from "./browserHide";
import { BrowserWindow, session, shell, WebContentsView } from "electron";
import { agendaOrigin } from "./agendaDeployment";
import { escritorioOrigin } from "./escritorioDeployment";
import { isPinnedAgendaCertificate } from "./agendaTrust";

// Aba "Navegador": cada site fica em sua própria visão nativa, numa sessão isolada
// (sem acesso ao login, à API ou ao IPC do Workspace). Trocar de aba do Workspace só
// esconde a visão; ela continua viva até ficar muito tempo parada.
export const browserSites = {
  sgp: { label: "SGP", url: "https://acessanet.sgp.net.br/accounts/login?next=/admin/" },
  mundiale: { label: "Mundiale", url: "https://account.withub.ai/" },
  olt: { label: "OLT", url: "https://acessanet.oltcloud.co/dashboards/home" },
  callcenter: { label: "Call Center", url: "https://login-acessanet.vipsolutions.com.br/callcenter" },
  zabbix: { label: "Zabbix", url: "http://192.168.1.160/zabbix.php?action=dashboard.view&dashboardid=1" },
  grafana: { label: "Grafana", url: "http://192.168.1.160:3000/login" },
  comum: { label: "Navegador comum", url: "https://www.google.com/" },
  // Agenda original (versão web) dentro do app: não aparece nos atalhos do Navegador; abre pelo botão "Versão web" da agenda.
  agendaweb: { label: "Agenda (versão web)", url: agendaOrigin },
  // Escritório (Office 3D) dentro do app: só abre pelo item Escritório do menu, com login único; não aparece nos atalhos do Navegador.
  escritorio: { label: "Escritório", url: escritorioOrigin },
} as const;
export type BuiltinSite = keyof typeof browserSites;
/** Sites padrão do app mais os extras que o administrador cadastrou (ids "site-<número>"). */
export type BrowserSite = BuiltinSite | `site-${number}`;
const customSites = new Map<string, { label: string; url: string }>();
export const isKnownSite = (site: string): site is BrowserSite => site in browserSites || customSites.has(site);
const siteUrl = (site: BrowserSite) => (site in browserSites ? browserSites[site as BuiltinSite].url : customSites.get(site)?.url ?? "about:blank");
/** Troca a lista de sites extras (vinda do servidor). Só aceita http/https; sites que saíram da lista são descarregados. */
export function registerCustomSites(list: { id: string; label: string; url: string }[]) {
  const next = new Map<string, { label: string; url: string }>();
  for (const s of list.slice(0, 30)) {
    const url = parseWebUrl(String(s.url ?? ""));
    if (/^site-\d{1,9}$/.test(String(s.id)) && url) next.set(s.id, { label: String(s.label).slice(0, 30), url });
  }
  for (const id of [...customSites.keys()]) {
    if (next.get(id)?.url !== customSites.get(id)?.url) { unload(id as BrowserSite); entries.delete(id as BrowserSite); }
  }
  customSites.clear();
  for (const [id, v] of next) customSites.set(id, v);
}
export type BrowserState = {
  site: BrowserSite;
  url: string;
  title: string;
  loading: boolean;
  canBack: boolean;
  canForward: boolean;
  zoom: number; // em porcentagem
};
type Bounds = { x: number; y: number; width: number; height: number };
type Entry = { view: WebContentsView | null; lastUrl: string; hiddenAt: number; zoom: number; host: BrowserWindow | null };
const ZOOM_STEPS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300];

const PARTITION = "persist:navegador";
/** Zoom padrão de cada site (%): a agenda em versão web abre em 75%; os demais em 100%. */
const defaultZoom = (site: BrowserSite) => (site === "agendaweb" ? 75 : 100);
// A versão web da agenda tem sessão própria (cookies e dados separados dos sites do Navegador) e aceita
// somente o certificado fixado do servidor da agenda.
const AGENDA_WEB_PARTITION = "persist:agenda-web";
// O Escritório também tem sessão própria (cookie do Escritório separado dos sites do Navegador).
const ESCRITORIO_PARTITION = "persist:escritorio";
const partitionOf = (site: BrowserSite) => (site === "agendaweb" ? AGENDA_WEB_PARTITION : site === "escritorio" ? ESCRITORIO_PARTITION : PARTITION);
/** Sites que só podem navegar dentro da própria origem (links para fora vão para o navegador do sistema). */
const restrictedOrigin = (site: BrowserSite): string | null => (site === "agendaweb" ? agendaOrigin : site === "escritorio" ? escritorioOrigin : null);
let agendaOriginProvider: () => string = () => "";
const AGENDA_COOKIE = "agenda_chat_session";
const IDLE_UNLOAD_MS = 30 * 60 * 1000;
const entries = new Map<BrowserSite, Entry>();
// Janela principal; as páginas ficam na janela que estiver mostrando o Navegador (principal ou destacada).
let mainHost: BrowserWindow | null = null;
let current: BrowserSite | null = null;
let lastBounds: Bounds | null = null;
let sweeper: NodeJS.Timeout | undefined;

export function parseWebUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text) && !text.includes(".")) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}
export const searchUrl = (text: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(text.trim())}`;

function entry(site: BrowserSite) {
  let e = entries.get(site);
  if (!e) {
    e = { view: null, lastUrl: siteUrl(site), hiddenAt: Date.now(), zoom: defaultZoom(site), host: null };
    entries.set(site, e);
  }
  return e;
}
function send(site: BrowserSite) {
  const e = entries.get(site);
  const wc = e?.view?.webContents;
  const host = e?.host ?? mainHost;
  if (!host || host.isDestroyed() || !e) return;
  const state: BrowserState = {
    site,
    url: wc && !wc.isDestroyed() ? wc.getURL() || e.lastUrl : e.lastUrl,
    title: wc && !wc.isDestroyed() ? wc.getTitle() : "",
    loading: !!wc && !wc.isDestroyed() && wc.isLoading(),
    canBack: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoBack(),
    canForward: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoForward(),
    zoom: e.zoom,
  };
  host.webContents.send("browser:state", state);
}
function applyBounds(site: BrowserSite) {
  const e = entries.get(site);
  const host = e?.host;
  if (!host || host.isDestroyed() || !e?.view || !lastBounds) return;
  // As medidas vêm em pixels CSS; com zoom do aplicativo precisam virar pixels da janela.
  const z = host.webContents.getZoomFactor();
  e.view.setBounds({
    x: Math.round(lastBounds.x * z),
    y: Math.round(lastBounds.y * z),
    width: Math.max(0, Math.round(lastBounds.width * z)),
    height: Math.max(0, Math.round(lastBounds.height * z)),
  });
}
function stepZoom(site: BrowserSite, dir: "in" | "out" | "reset") {
  const e = entries.get(site);
  const wc = e?.view?.webContents;
  if (!e || !wc || wc.isDestroyed()) return;
  if (dir === "reset") e.zoom = defaultZoom(site);
  else {
    const i = ZOOM_STEPS.findIndex((z) => z >= e.zoom);
    const at = ZOOM_STEPS[i < 0 ? ZOOM_STEPS.length - 1 : i];
    const idx = ZOOM_STEPS.indexOf(at) + (dir === "in" ? (at > e.zoom ? 0 : 1) : (at < e.zoom ? 0 : -1));
    e.zoom = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, idx))];
  }
  wc.setZoomFactor(e.zoom / 100);
  send(site);
}
function create(site: BrowserSite, host: BrowserWindow) {
  const e = entry(site);
  e.host = host;
  const view = new WebContentsView({
    webPreferences: {
      session: session.fromPartition(partitionOf(site)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  const wc = view.webContents;
  // Só http/https; popups e links "nova janela" abrem na própria visão.
  const onlyAgenda = restrictedOrigin(site) !== null;
  const sameOrigin = (url: string) => { try { return new URL(url).origin === restrictedOrigin(site); } catch { return false; } };
  const guard = (event: Electron.Event, url: string) => {
    const safe = parseWebUrl(url);
    if (!safe || (onlyAgenda && !sameOrigin(safe))) {
      event.preventDefault();
      if (/^(mailto|tel):/i.test(url) || (safe && onlyAgenda)) void shell.openExternal(safe ?? url);
    }
  };
  wc.on("will-navigate", guard);
  wc.on("will-redirect", guard);
  wc.setWindowOpenHandler(({ url }) => {
    const safe = parseWebUrl(url);
    // Na versão web da agenda, janelas da própria agenda abrem aqui; links para outros sites vão para o navegador do sistema.
    if (safe && (!onlyAgenda || sameOrigin(safe))) void wc.loadURL(safe);
    else if (safe) void shell.openExternal(safe);
    return { action: "deny" };
  });
  wc.on("will-attach-webview", (ev) => ev.preventDefault());
  // Zoom da página: Ctrl +, Ctrl -, Ctrl 0 e Ctrl + roda do mouse. Cada site guarda o seu.
  wc.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !(input.control || input.meta) || input.alt) return;
    const dir = ["+", "=", "Add"].includes(input.key) ? "in"
      : ["-", "_", "Subtract"].includes(input.key) ? "out"
      : input.key === "0" || input.code === "Numpad0" ? "reset" : null;
    if (!dir) return;
    event.preventDefault();
    stepZoom(site, dir);
  });
  wc.on("zoom-changed" as never, ((event: Electron.Event, direction: "in" | "out") => {
    event.preventDefault();
    stepZoom(site, direction);
  }) as never);
  // A página nova (ou recarregada) herda o zoom escolhido para este site.
  wc.on("did-finish-load", () => {
    if (!wc.isDestroyed()) wc.setZoomFactor(e.zoom / 100);
  });
  for (const ev of [
    "did-navigate",
    "did-navigate-in-page",
    "page-title-updated",
    "did-start-loading",
    "did-stop-loading",
  ] as const)
    wc.on(ev as never, () => {
      if (!wc.isDestroyed()) {
        e.lastUrl = wc.getURL() || e.lastUrl;
        send(site);
      }
    });
  e.view = view;
  host.contentView.addChildView(view);
  void wc.loadURL(e.lastUrl).catch(() => undefined);
  return view;
}
function unload(site: BrowserSite) {
  const e = entries.get(site);
  if (!e?.view) return;
  if (e.host && !e.host.isDestroyed()) e.host.contentView.removeChildView(e.view);
  if (!e.view.webContents.isDestroyed()) e.view.webContents.close();
  e.view = null;
}

export function initBrowserTabs(win: BrowserWindow, getAgendaOrigin: () => string) {
  mainHost = win;
  agendaOriginProvider = getAgendaOrigin;
  for (const name of [PARTITION, AGENDA_WEB_PARTITION, ESCRITORIO_PARTITION]) {
    session.fromPartition(name).setPermissionRequestHandler((_w, _p, cb) => cb(false));
    session.fromPartition(name).setPermissionCheckHandler(() => false);
  }
  session.fromPartition(AGENDA_WEB_PARTITION).setCertificateVerifyProc((request, callback) => {
    callback(isPinnedAgendaCertificate(agendaOriginProvider(), request.hostname, request.certificate.data) ? 0 : -3);
  });
  sweeper = setInterval(() => {
    for (const [site, e] of entries)
      if (e.view && site !== current && Date.now() - e.hiddenAt > IDLE_UNLOAD_MS) unload(site);
  }, 60_000);
  sweeper.unref();
}

export function showBrowser(site: BrowserSite, bounds: Bounds, host: BrowserWindow | null) {
  if (!host || host.isDestroyed()) return;
  if (current && current !== site) hideCurrent();
  current = site;
  lastBounds = bounds;
  const e = entry(site);
  let view = e.view;
  if (!view) view = create(site, host);
  else if (e.host !== host) {
    // A página já existe em outra janela (principal ↔ destacada): muda de janela sem recarregar.
    if (e.host && !e.host.isDestroyed()) e.host.contentView.removeChildView(view);
    host.contentView.addChildView(view);
    e.host = host;
  }
  applyBounds(site);
  view.setVisible(true);
  send(site);
}
export function updateBrowserBounds(bounds: Bounds, host: BrowserWindow | null) {
  if (!current || entries.get(current)?.host !== host) return;
  lastBounds = bounds;
  applyBounds(current);
}
function hideCurrent() {
  if (!current) return;
  const e = entries.get(current);
  if (e?.view) {
    e.view.setVisible(false);
    e.hiddenAt = Date.now();
  }
  current = null;
}
/** Só esconde se a página visível estiver na janela que pediu (a outra janela pode estar usando). */
export function hideBrowser(host: BrowserWindow | null, somente?: EscopoEsconder) {
  if (!current || entries.get(current)?.host !== host) return;
  if (!deveEsconder(current, somente)) return;
  hideCurrent();
}
/** Leva todas as páginas abertas de uma janela para outra, sem recarregar. */
export function moveBrowserTabs(to: BrowserWindow, from: BrowserWindow) {
  for (const [, e] of entries) {
    if (!e.view || e.host !== from) continue;
    if (!from.isDestroyed()) from.contentView.removeChildView(e.view);
    if (!to.isDestroyed()) to.contentView.addChildView(e.view);
    e.host = to;
    e.view.setVisible(false);
  }
  if (current && entries.get(current)?.host === to) current = null;
}
export function browserAction(
  site: BrowserSite,
  action: "back" | "forward" | "reload" | "home" | "go" | "zoomIn" | "zoomOut" | "zoomReset",
  value?: string,
) {
  const e = entries.get(site);
  const wc = e?.view?.webContents;
  if (!e || !wc || wc.isDestroyed()) return;
  if (action === "back" && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  else if (action === "forward" && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  else if (action === "reload") wc.reload();
  else if (action === "zoomIn") stepZoom(site, "in");
  else if (action === "zoomOut") stepZoom(site, "out");
  else if (action === "zoomReset") stepZoom(site, "reset");
  else if (action === "home") void wc.loadURL(siteUrl(site)).catch(() => undefined);
  else if (action === "go" && value) {
    const target = parseWebUrl(value) ?? searchUrl(value);
    void wc.loadURL(target).catch(() => undefined);
  }
}
/** Aponta um site do Navegador para um endereço: carrega agora se a página já está aberta, ou na próxima vez que for mostrada. */
export function browserOpenUrl(site: BrowserSite, url: string) {
  const e = entry(site);
  e.lastUrl = url;
  const wc = e.view?.webContents;
  if (wc && !wc.isDestroyed()) void wc.loadURL(url).catch(() => undefined);
}
export function closeBrowserTabs() {
  if (sweeper) clearInterval(sweeper);
  for (const site of [...entries.keys()]) unload(site);
}
/** Ao sair da conta: fecha todas as páginas e apaga logins e cookies, para o próximo usuário do PC. */
export async function resetBrowserTabs() {
  current = null;
  for (const site of [...entries.keys()]) unload(site);
  entries.clear();
  for (const name of [PARTITION, AGENDA_WEB_PARTITION, ESCRITORIO_PARTITION]) {
    await session.fromPartition(name).clearStorageData().catch(() => undefined);
    await session.fromPartition(name).clearCache().catch(() => undefined);
  }
}

/** Entrega à versão web da agenda a sessão do usuário (a mesma usada pelo app), como o chat faz no navegador. */
export async function setAgendaWebSession(token: string) {
  if (!/^agenda\.[A-Za-z0-9._-]{8,4000}$/.test(token)) throw new Error("Sessão da agenda inválida.");
  await session.fromPartition(AGENDA_WEB_PARTITION).cookies.set({
    url: agendaOrigin,
    name: AGENDA_COOKIE,
    value: token,
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    // A validade de verdade está no próprio token (o servidor confere); o app renova a sessão a cada 15 min.
    expirationDate: Math.floor(Date.now() / 1000) + 7 * 86400,
  });
}
