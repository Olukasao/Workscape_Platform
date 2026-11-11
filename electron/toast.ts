import { BrowserWindow, screen } from "electron";

// Aviso de mensagem no canto inferior direito da tela, em janela própria.
// Não depende da central de notificações do Windows (que descarta avisos de
// apps sem AppUserModelID registrado no atalho ou com "Não perturbe").
export type ToastData = {
  title: string;
  body: string;
  sender?: string;
  context?: string;
  kind?: "direct" | "group" | "system";
  avatar?: string;
  /** Destaque do aviso: crítico (vermelho), alerta (âmbar) ou informativo. Usado nos incidentes de rede. */
  tone?: "crit" | "warn" | "info";
  time?: string;
  /** "grande": janela maior e letras maiores (usado nas avaliações, que precisam ser lidas de longe). */
  size?: "normal" | "grande";
};

const WIDTH = 384;
const HEIGHT = 120;
const GRANDE = { width: 560, height: 230 };
const sizes = new WeakMap<BrowserWindow, { width: number; height: number }>();
const sizeOf = (t: BrowserWindow) => sizes.get(t) ?? { width: WIDTH, height: HEIGHT };
const GAP = 6;
const MARGIN = 10;
const MAX = 3;
const toasts: BrowserWindow[] = [];

function layout() {
  const area = screen.getPrimaryDisplay().workArea;
  // Empilha de baixo para cima; cada aviso tem a própria altura.
  let y = area.y + area.height - MARGIN + GAP;
  toasts.forEach((t) => {
    if (t.isDestroyed()) return;
    const { width, height } = sizeOf(t);
    y -= height + GAP;
    t.setBounds({ x: Math.round(area.x + area.width - width - MARGIN), y: Math.round(y), width, height });
  });
}

function close(t: BrowserWindow) {
  const i = toasts.indexOf(t);
  if (i >= 0) toasts.splice(i, 1);
  if (!t.isDestroyed()) t.destroy();
  layout();
}

export function closeAllToasts() {
  [...toasts].forEach(close);
}

/**
 * Mostra um aviso. `base` é a origem da interface local
 * (app://workspace ou o Vite em desenvolvimento).
 */
export function showToast(base: string, data: ToastData, onOpen: () => void) {
  while (toasts.length >= MAX) close(toasts[toasts.length - 1]);
  const dims = data.size === "grande" ? GRANDE : { width: WIDTH, height: HEIGHT };
  const t = new BrowserWindow({
    width: dims.width,
    height: dims.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  sizes.set(t, dims);
  t.setAlwaysOnTop(true, "pop-up-menu");
  t.setMenu(null);
  t.webContents.on("will-navigate", (e) => e.preventDefault());
  t.webContents.on("will-attach-webview", (e) => e.preventDefault());
  t.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  // A página responde trocando o hash: #open (clique) ou #close (tempo/fechar).
  t.webContents.on("did-navigate-in-page", (_e, url) => {
    const hash = new URL(url).hash;
    if (hash === "#open") {
      close(t);
      onOpen();
    } else if (hash === "#close") close(t);
  });
  t.webContents.on("render-process-gone", () => close(t));
  t.once("ready-to-show", () => {
    if (!t.isDestroyed()) t.showInactive();
  });
  // Segurança extra caso a página não responda.
  setTimeout(() => close(t), 60000);
  toasts.unshift(t);
  layout();
  const payload = encodeURIComponent(
    JSON.stringify({ ...data, time: data.time || new Date().toISOString() }),
  );
  void t.loadURL(`${base}/toast.html#${payload}`);
}

/** Chamar depois de app.whenReady(): reposiciona ao mudar a resolução ou a barra de tarefas. */
export function initToasts() {
  screen.on("display-metrics-changed", layout);
  screen.on("display-added", layout);
  screen.on("display-removed", layout);
}
