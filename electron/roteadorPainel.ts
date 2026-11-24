import { BrowserWindow, session } from "electron";
import log from "electron-log/main";

// Roteador do cliente: janela com o painel do roteador JÁ LOGADO. Quem entra no roteador é o agente do servidor (rede interna); esta
// janela só mostra a tela dele e devolve mouse e teclado. A senha de administrador e o IP do cliente nunca chegam a este computador.
// Só abre endereços do agente (servidor interno, porta fixa, caminho /v/<token de 48 caracteres>).
export const AGENTE_HOST = "192.168.1.133";
export const AGENTE_PORTA = "8796";
const CAMINHO = /^\/v\/[0-9a-f]{48}$/;

/** Confere o endereço antes de abrir qualquer janela. Devolve a URL limpa ou lança erro. */
export function urlDoPainelValida(valor: string): string {
  let u: URL;
  try { u = new URL(valor); } catch { throw new Error("Endereço do painel inválido."); }
  if (u.protocol !== "http:" || u.hostname !== AGENTE_HOST || u.port !== AGENTE_PORTA || !CAMINHO.test(u.pathname) || u.username || u.password || u.search || u.hash)
    throw new Error("Endereço do painel fora do servidor de roteadores.");
  return u.href;
}

const janelas = new Map<string, BrowserWindow>();

export async function abrirPainelRoteador(url: string, titulo: string, icon: Electron.NativeImage | string) {
  const alvo = urlDoPainelValida(url);
  const existente = janelas.get(alvo);
  if (existente && !existente.isDestroyed()) { if (existente.isMinimized()) existente.restore(); existente.focus(); return; }
  const w = new BrowserWindow({
    width: 1320, height: 900, minWidth: 700, minHeight: 500, title: titulo.slice(0, 80) || "Roteador do cliente", icon, backgroundColor: "#0f1419",
    autoHideMenuBar: true, show: false,
    // sessão própria e sem gravar nada em disco; a página do agente não ganha nenhum acesso ao sistema
    webPreferences: { session: session.fromPartition("roteador-painel"), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  janelas.set(alvo, w);
  w.setMenu(null);
  w.webContents.on("will-navigate", (e) => e.preventDefault());
  w.webContents.on("will-attach-webview", (e) => e.preventDefault());
  w.webContents.setWindowOpenHandler(({ url: destino }) => { if (/^https?:/i.test(destino)) log.warn("Roteador do cliente: tentativa de abrir outra janela bloqueada"); return { action: "deny" }; });
  w.on("page-title-updated", (e) => e.preventDefault());
  w.once("ready-to-show", () => { if (!w.isDestroyed()) w.show(); });
  w.on("closed", () => { janelas.delete(alvo); });
  try { await w.loadURL(alvo); }
  catch { if (!w.isDestroyed()) w.destroy(); throw new Error("Não foi possível abrir o painel do roteador."); }
}

export function fecharPaineisRoteador() {
  for (const w of janelas.values()) if (!w.isDestroyed()) w.close(); // a página avisa o agente (pagehide) e ele sai do painel
}
