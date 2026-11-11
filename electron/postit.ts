import { app, BrowserWindow, screen, shell, type WebContents } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveExternalUrl } from "./moduleNavigation";
import { attachContextMenu } from "./contextMenu";

// Post-its: cada nota rápida pode virar uma janelinha sem moldura, sempre por cima (como as Notas Adesivas do Windows).
// Existe no máximo uma por nota; abrir de novo só a traz para frente. A posição e o tamanho são lembrados por nota.
type Salvo = { x: number; y: number; width: number; height: number };
const janelas = new Map<number, BrowserWindow>();
const arquivo = () => path.join(app.getPath("userData"), "postits.json");

async function lerSalvos(): Promise<Record<string, Salvo>> {
  try { return JSON.parse(await readFile(arquivo(), "utf8")); } catch { return {}; }
}
async function gravar(id: number, w: BrowserWindow) {
  const salvos = await lerSalvos();
  const b = w.getNormalBounds();
  salvos[String(id)] = { x: b.x, y: b.y, width: b.width, height: b.height };
  await writeFile(arquivo(), JSON.stringify(salvos), { mode: 0o600 }).catch(() => undefined);
}

export const postitContents = (): WebContents[] => [...janelas.values()].filter((w) => !w.isDestroyed()).map((w) => w.webContents);
export const postitDe = (wc: WebContents) => [...janelas.values()].find((w) => !w.isDestroyed() && w.webContents === wc) ?? null;

export async function abrirPostit(id: number, opts: { base: string; preload: string; icon: Electron.NativeImage | string }) {
  const existente = janelas.get(id);
  if (existente && !existente.isDestroyed()) {
    if (existente.isMinimized()) existente.restore();
    existente.show();
    existente.focus();
    return;
  }
  const area = screen.getPrimaryDisplay().workArea;
  const largura = 300, altura = 320;
  const salvo = (await lerSalvos())[String(id)];
  // Sem posição lembrada: canto direito da tela, cada novo post-it um pouco deslocado do anterior.
  const n = janelas.size;
  const padrao = { x: area.x + area.width - largura - 24 - n * 28, y: area.y + 24 + n * 28, width: largura, height: altura };
  const visivel = salvo && screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return Math.min(salvo.x + salvo.width, a.x + a.width) - Math.max(salvo.x, a.x) >= 80 && Math.min(salvo.y + salvo.height, a.y + a.height) - Math.max(salvo.y, a.y) >= 40;
  });
  const pos = visivel ? salvo : padrao;
  const w = new BrowserWindow({
    ...pos, minWidth: 180, minHeight: 140, title: "Post-it", icon: opts.icon, backgroundColor: "#fff3a3",
    frame: false, hasShadow: true, maximizable: false, fullscreenable: false, autoHideMenuBar: true, show: false, alwaysOnTop: true,
    webPreferences: { preload: opts.preload, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false },
  });
  janelas.set(id, w);
  w.setMenu(null);
  w.setAlwaysOnTop(true, "floating");
  attachContextMenu(w.webContents);
  const abrirFora = (url: string) => { const externo = resolveExternalUrl(url); if (externo) void shell.openExternal(externo); };
  w.webContents.on("will-navigate", (e, url) => { e.preventDefault(); abrirFora(url); });
  w.webContents.on("will-attach-webview", (e) => e.preventDefault());
  w.webContents.setWindowOpenHandler(({ url }) => { abrirFora(url); return { action: "deny" }; });
  w.on("page-title-updated", (e) => e.preventDefault());
  w.once("ready-to-show", () => { if (!w.isDestroyed()) w.show(); });
  w.on("close", () => { void gravar(id, w); });
  w.on("closed", () => { if (janelas.get(id) === w) janelas.delete(id); });
  await w.loadURL(`${opts.base}/index.html#/postit?janela=1&id=${id}`);
}

export function fecharPostits() {
  for (const w of janelas.values()) if (!w.isDestroyed()) w.close();
}
