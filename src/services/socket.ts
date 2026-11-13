import { io } from "socket.io-client";
import { useServers } from "../stores/workspace";
import { socketEndpoint } from "./live";
export let socket = io("http://127.0.0.1", {
  autoConnect: false,
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 10000,
});
let endpoint = "";
export function initializeSocket(url: string) {
  if (endpoint === url) return;
  socket.disconnect();
  endpoint = url;
  const target = socketEndpoint("chat", url || "http://127.0.0.1");
  socket = io(target.url, {
    path: target.path,
    autoConnect: false,
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });
}
export const configureSocketAuth = (token: string | null) => {
  socket.auth = token ? { token } : {};
  return socket;
};
export function connectSocket(token: string) {
  const url = useServers.getState().config.chat;
  if (!url) return socket;
  configureSocketAuth(token);
  if (!socket.connected) socket.connect();
  return socket;
}
export function syncSocketUser(user: { id?: number; empresa_id?: number }) {
  if (!user.id || !user.empresa_id) return;
  const payload = { usuario_id: user.id, empresa_id: user.empresa_id };
  socket.emit("user_connect", payload);
  socket.emit("join_user_groups", payload);
}
export function disconnectSocket() {
  socket.auth = {};
  socket.disconnect();
}

/** Avisa o servidor que este usuário está com o aplicativo aberto (lista "usando agora" do painel admin). */
export async function anunciarWorkspace() {
  if (!window.desktop) {
    // Navegador: só no ambiente de testes (lá o Workspace aberto no navegador também conta como online no Escritório).
    if (import.meta.env.VITE_AMBIENTE === "teste") socket.emit("workspace_presence", { versao: "", dispositivo: "", computador: "" });
    return;
  }
  let versao = "";
  try { versao = (await window.desktop.updateStatus()).currentVersion; } catch { /* Sem versão. */ }
  // Identificador e nome do computador: alimentam o painel de versões da Administração.
  let dispositivo = "", computador = "";
  try {
    const info = await window.desktop.deviceInfo();
    dispositivo = info.id;
    computador = info.nome;
  } catch { /* Versão antiga do app ou sem acesso: segue só com a versão. */ }
  socket.emit("workspace_presence", { versao, dispositivo, computador });
}
