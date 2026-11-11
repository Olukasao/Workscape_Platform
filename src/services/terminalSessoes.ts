import { useSyncExternalStore } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { AntiIdle, PedidoConexao, ProtocoloTerminal } from "./terminal";
import { ANTI_IDLE_PADRAO } from "./terminal";
import { usePreferences, useSession } from "../stores/workspace";
import { temaPorId } from "./terminalTemas";

/**
 * Sessões abertas do terminal. Ficam fora do React para continuarem vivas (com o histórico da tela)
 * quando a pessoa troca de módulo do Workspace e volta.
 */
export type EstadoSessao = "conectando" | "conectado" | "fechado" | "erro";
export interface Sessao {
  id: string;
  titulo: string;
  detalhe: string;
  estado: EstadoSessao;
  mensagem?: string;
  antiIdle: AntiIdle;
  /** Para reconectar: o equipamento salvo ou o endereço rápido (nunca a senha digitada). */
  origem: { equipamentoId?: string; rapido?: { protocolo: ProtocoloTerminal; host: string; porta: number; usuario?: string } };
  term: Terminal;
  fit: FitAddon;
  el: HTMLDivElement;
}

let sessoes: Sessao[] = [];
let ativa = null as string | null;
let versao = 0;
const ouvintes = new Set<() => void>();
const notificar = () => { versao++; ouvintes.forEach((f) => f()); };
const assinar = (f: () => void) => { ouvintes.add(f); return () => ouvintes.delete(f); };
let instantaneo: { sessoes: Sessao[]; ativa: string | null; versao: number } = { sessoes, ativa, versao };
const foto = () => {
  if (instantaneo.versao !== versao) instantaneo = { sessoes, ativa, versao };
  return instantaneo;
};
export const useSessoesTerminal = () => useSyncExternalStore(assinar, foto);

let ligado = false;
function ligarEventos() {
  if (ligado || !window.desktop) return;
  ligado = true;
  window.desktop.onTerminalDados(({ sessao, dados }) => sessoes.find((s) => s.id === sessao)?.term.write(dados));
  window.desktop.onTerminalEstado(({ sessao, estado, mensagem }) => {
    const s = sessoes.find((i) => i.id === sessao);
    if (!s) return;
    s.estado = estado;
    s.mensagem = mensagem;
    if (estado === "erro" && mensagem) s.term.write(`\r\n\x1b[31m${mensagem}\x1b[0m\r\n`);
    if (estado === "fechado") s.term.write("\r\n\x1b[90m[sessão encerrada]\x1b[0m\r\n");
    sessoes = [...sessoes];
    notificar();
  });
}

function criarTerminal(id: string) {
  const { terminalTema, terminalFonte } = usePreferences.getState();
  const term = new Terminal({
    fontFamily: "Consolas, 'Cascadia Mono', 'Courier New', monospace",
    fontSize: terminalFonte,
    cursorBlink: true,
    scrollback: 5000,
    convertEol: false,
    theme: temaPorId(terminalTema).tema,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  const el = document.createElement("div");
  el.className = "term-tela";
  term.open(el);
  term.onData((dados) => void window.desktop?.terminalEntrada({ sessao: id, dados }));
  term.onResize(({ cols, rows }) => void window.desktop?.terminalTamanho({ sessao: id, cols, rows }));
  // Ctrl+C copia quando há texto selecionado (como no SecureCRT); sem seleção, vai para o equipamento.
  term.attachCustomKeyEventHandler((e) => {
    if (e.type === "keydown" && e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "c" && term.hasSelection()) {
      void window.desktop?.copyText(term.getSelection());
      term.clearSelection();
      return false;
    }
    return true;
  });
  return { term, fit, el };
}

export async function abrirSessao(dono: string, titulo: string, detalhe: string, origem: Sessao["origem"], senha?: string, idExistente?: string, antiIdle: AntiIdle = ANTI_IDLE_PADRAO) {
  ligarEventos();
  const id = idExistente ?? crypto.randomUUID();
  let s = sessoes.find((i) => i.id === id);
  if (!s) {
    const t = criarTerminal(id);
    s = { id, titulo, detalhe, estado: "conectando", origem, antiIdle, ...t };
    sessoes = [...sessoes, s];
  } else {
    s.estado = "conectando";
    s.mensagem = undefined;
    s.antiIdle = antiIdle;
    s.term.write("\r\n\x1b[90m[reconectando…]\x1b[0m\r\n");
    sessoes = [...sessoes];
  }
  ativa = id;
  notificar();
  const pedido: PedidoConexao = { sessao: id, ...origem, ...(senha ? { senha } : {}), antiIdle, cols: s.term.cols || 100, rows: s.term.rows || 30 };
  try {
    await window.desktop!.terminalConectar({ dono, conexao: pedido, token: useSession.getState().token || undefined });
  } catch (erro) {
    s.estado = "erro";
    s.mensagem = erro instanceof Error ? erro.message : "Não foi possível conectar.";
    s.term.write(`\r\n\x1b[31m${s.mensagem}\x1b[0m\r\n`);
    sessoes = [...sessoes];
    notificar();
  }
  return id;
}

export function ativarSessao(id: string) {
  ativa = id;
  notificar();
}

export function fecharSessao(id: string) {
  const s = sessoes.find((i) => i.id === id);
  if (!s) return;
  void window.desktop?.terminalFechar({ sessao: id });
  s.term.dispose();
  s.el.remove();
  sessoes = sessoes.filter((i) => i.id !== id);
  if (ativa === id) ativa = sessoes.at(-1)?.id ?? null;
  notificar();
}

/** Liga/desliga ou muda o anti-idle de uma sessão já aberta. */
export async function definirAntiIdle(id: string, config: AntiIdle) {
  const s = sessoes.find((i) => i.id === id);
  if (!s) return;
  s.antiIdle = config;
  sessoes = [...sessoes];
  notificar();
  if (s.estado === "conectado" || s.estado === "conectando") await window.desktop?.terminalAntiIdle({ sessao: id, config });
}

/** Aplica tema e tamanho de letra a todas as sessões abertas. */
export function aplicarAparencia(temaId: string, fonte: number) {
  const tema = temaPorId(temaId).tema;
  for (const s of sessoes) {
    s.term.options.theme = tema;
    s.term.options.fontSize = fonte;
    try { s.fit.fit(); } catch { /* sem tamanho ainda */ }
  }
}
