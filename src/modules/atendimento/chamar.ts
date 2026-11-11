/** Chamadas à chat-api pelo processo principal do app (o token de atendimento nunca chega à interface). */
export const chamar = <T,>(method: "GET" | "POST" | "PATCH" | "PUT", path: string, extra: { query?: Record<string, string>; body?: unknown } = {}) =>
  window.desktop!.atendimentoChamar!({ method, path, ...extra }) as Promise<T>;

const ERROS: Record<string, string> = {
  agent_not_registered: "Você não está cadastrado como atendente. Peça ao administrador.",
  agent_disabled: "Seu acesso ao atendimento está desativado.",
  conversation_assigned_to_another_agent: "Esta conversa é de outro atendente.",
  conversation_not_assigned: "Assuma a conversa antes de responder.",
  conversation_already_assigned: "Outro atendente já assumiu esta conversa.",
  conversation_closed: "Esta conversa já foi encerrada.",
  insufficient_role: "Seu cargo não permite esta ação.",
  invalid_settings: "Confira os valores: expediente com início antes do fim, e SLA com alerta menor que a meta.",
  invalid_sector: "Setor inválido.",
};
export const msgErro = (e: unknown) => {
  const m = e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "Erro inesperado.";
  return ERROS[m] ?? m;
};

export type Cargo = "agent" | "supervisor" | "admin";
export const duracao = (s: number | null | undefined) => {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
};
