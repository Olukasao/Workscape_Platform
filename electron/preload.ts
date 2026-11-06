import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("desktop", {
  updateStatus: () => ipcRenderer.invoke("updates:status"),
  deviceInfo: () => ipcRenderer.invoke("device:info"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateStatus: (callback: (value: unknown) => void) => {
    const listener = (_event: unknown, value: unknown) => callback(value);
    ipcRenderer.on("updates:status", listener);
    return () => ipcRenderer.removeListener("updates:status", listener);
  },
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (value: unknown) => ipcRenderer.invoke("config:save", value),
  request: (value: unknown) => ipcRenderer.invoke("api:request", value),
  download: (value: unknown) => ipcRenderer.invoke("asset:download", value),
  getSession: () => ipcRenderer.invoke("session:get"),
  saveSession: (value: unknown) => ipcRenderer.invoke("session:save", value),
  clearSession: () => ipcRenderer.invoke("session:clear"),
  window: (action: string) => ipcRenderer.invoke("window:action", action),
  setZoom: (percent: number) => ipcRenderer.invoke("window:zoom", percent),
  onZoomStep: (callback: (action: "in" | "out" | "reset") => void) => {
    const listener = (_event: unknown, action: "in" | "out" | "reset") => callback(action);
    ipcRenderer.on("zoom:step", listener);
    return () => ipcRenderer.removeListener("zoom:step", listener);
  },
  notify: (value: unknown) => ipcRenderer.invoke("notification:show", value),
  dashboardStart: () => ipcRenderer.invoke("dashboard:start"),
  dashboardStop: () => ipcRenderer.invoke("dashboard:stop"),
  dashboardRefresh: () => ipcRenderer.invoke("dashboard:refresh"),
  onDashboardEvent: (callback: (channel: string, payload: unknown) => void) => {
    const canais = ["dashboard:update", "dashboard:clientes", "dashboard:status", "dashboard:diagnostics"];
    const listeners = canais.map((canal) => {
      const listener = (_event: unknown, payload: unknown) => callback(canal, payload);
      ipcRenderer.on(canal, listener);
      return [canal, listener] as const;
    });
    return () => listeners.forEach(([canal, listener]) => ipcRenderer.removeListener(canal, listener));
  },
  openExternal: (key: string) => ipcRenderer.invoke("external:open", key),
  copyImage: (bytes: Uint8Array) => ipcRenderer.invoke("clipboard:write-image", bytes),
  copyText: (text: string) => ipcRenderer.invoke("clipboard:write-text", text),
  browserShow: (value: unknown) => ipcRenderer.invoke("browser:show", value),
  browserBounds: (value: unknown) => ipcRenderer.invoke("browser:bounds", value),
  agendaWebSession: (value: unknown) => ipcRenderer.invoke("agenda-web:session", value),
  browserHide: () => ipcRenderer.invoke("browser:hide"),
  browserAction: (value: unknown) => ipcRenderer.invoke("browser:action", value),
  onBrowserState: (callback: (value: unknown) => void) => {
    const listener = (_event: unknown, value: unknown) => callback(value);
    ipcRenderer.on("browser:state", listener);
    return () => ipcRenderer.removeListener("browser:state", listener);
  },
  detachedOpen: (value: unknown) => ipcRenderer.invoke("detached:open", value),
  detachedClose: (value: unknown) => ipcRenderer.invoke("detached:close", value),
  detachedPin: (value: unknown) => ipcRenderer.invoke("detached:pin", value),
  detachedCompact: (value: unknown) => ipcRenderer.invoke("detached:compact", value),
  workspacesList: (owner: string) => ipcRenderer.invoke("workspaces:list", owner),
  workspacesSave: (value: unknown) => ipcRenderer.invoke("workspaces:save", value),
  workspacesDelete: (value: unknown) => ipcRenderer.invoke("workspaces:delete", value),
  workspacesOpen: (value: unknown) => ipcRenderer.invoke("workspaces:open", value),
  workspacesTile: (value: unknown) => ipcRenderer.invoke("workspaces:tile", value),
  workspacesCloseAll: () => ipcRenderer.invoke("workspaces:close-all"),
  detachedStatus: (kind: string) => ipcRenderer.invoke("detached:status", kind),
  onDetachedState: (callback: (value: { kind: string; open: boolean }) => void) => {
    const listener = (_event: unknown, value: { kind: string; open: boolean }) => callback(value);
    ipcRenderer.on("detached:state", listener);
    return () => ipcRenderer.removeListener("detached:state", listener);
  },
  onDetachedDeeplink: (callback: (search: string) => void) => {
    const listener = (_event: unknown, search: string) => callback(search);
    ipcRenderer.on("detached:deeplink", listener);
    return () => ipcRenderer.removeListener("detached:deeplink", listener);
  },
  unread: (value: number) => ipcRenderer.invoke("unread:set", value),
  onNavigate: (callback: (path: string) => void) => {
    const listener = (_event: unknown, path: string) => callback(path);
    ipcRenderer.on("navigate", listener);
    return () => ipcRenderer.removeListener("navigate", listener);
  },
  sgpListarChamados: (key: string) => ipcRenderer.invoke("sgp:listar-chamados", key),
  browserOpenSgp: (url: string) => ipcRenderer.invoke("browser:open-sgp", url),
  openSgpLink: (url: string) => ipcRenderer.invoke("external:open-sgp-link", url),
  testarConexao: () => ipcRenderer.invoke("vpn:testar"),
  corrigirVpn: () => ipcRenderer.invoke("vpn:corrigir"),
  alarmAttention: () => ipcRenderer.invoke("alarm:attention"),
  remotoIniciar: () => ipcRenderer.invoke("remoto:iniciar"),
  remotoConectar: (id: string) => ipcRenderer.invoke("remoto:conectar", { id }),
  phoneState: () => ipcRenderer.invoke("phone:state"),
  phoneConnect: (token: string) => ipcRenderer.invoke("phone:connect", { token }),
  phoneDisconnect: () => ipcRenderer.invoke("phone:disconnect"),
  phoneCall: (numero: string) => ipcRenderer.invoke("phone:call", { numero }),
  phoneAnswer: (id: number) => ipcRenderer.invoke("phone:answer", { id }),
  phoneReject: (id: number) => ipcRenderer.invoke("phone:reject", { id }),
  phoneHangup: (id: number) => ipcRenderer.invoke("phone:hangup", { id }),
  phoneMute: (id: number, on: boolean) => ipcRenderer.invoke("phone:mute", { id, on }),
  phoneHold: (id: number, on: boolean) => ipcRenderer.invoke("phone:hold", { id, on }),
  phoneDtmf: (id: number, digits: string) => ipcRenderer.invoke("phone:dtmf", { id, digits }),
  phoneTransfer: (id: number, to: string) => ipcRenderer.invoke("phone:transfer", { id, to }),
  phoneDiretorio: (lista: { ramal: string; nome: string }[]) => ipcRenderer.invoke("phone:diretorio", lista),
  phoneDnd: (on: boolean) => ipcRenderer.invoke("phone:dnd", { on }),
  phoneDevices: () => ipcRenderer.invoke("phone:devices"),
  phoneSetDevices: (value: { capture?: number; playback?: number }) => ipcRenderer.invoke("phone:set-devices", value),
  phoneDiagnostico: () => ipcRenderer.invoke("phone:diagnostico"),
  onPhoneEvent: (callback: (event: unknown) => void) => {
    const listener = (_event: unknown, value: unknown) => callback(value);
    ipcRenderer.on("phone:event", listener);
    return () => ipcRenderer.removeListener("phone:event", listener);
  },
  terminalListar: (dono: string) => ipcRenderer.invoke("terminal:listar", dono),
  terminalSalvar: (value: unknown) => ipcRenderer.invoke("terminal:salvar", value),
  terminalExcluir: (value: unknown) => ipcRenderer.invoke("terminal:excluir", value),
  terminalEsquecerChave: (value: unknown) => ipcRenderer.invoke("terminal:esquecer-chave", value),
  terminalConectar: (value: unknown) => ipcRenderer.invoke("terminal:conectar", value),
  terminalEntrada: (value: unknown) => ipcRenderer.invoke("terminal:entrada", value),
  terminalTamanho: (value: unknown) => ipcRenderer.invoke("terminal:tamanho", value),
  terminalAntiIdle: (value: unknown) => ipcRenderer.invoke("terminal:anti-idle", value),
  terminalFechar: (value: unknown) => ipcRenderer.invoke("terminal:fechar", value),
  onTerminalDados: (callback: (value: unknown) => void) => {
    const listener = (_event: unknown, value: unknown) => callback(value);
    ipcRenderer.on("terminal:dados", listener);
    return () => ipcRenderer.removeListener("terminal:dados", listener);
  },
  onTerminalEstado: (callback: (value: unknown) => void) => {
    const listener = (_event: unknown, value: unknown) => callback(value);
    ipcRenderer.on("terminal:estado", listener);
    return () => ipcRenderer.removeListener("terminal:estado", listener);
  },
  localAiStatus: () => ipcRenderer.invoke("localai:status"),
  localAiComplete: (value: unknown) => ipcRenderer.invoke("localai:complete", value),
  localAiChat: (value: unknown) => ipcRenderer.invoke("localai:chat", value),
  onLocalAiStatus: (callback: (value: unknown) => void) => {
    const listener = (_event: unknown, value: unknown) => callback(value);
    ipcRenderer.on("localai:status", listener);
    return () => ipcRenderer.removeListener("localai:status", listener);
  },
});
