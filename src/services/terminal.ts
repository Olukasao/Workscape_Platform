export type ProtocoloTerminal = "ssh" | "telnet";
export type ModoAntiIdle = "nulo" | "enter" | "espaco";
export interface AntiIdle { ativo: boolean; segundos: number; modo: ModoAntiIdle }
export const MODOS_ANTI_IDLE: { id: ModoAntiIdle; nome: string; dica: string }[] = [
  { id: "nulo", nome: "Nulo (invisível)", dica: "Não aparece na tela; funciona na maioria dos equipamentos." },
  { id: "espaco", nome: "Espaço e apagar", dica: "Digita um espaço e apaga em seguida." },
  { id: "enter", nome: "Enter", dica: "Pula uma linha em branco; use se o equipamento ignorar os outros." },
];
export const ANTI_IDLE_PADRAO: AntiIdle = { ativo: true, segundos: 60, modo: "nulo" };
export interface EquipamentoTerminal {
  id: string;
  nome: string;
  grupo: string;
  protocolo: ProtocoloTerminal;
  host: string;
  porta: number;
  usuario: string;
  temSenha: boolean;
  antiIdle: boolean;
  antiIdleSegundos: number;
  antiIdleModo: ModoAntiIdle;
  /** Anotação da própria pessoa (nome, lembrete); só ela vê. */
  observacao?: string;
  /** Salvo só neste computador (formato antigo): continua utilizável até ser enviado para a lista de todos. */
  local?: boolean;
}
export interface EquipamentoForm {
  id?: string;
  nome: string;
  grupo: string;
  protocolo: ProtocoloTerminal;
  host: string;
  porta: number;
  usuario: string;
  senha?: string;
  guardarSenha: boolean;
  antiIdle: boolean;
  antiIdleSegundos: number;
  antiIdleModo: ModoAntiIdle;
}
export interface PedidoConexao {
  sessao: string;
  equipamentoId?: string;
  rapido?: { protocolo: ProtocoloTerminal; host: string; porta: number; usuario?: string };
  senha?: string;
  antiIdle?: AntiIdle;
  cols: number;
  rows: number;
}
export const portaPadrao = (p: ProtocoloTerminal) => (p === "ssh" ? 22 : 23);

/** Aceita "usuario@host", "host:porta" e "ssh://usuario@host:porta" na conexão rápida. */
export function lerEnderecoRapido(texto: string, protocoloPadrao: ProtocoloTerminal = "ssh") {
  let t = texto.trim();
  let protocolo = protocoloPadrao;
  const m = /^(ssh|telnet):\/\//i.exec(t);
  if (m) { protocolo = m[1].toLowerCase() as ProtocoloTerminal; t = t.slice(m[0].length); }
  let usuario = "";
  const arroba = t.lastIndexOf("@");
  if (arroba >= 0) { usuario = t.slice(0, arroba); t = t.slice(arroba + 1); }
  let porta = portaPadrao(protocolo);
  const dp = /^(.+):(\d{1,5})$/.exec(t);
  if (dp && !dp[1].includes(":")) { t = dp[1]; porta = Number(dp[2]); }
  if (!/^[A-Za-z0-9._-]{1,253}$/.test(t) || porta < 1 || porta > 65535) return null;
  return { protocolo, host: t, porta, usuario };
}

/** Tira o prefixo técnico do Electron ("Error invoking remote method ...") e deixa só a mensagem. */
export const mensagemLimpa = (erro: unknown): string => {
  const texto = erro instanceof Error ? erro.message : typeof erro === "string" ? erro : "";
  return texto.replace(/^Error invoking remote method '[^']+': (Error: )?/, "").trim() || "Erro inesperado.";
};
