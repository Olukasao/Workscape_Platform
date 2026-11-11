import { useSyncExternalStore } from "react";

/**
 * Teclas do terminal. Cada equipamento de rede espera um código diferente para "apagar", e por isso muita gente acaba
 * precisando de Ctrl+Backspace. Aqui a pessoa escolhe o que cada tecla envia, e a escolha vale para todas as abas
 * (inclusive as já abertas), sem reconectar.
 */
export type ApagarCodigo = "del" | "ctrl-h";
export type CtrlBackspace = "padrao" | "del" | "ctrl-h" | "palavra" | "linha";
export type DeleteTecla = "padrao" | "apagar";
export type EnterTecla = "cr" | "crlf" | "lf";

export interface TeclasTerminal {
  /** O que a tecla Backspace envia: DEL (0x7F, padrão dos servidores Linux) ou ^H (0x08, padrão de muitos equipamentos). */
  backspace: ApagarCodigo;
  /** O que Ctrl+Backspace faz: o padrão do terminal (^H), outro código de apagar, ou apagar a palavra/linha. */
  ctrlBackspace: CtrlBackspace;
  /** A tecla Delete: padrão (sequência de Delete) ou apagar à esquerda como o Backspace (equipamentos que ignoram Delete). */
  delete: DeleteTecla;
  /** O que Enter envia: CR (padrão), CR+LF ou só LF. */
  enter: EnterTecla;
  /** Mostra a barra de atalhos clicáveis acima do terminal. */
  barraAtalhos: boolean;
  /** Copia sozinho ao selecionar e cola com o botão direito (como no SecureCRT). */
  copiarEColar: boolean;
}

export const TECLAS_PADRAO: TeclasTerminal = { backspace: "del", ctrlBackspace: "padrao", delete: "padrao", enter: "cr", barraAtalhos: false, copiarEColar: false };

const DEL = "\x7f";
const CTRL_H = "\x08";
const CODIGO_APAGAR: Record<ApagarCodigo, string> = { del: DEL, "ctrl-h": CTRL_H };

/** Troca o que o terminal enviou pelo que a pessoa escolheu (backspace e Enter). */
export function traduzirEntrada(dados: string, cfg: TeclasTerminal): string {
  if (dados === DEL) return CODIGO_APAGAR[cfg.backspace];
  // Enter (e texto colado com várias linhas): cada CR vira o que a pessoa escolheu.
  if (dados.includes("\r") && cfg.enter !== "cr") return dados.replace(/\r/g, cfg.enter === "crlf" ? "\r\n" : "\n");
  return dados;
}

export interface TeclaPressionada { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }

/**
 * Teclas que o terminal deixaria seguir o caminho padrão mas que a pessoa quer diferente.
 * Devolve o texto a enviar (e o terminal NÃO processa a tecla), ou null para seguir o padrão.
 */
export function tratarTecla(e: TeclaPressionada, cfg: TeclasTerminal): string | null {
  if (e.altKey || e.metaKey) return null;
  if (e.key === "Backspace" && e.ctrlKey && !e.shiftKey) {
    switch (cfg.ctrlBackspace) {
      case "del": return DEL;
      case "ctrl-h": return CTRL_H;
      case "palavra": return "\x17"; // Ctrl+W: apaga a palavra anterior
      case "linha": return "\x15"; // Ctrl+U: apaga a linha
      default: return null;
    }
  }
  if (e.key === "Delete" && !e.ctrlKey && !e.shiftKey && cfg.delete === "apagar") return CODIGO_APAGAR[cfg.backspace];
  return null;
}

/** Atalhos da barra na tela: o que cada botão envia ao equipamento. */
export const ATALHOS_TELA: { id: string; rotulo: string; dica: string; dados: string }[] = [
  { id: "apagar", rotulo: "⌫ Apagar", dica: "Apaga um caractere", dados: "" /* usa o código escolhido em Backspace */ },
  { id: "palavra", rotulo: "Apagar palavra", dica: "Apaga a palavra anterior (Ctrl+W)", dados: "\x17" },
  { id: "linha", rotulo: "Apagar linha", dica: "Apaga a linha inteira (Ctrl+U)", dados: "\x15" },
  { id: "tab", rotulo: "Tab", dica: "Completa o comando", dados: "\t" },
  { id: "esc", rotulo: "Esc", dica: "Esc", dados: "\x1b" },
  { id: "cima", rotulo: "↑", dica: "Comando anterior", dados: "\x1b[A" },
  { id: "baixo", rotulo: "↓", dica: "Próximo comando", dados: "\x1b[B" },
  { id: "ctrlc", rotulo: "Ctrl+C", dica: "Interrompe o comando", dados: "\x03" },
  { id: "ctrlz", rotulo: "Ctrl+Z", dica: "Sai do modo atual (equipamentos Huawei/Cisco)", dados: "\x1a" },
  { id: "ctrld", rotulo: "Ctrl+D", dica: "Fim de entrada / sair", dados: "\x04" },
  { id: "ctrll", rotulo: "Limpar tela", dica: "Ctrl+L", dados: "\x0c" },
  { id: "enter", rotulo: "Enter", dica: "Envia o comando", dados: "\r" },
];

export function dadosDoAtalho(id: string, cfg: TeclasTerminal): string {
  if (id === "apagar") return CODIGO_APAGAR[cfg.backspace];
  const a = ATALHOS_TELA.find((x) => x.id === id);
  return a ? traduzirEntrada(a.dados, cfg) : "";
}

// ---------- preferência guardada (vale para todas as janelas deste computador) ----------
const CHAVE = "workspace:terminal:teclas";
const OPCOES = {
  backspace: ["del", "ctrl-h"], ctrlBackspace: ["padrao", "del", "ctrl-h", "palavra", "linha"], delete: ["padrao", "apagar"], enter: ["cr", "crlf", "lf"],
} as const;

export function lerTeclas(): TeclasTerminal {
  try {
    const bruto = JSON.parse(window.localStorage.getItem(CHAVE) ?? "{}") as Partial<TeclasTerminal>;
    const ok = <K extends keyof typeof OPCOES>(k: K): (typeof OPCOES)[K][number] =>
      ((OPCOES[k] as readonly string[]).includes(bruto[k] as string) ? bruto[k] : TECLAS_PADRAO[k]) as (typeof OPCOES)[K][number];
    return { backspace: ok("backspace"), ctrlBackspace: ok("ctrlBackspace"), delete: ok("delete"), enter: ok("enter"), barraAtalhos: bruto.barraAtalhos === true, copiarEColar: bruto.copiarEColar === true };
  } catch {
    return TECLAS_PADRAO;
  }
}

let atual: TeclasTerminal | null = null;
const ouvintes = new Set<() => void>();
const foto = (): TeclasTerminal => (atual ??= lerTeclas());
/** As teclas em vigor agora (as sessões consultam a cada tecla, então mudar vale na hora). */
export const teclasAtuais = (): TeclasTerminal => foto();

export function salvarTeclas(parcial: Partial<TeclasTerminal>) {
  atual = { ...foto(), ...parcial };
  try { window.localStorage.setItem(CHAVE, JSON.stringify(atual)); } catch { /* sem armazenamento: vale só nesta sessão */ }
  ouvintes.forEach((f) => f());
}
export const restaurarTeclas = () => salvarTeclas(TECLAS_PADRAO);

if (typeof window !== "undefined") {
  // Outra janela (Terminal destacado) mudou a escolha: acompanha.
  window.addEventListener("storage", (e) => { if (e.key === CHAVE) { atual = null; ouvintes.forEach((f) => f()); } });
}
export const useTeclasTerminal = () => useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, foto);
