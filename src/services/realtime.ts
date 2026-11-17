import { ligarPara } from "./ramais";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useNotices, useSession } from "../stores/workspace";
import {
  anunciarWorkspace,
  connectSocket,
  disconnectSocket,
  socket,
  syncSocketUser,
} from "./socket";
import { useChatData, unreadCount } from "./data";
import { chatDestacadoMostra } from "./janelaDestacada";
import { removerFormatacaoMensagem } from "../legacy/utils/formatacaoMensagem";
import { resumoCurto } from "../modules/rede/explicacao";
const ANEXOS: Record<string, string> = {
  imagem: "📷 Imagem",
  image: "📷 Imagem",
  audio: "🎵 Áudio",
  video: "🎬 Vídeo",
  sticker: "🖼️ Figurinha",
  figurinha: "🖼️ Figurinha",
};
const CAMINHO_UPLOAD = /^(?:https?:\/\/[^\s/]+)?\/uploads\/(chat|stickers)\/\S+$/i;
/** Texto do aviso: mensagem sem marcações de formatação, ou o tipo do anexo. */
export function messagePreview(m: any) {
  const tipo = String(m.tipo_mensagem || "").toLowerCase();
  const bruto = String(m.mensagem || m.preview || m.ultima_mensagem || "").trim();
  // Anexos (figurinha, imagem, áudio...) guardam o caminho do arquivo como texto: mostrar o tipo.
  const caminho = CAMINHO_UPLOAD.exec(bruto);
  if (ANEXOS[tipo] || caminho) {
    if (ANEXOS[tipo]) return ANEXOS[tipo];
    return caminho![1].toLowerCase() === "stickers" ? ANEXOS.sticker : "📎 Arquivo recebido";
  }
  const texto = removerFormatacaoMensagem(bruto).replace(/\s+/g, " ").trim();
  if (texto) return texto.slice(0, 500);
  if (m.anexo_nome && !ANEXOS[tipo]) return `📎 ${String(m.anexo_nome).slice(0, 200)}`;
  return ANEXOS[tipo] || "Arquivo recebido";
}
const miniaturas = new Map<string, string>();
/** Foto de perfil reduzida (96px) para caber no aviso; vazio se não houver foto ou falhar. */
async function miniaturaAvatar(chave: string, origem: unknown): Promise<string | undefined> {
  const src = String(origem || "");
  if (!/^data:image\//i.test(src) && !src.startsWith("/uploads/")) return undefined;
  const id = `${chave}:${src.length}:${src.slice(-32)}`;
  const guardada = miniaturas.get(id);
  if (guardada !== undefined) return guardada || undefined;
  const pronta = await new Promise<string>((resolve) => {
    const img = new Image();
    const tempo = setTimeout(() => resolve(""), 1500);
    img.onload = () => {
      clearTimeout(tempo);
      try {
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        if (!lado) return resolve("");
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 96;
        canvas.getContext("2d")!.drawImage(
          img,
          (img.naturalWidth - lado) / 2,
          (img.naturalHeight - lado) / 2,
          lado,
          lado,
          0,
          0,
          96,
          96,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        resolve("");
      }
    };
    img.onerror = () => {
      clearTimeout(tempo);
      resolve("");
    };
    img.src = src;
  });
  miniaturas.set(id, pronta);
  if (miniaturas.size > 100) miniaturas.delete(miniaturas.keys().next().value!);
  return pronta || undefined;
}
export function isChatVisible() {
  return (
    location.hash.startsWith("#/chat") &&
    document.visibilityState === "visible" &&
    document.hasFocus()
  );
}
export function useRealtime() {
  const user = useSession((s) => s.user),
    token = useSession((s) => s.token);
  const query = useQueryClient(),
    navigate = useNavigate();
  const [status, setStatus] = useState("Desconectado");
  const { conversations, groups } = useChatData();
  useEffect(() => {
    const total =
      unreadCount(conversations.data || []) + unreadCount(groups.data || []);
    void window.desktop?.unread(total);
  }, [conversations.data, groups.data]);
  useEffect(
    () => window.desktop?.onNavigate((target) => navigate(target)),
    [navigate],
  );
  useEffect(() => {
    if (!user || !token) {
      disconnectSocket();
      setStatus("Desconectado");
      return;
    }
    const seen = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void query.invalidateQueries({ queryKey: ["chat"] }),
        300,
      );
    };
    const onConnect = () => {
      setStatus("Conectado");
      syncSocketUser(user);
      void anunciarWorkspace();
      // Quem tem acesso à rede entra na sala que recebe os avisos de incidente novo (o servidor confere a permissão).
      socket.emit("olt_watch");
      invalidate();
    };
    // Evento em massa (ex.: falta de energia regional): salto grande de clientes afetados entre duas leituras.
    const eventoMassa = (e: { semEnergia?: number; loss?: number; aumento?: number; olts?: string[] }) => {
      void query.invalidateQueries({ queryKey: ["rede"] });
      const total = (e.semEnergia ?? 0) + (e.loss ?? 0);
      const body = `${(e.semEnergia ?? 0).toLocaleString("pt-BR")} sem energia e ${(e.loss ?? 0).toLocaleString("pt-BR")} em LOSS (+${(e.aumento ?? 0).toLocaleString("pt-BR")} agora)${e.olts?.length ? " · " + e.olts.join(", ") : ""}`.slice(0, 480);
      useNotices.getState().add({ id: `olt:massa:${Date.now()}`, title: "Muitos clientes afetados na rede", body, target: "/rede", time: new Date().toISOString() });
      void window.desktop?.notify({ title: `${total.toLocaleString("pt-BR")} clientes afetados`.slice(0, 120), body, target: "/rede", kind: "system", context: "Rede · OLT", tone: "crit" });
    };
    const incidenteNovo = (i: { id?: string; tipo?: string; olt?: string; pon?: string; slotPon?: string; cto?: string; dispositivosAtivos?: number | null; totalDispositivos?: number | null }) => {
      void query.invalidateQueries({ queryKey: ["rede"] });
      const titulo = ({ pon_loss: "Queda de PON", pon_down: "PON fora do ar", pon_no_power: "PON sem energia", cto_loss: "Queda de CTO", cto_no_power: "CTO sem energia", no_power: "Sem energia" } as Record<string, string>)[i.tipo ?? ""] || "Alerta de rede";
      const local = [i.olt, i.slotPon ? `slot ${i.slotPon}` : "", i.pon ? `PON ${i.pon}` : "", i.cto].filter(Boolean).join(" · ") || "local não informado";
      const afetados = typeof i.dispositivosAtivos === "number" ? ` — ${resumoCurto({ tipo: i.tipo ?? "", dispositivosAtivos: i.dispositivosAtivos, totalDispositivos: i.totalDispositivos ?? null })}` : "";
      const body = `${local}${afetados}`.slice(0, 480);
      useNotices.getState().add({ id: `olt:${i.id}`, title: `${titulo} na OLT Cloud`, body, target: "/rede", time: new Date().toISOString() });
      void window.desktop?.notify({ title: titulo.slice(0, 120), body, target: "/rede", kind: "system", context: "Rede · OLT", tone: (({ pon_loss: "crit", pon_down: "crit", pon_no_power: "warn", cto_loss: "warn" } as Record<string, "crit" | "warn">)[i.tipo ?? ""]) ?? "info" });
    };
    // Queda normalizada: aviso verde "PON X voltou", com a duração total.
    const incidenteNormalizado = (i: { id?: string; tipo?: string; olt?: string; pon?: string; slotPon?: string; cto?: string; dispositivosAtivos?: number | null; duracaoMs?: number }) => {
      void query.invalidateQueries({ queryKey: ["rede"] });
      const minutos = Math.max(0, Math.round((i.duracaoMs ?? 0) / 60000));
      const durou = minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")} min`;
      const alvo = i.tipo?.startsWith("cto") ? (i.cto || "CTO") : i.pon ? `PON ${i.pon}` : "Rede";
      const local = [i.olt, i.slotPon ? `slot ${i.slotPon}` : "", i.pon ? `PON ${i.pon}` : "", i.cto].filter(Boolean).join(" · ") || "local não informado";
      const clientes = typeof i.dispositivosAtivos === "number" && i.dispositivosAtivos > 0 ? ` · ${i.dispositivosAtivos} cliente${i.dispositivosAtivos === 1 ? "" : "s"} afetado${i.dispositivosAtivos === 1 ? "" : "s"}` : "";
      const title = `${alvo} voltou`.slice(0, 120);
      const body = `${local} — ficou ${durou} fora${clientes}`.slice(0, 480);
      useNotices.getState().add({ id: `olt:voltou:${i.id}`, title, body, target: "/rede", time: new Date().toISOString() });
      void window.desktop?.notify({ title, body, target: "/rede", kind: "system", context: "Rede · OLT", tone: "novo" });
    };
    const onDisconnect = () =>
      setStatus(navigator.onLine ? "Reconectando…" : "Sem conexão");
    const onError = (e: Error) => {
      setStatus("Falha na conexão");
      if (/auth|token|expir|autentic/i.test(e.message))
        useSession.getState().clear();
    };
    const notify = (kind: "direct" | "group") => (m: any) => {
      invalidate();
      if (Number(m.remetente_id) === Number(user.id)) return;
      const peer = kind === "group" ? m.grupo_id : m.remetente_id;
      if (!Number.isInteger(Number(peer)) || Number(peer) <= 0) return;
      const id = `${kind}:${m.id || [peer, m.criada_em || m.created_at, m.mensagem || m.ultima_mensagem].join(":")}`;
      if (seen.has(id)) return;
      seen.add(id);
      if (seen.size > 1000) seen.delete(seen.values().next().value!);
      const target = `/chat?${kind === "group" ? "grupo" : "conversa"}=${peer}`;
      const sender = String(m.remetente_nome || "").trim();
      const title =
        kind === "group"
          ? sender || m.grupo_nome || "Mensagem no grupo"
          : sender || "Nova mensagem";
      const body = messagePreview(m);
      const mentioned =
        kind === "group" &&
        Array.isArray(m.mencoes) &&
        m.mencoes.some((x: any) => Number(x?.usuario_id ?? x?.id ?? x) === Number(user.id));
      const context =
        kind === "group"
          ? `${mentioned ? "Mencionou você em " : "em "}${m.grupo_nome || "grupo"}`
          : "";
      useNotices.getState().add({
        id,
        title: kind === "group" && m.grupo_nome ? `${title} · ${m.grupo_nome}` : title,
        body,
        target,
        time: new Date().toISOString(),
      });
      // Pop-up no canto da tela, exceto quando a própria conversa já está aberta e em foco.
      if ((!isChatVisible() || location.hash !== `#${target}`) && !chatDestacadoMostra(target))
        void miniaturaAvatar(String(m.remetente_id), m.remetente_avatar).then((avatar) =>
          window.desktop?.notify({
            title: title.slice(0, 120),
            body,
            target,
            sender: sender.slice(0, 120) || undefined,
            context: context.slice(0, 120) || undefined,
            kind,
            avatar,
          }),
        );
    };
    // Pedido de ligação vindo do mapa do Escritório (botão "Ligar" no cartão da pessoa): discamos pelo nosso telefone.
    const ligarDoMapa = async (e: { numero?: string; nome?: string }) => {
      const numero = String(e?.numero ?? "").replace(/\D/g, "");
      if (!numero) return;
      const erro = await ligarPara(numero);
      if (erro) void window.desktop?.notify({ title: `Não foi possível ligar para ${String(e?.nome ?? "o colega").slice(0, 60)}`, body: erro.slice(0, 200), target: "/", kind: "system", context: "Escritório", tone: "warn" });
    };
    const direct = notify("direct"),
      group = notify("group");
    socket
      .on("connect", onConnect)
      .on("disconnect", onDisconnect)
      .on("connect_error", onError);
    socket
      .on("receive_direct_message", direct)
      .on("new_direct_message_notification", direct)
      .on("receive_group_message", group)
      .on("olt_incidente_novo", incidenteNovo)
      .on("olt_incidente_normalizado", incidenteNormalizado)
      .on("olt_evento_massa", eventoMassa)
      .on("escritorio_ligar", ligarDoMapa);
    const events = [
      "user_status_changed",
      "direct_message_status",
      "group_message_status",
      "message_deleted",
      "message_updated",
      "user_groups_joined",
      "grupo_atualizado",
      "group_members_updated",
    ];
    events.forEach((e) => socket.on(e, invalidate));
    const online = () => {
      if (!socket.connected) socket.connect();
      invalidate();
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", onDisconnect);
    window.addEventListener("focus", invalidate);
    connectSocket(token);
    return () => {
      clearTimeout(timer);
      socket
        .off("connect", onConnect)
        .off("disconnect", onDisconnect)
        .off("connect_error", onError)
        .off("receive_direct_message", direct)
        .off("new_direct_message_notification", direct)
        .off("receive_group_message", group)
        .off("olt_incidente_novo", incidenteNovo)
        .off("olt_incidente_normalizado", incidenteNormalizado)
        .off("olt_evento_massa", eventoMassa)
        .off("escritorio_ligar", ligarDoMapa);
      events.forEach((e) => socket.off(e, invalidate));
      window.removeEventListener("online", online);
      window.removeEventListener("offline", onDisconnect);
      window.removeEventListener("focus", invalidate);
      disconnectSocket();
    };
  }, [user, token, query]);
  return status;
}
