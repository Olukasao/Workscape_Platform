import { BrowserWindow, screen, shell, type WebContents } from "electron";
import { resolveExternalUrl } from "./moduleNavigation";
import { attachContextMenu } from "./contextMenu";
import log from "electron-log/main";

// Ficha do cliente: janelinha própria, sempre por cima, que abre sozinha quando uma ligação de número externo toca (ou é feita)
// e mostra o cliente do SGP, os últimos chamados e a última avaliação. Abre SEM tirar o foco de onde a pessoa está
// trabalhando e fecha sozinha alguns segundos depois do fim da ligação. Existe no máximo uma.
export type FichaDados = { numero: string; nome: string; direcao: "in" | "out"; estado: "tocando" | "chamando" | "conversando"; atendidaMs: number | null };
export const FECHAR_APOS_MS = 20_000;

let janela: BrowserWindow | null = null;
let timerFechar: NodeJS.Timeout | undefined;
let ultimaPosicao: { x: number; y: number; width: number; height: number } | null = null;

export const fichaContents = (): WebContents | null => (janela && !janela.isDestroyed() ? janela.webContents : null);

const cancelarFechamento = () => { if (timerFechar) { clearTimeout(timerFechar); timerFechar = undefined; } };

export async function abrirFicha(dados: FichaDados, opts: { base: string; preload: string; icon: Electron.NativeImage | string }) {
  try { await abrir(dados, opts); }
  catch (error) { log.error("Ficha do cliente: não abriu a janela:", error instanceof Error ? error.message : error); throw error; }
}

async function abrir(dados: FichaDados, opts: { base: string; preload: string; icon: Electron.NativeImage | string }) {
  log.info("Ficha do cliente: abrindo para uma ligação", dados.direcao === "in" ? "recebida" : "feita");
  cancelarFechamento();
  if (janela && !janela.isDestroyed()) {
    janela.webContents.send("ficha:evento", { tipo: "nova", ...dados });
    // Chegou outra ligação: aparece sem roubar o foco.
    if (!janela.isVisible()) janela.showInactive();
    return;
  }
  const area = screen.getPrimaryDisplay().workArea;
  const largura = Math.min(420, area.width), altura = Math.min(620, area.height);
  const pos = ultimaPosicao ?? { x: area.x + area.width - largura - 16, y: area.y + area.height - altura - 16, width: largura, height: altura };
  const w = new BrowserWindow({
    ...pos, minWidth: 320, minHeight: 280, title: "Ficha do cliente", icon: opts.icon, backgroundColor: "#030716",
    autoHideMenuBar: true, show: false, alwaysOnTop: true, skipTaskbar: false,
    webPreferences: { preload: opts.preload, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false },
  });
  janela = w;
  w.setMenu(null);
  w.setAlwaysOnTop(true, "floating");
  attachContextMenu(w.webContents);
  const abrirFora = (url: string) => { const externo = resolveExternalUrl(url); if (externo) void shell.openExternal(externo); };
  w.webContents.on("will-navigate", (e, url) => { e.preventDefault(); abrirFora(url); });
  w.webContents.on("will-attach-webview", (e) => e.preventDefault());
  w.webContents.setWindowOpenHandler(({ url }) => { abrirFora(url); return { action: "deny" }; });
  w.on("page-title-updated", (e) => e.preventDefault());
  w.once("ready-to-show", () => { if (!w.isDestroyed()) { w.showInactive(); log.info("Ficha do cliente: janela exibida"); } });
  w.webContents.on("did-fail-load", (_e, code, desc) => log.error("Ficha do cliente: falha ao carregar a página:", code, desc));
  w.webContents.on("render-process-gone", (_e, d) => log.error("Ficha do cliente: a página parou:", d.reason));
  w.on("close", () => { if (!w.isDestroyed()) ultimaPosicao = w.getNormalBounds(); });
  w.on("closed", () => { if (janela === w) janela = null; cancelarFechamento(); });
  const q = new URLSearchParams({ janela: "1", numero: dados.numero, nome: dados.nome, direcao: dados.direcao, estado: dados.estado, ...(dados.atendidaMs ? { atendida: String(dados.atendidaMs) } : {}) });
  await w.loadURL(`${opts.base}/index.html#/ficha?${q}`);
}

/** A ligação acabou: avisa a janela e fecha sozinha depois de um tempo (dá para ler/vincular antes). */
export function fimDaLigacao() {
  if (!janela || janela.isDestroyed()) return;
  janela.webContents.send("ficha:evento", { tipo: "fim", fechaEm: FECHAR_APOS_MS });
  cancelarFechamento();
  timerFechar = setTimeout(() => { if (janela && !janela.isDestroyed()) janela.close(); }, FECHAR_APOS_MS);
  timerFechar.unref?.();
}

export function fecharFicha() {
  cancelarFechamento();
  if (janela && !janela.isDestroyed()) janela.close();
}
