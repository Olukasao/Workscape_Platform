import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";

export type JanelaKind = "agenda" | "chat" | "navegador" | "rede" | "dashboard" | "resumo" | "terminal" | "telefone";

/** Miniaplicativos: cada módulo destacável, com o título da janela e o caminho dele no Workspace. */
export const MINIAPPS: Record<JanelaKind, { titulo: string; artigo: string }> = {
  agenda: { titulo: "Agenda Técnica", artigo: "A agenda" },
  chat: { titulo: "Chat Interno", artigo: "O chat" },
  navegador: { titulo: "Navegador", artigo: "O navegador" },
  rede: { titulo: "Rede (OLT)", artigo: "A rede" },
  dashboard: { titulo: "Painel NOC", artigo: "O Painel NOC" },
  resumo: { titulo: "Resumo", artigo: "O resumo" },
  terminal: { titulo: "Terminal", artigo: "O terminal" },
  telefone: { titulo: "Workscape Phone", artigo: "O telefone" },
};

/** Qual janela destacada é este renderizador (definido pela URL ao abrir); null na janela principal. */
export const JANELA_DESTACADA: JanelaKind | null = (() => {
  if (typeof location === "undefined") return null;
  const m = /^#\/(agenda|chat|navegador|rede|dashboard|resumo|terminal|telefone)\?janela=1/.exec(location.hash);
  return m ? (m[1] as JanelaKind) : null;
})();

/** Janela flutuante da ficha do cliente na ligação (não é um módulo destacável). */
export const JANELA_FICHA = typeof location !== "undefined" && /^#\/ficha\?/.test(location.hash);

const canal = (nome: string) => {
  try {
    return new BroadcastChannel(nome);
  } catch {
    return null;
  }
};

// ---- Agenda: avisa a outra janela quando algo muda (ausência, bloqueio, transferência...) ----
let canalAgenda: BroadcastChannel | null | undefined;
const agendaCanal = () => (canalAgenda === undefined ? (canalAgenda = canal("workspace-agenda")) : canalAgenda);
export function avisarMudancaAgenda() {
  agendaCanal()?.postMessage({ tipo: "mudou", em: Date.now() });
}
/** Recarrega os dados da agenda neste renderizador quando a outra janela alterar algo. */
export function useSincronizacaoAgenda(client: QueryClient) {
  useEffect(() => {
    const c = agendaCanal();
    if (!c) return;
    const ouvir = (e: MessageEvent) => {
      if (e.data?.tipo === "mudou") void client.invalidateQueries({ queryKey: ["agenda"] });
    };
    c.addEventListener("message", ouvir);
    return () => c.removeEventListener("message", ouvir);
  }, [client]);
}

// ---- Sincronização genérica: qualquer janela avisa as outras para recarregar um grupo de dados ----
let canalGeral: BroadcastChannel | null | undefined;
const geralCanal = () => (canalGeral === undefined ? (canalGeral = canal("workspace-sync")) : canalGeral);
/** Ex.: avisarMudanca("rede") faz todas as janelas recarregarem os dados cujo queryKey começa por "rede". */
export function avisarMudanca(prefixo: string) {
  geralCanal()?.postMessage({ tipo: "invalidar", prefixo, em: Date.now() });
}
export function useSincronizacaoGeral(client: QueryClient) {
  useEffect(() => {
    const c = geralCanal();
    if (!c) return;
    const ouvir = (e: MessageEvent) => {
      if (e.data?.tipo === "invalidar" && typeof e.data.prefixo === "string" && /^[a-z-]{1,24}$/.test(e.data.prefixo))
        void client.invalidateQueries({ queryKey: [e.data.prefixo] });
    };
    c.addEventListener("message", ouvir);
    return () => c.removeEventListener("message", ouvir);
  }, [client]);
}

// ---- Chat: a janela principal não avisa por pop-up da conversa que a janela destacada já mostra ----
let presencaChat = { focado: false, destino: "" };
if (typeof window !== "undefined" && !JANELA_DESTACADA) {
  canal("workspace-chat-presenca")?.addEventListener("message", (e: MessageEvent) => {
    if (e.data && typeof e.data.destino === "string") presencaChat = { focado: !!e.data.focado, destino: e.data.destino };
  });
}
/** Na janela principal: a conversa deste destino está aberta e em foco na janela destacada? */
export const chatDestacadoMostra = (destino: string) => presencaChat.focado && presencaChat.destino === destino;
/** Na janela destacada do chat: informa à principal qual conversa está em foco. */
export function usePresencaChat(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const c = canal("workspace-chat-presenca");
    if (!c) return;
    const enviar = (focado = document.hasFocus() && document.visibilityState === "visible") =>
      c.postMessage({ focado, destino: location.hash.slice(1) });
    const aoMudar = () => enviar();
    const aoFechar = () => enviar(false);
    window.addEventListener("focus", aoMudar);
    window.addEventListener("blur", aoFechar);
    window.addEventListener("hashchange", aoMudar);
    document.addEventListener("visibilitychange", aoMudar);
    window.addEventListener("beforeunload", aoFechar);
    enviar();
    return () => {
      window.removeEventListener("focus", aoMudar);
      window.removeEventListener("blur", aoFechar);
      window.removeEventListener("hashchange", aoMudar);
      document.removeEventListener("visibilitychange", aoMudar);
      window.removeEventListener("beforeunload", aoFechar);
      aoFechar();
      c.close();
    };
  }, [ativo]);
}

// ---- Estado e ações das janelas destacadas ----
/** Na janela principal: este módulo está aberto em janela própria? */
export function useDestacada(kind: JanelaKind) {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    const d = window.desktop;
    // Sem o recurso (ex.: ambiente de teste ou preview web) o módulo segue na janela principal.
    if (!d?.detachedStatus || !d.onDetachedState) return;
    let ativo = true;
    void d.detachedStatus(kind).then((s) => ativo && setAberta(s.open)).catch(() => undefined);
    const parar = d.onDetachedState((s) => s.kind === kind && setAberta(s.open));
    return () => {
      ativo = false;
      parar();
    };
  }, [kind]);
  return aberta;
}
export const fixarSobre = (kind: JanelaKind, ligado: boolean) => void window.desktop?.detachedPin?.({ kind, ligado });
export const destacar = (kind: JanelaKind, search?: string) => void window.desktop?.detachedOpen?.({ kind, search });
export const reintegrar = (kind: JanelaKind) => void window.desktop?.detachedClose?.({ kind, reintegrar: true });
export const trazerDeVolta = (kind: JanelaKind) => void window.desktop?.detachedClose?.({ kind, reintegrar: false });
export const podeDestacar = () => typeof window !== "undefined" && !!window.desktop?.detachedOpen && !JANELA_DESTACADA;
