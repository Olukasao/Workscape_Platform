import { BrowserWindow, session, shell } from "electron";
import { resolveExternalUrl } from "./moduleNavigation";

// Gerador de assinaturas de e-mail: a página vive no servidor do chat (/email-signatures). Ela abre numa janela própria do
// Workspace, com sessão só na memória, e recebe o login do chat para listar os membros, como no chat antigo. O login nunca vai
// na URL, não é gravado em disco e é apagado ao fechar a janela.
const PARTICAO = "assinaturas-email";
let janela: BrowserWindow | null = null;

export const tokenValido = (t: unknown): t is string => typeof t === "string" && t.length <= 2000 && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(t);

export async function abrirAssinaturas(origemChat: string, token: string) {
  const origem = new URL(origemChat).origin;
  if (janela && !janela.isDestroyed()) {
    if (janela.isMinimized()) janela.restore();
    janela.focus();
    return;
  }
  const w = new BrowserWindow({
    width: 1220, height: 880, minWidth: 720, minHeight: 520, show: false, autoHideMenuBar: true,
    title: "Assinaturas de e-mail · Acessa Workspace", backgroundColor: "#ffffff",
    webPreferences: { partition: PARTICAO, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true },
  });
  janela = w;
  const sessao = session.fromPartition(PARTICAO);
  sessao.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  const noOrigem = (url: string) => { try { return new URL(url).origin === origem; } catch { return false; } };
  const abrirFora = (url: string) => { const externo = resolveExternalUrl(url); if (externo) void shell.openExternal(externo); };
  w.webContents.on("will-navigate", (e, url) => { if (!noOrigem(url)) { e.preventDefault(); abrirFora(url); } });
  w.webContents.setWindowOpenHandler(({ url }) => { abrirFora(url); return { action: "deny" }; });
  w.once("ready-to-show", () => w.show());
  w.on("closed", () => {
    janela = null;
    void sessao.clearStorageData().catch(() => undefined);
  });
  try {
    // Um documento HTML simples da mesma origem serve para gravar o login antes da página do gerador ler.
    await w.loadURL(`${origem}/email-signatures/acessa-net-assinatura.html`);
    await w.webContents.executeJavaScript(`localStorage.setItem('token', ${JSON.stringify(token)}); true`);
    await w.loadURL(`${origem}/email-signatures/index.html`);
  } catch (error) {
    if (!w.isDestroyed()) w.close();
    throw new Error(error instanceof Error && /ERR_CONNECTION|ERR_NAME|ERR_ADDRESS|ERR_INTERNET/.test(error.message) ? "Não consegui falar com o servidor do chat." : "Não foi possível abrir o gerador de assinaturas.");
  }
}
