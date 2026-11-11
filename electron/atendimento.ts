import { randomBytes } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { z } from "zod";

/**
 * Atendimento: o Workspace como painel dos atendentes da acessanet-chat-api.
 * Tudo acontece aqui, no processo principal: o login (sessão do Chat Interno trocada por um código de uso único),
 * os tokens de atendimento (só em memória) e a conexão em tempo real. A interface recebe apenas os dados da conversa.
 */

/** Só estes caminhos da chat-api podem ser chamados pela interface. */
const id = "[0-9]{1,12}";
const PERMITIDOS: [RegExp, RegExp][] = [
  [/^GET$/, /^\/api\/agent\/conversations$/],
  [/^GET$/, new RegExp(`^/api/agent/conversations/${id}$`)],
  [/^GET$/, new RegExp(`^/api/agent/conversations/${id}/messages$`)],
  [/^POST$/, new RegExp(`^/api/agent/conversations/${id}/messages$`)],
  [/^POST$/, /^\/api\/agent\/conversations\/start-from-ticket$/],
  [/^POST$/, new RegExp(`^/api/agent/conversations/${id}/assign$`)],
  [/^POST$/, new RegExp(`^/api/agent/conversations/${id}/read$`)],
  [/^PATCH$/, new RegExp(`^/api/agent/conversations/${id}/status$`)],
  [/^POST$/, new RegExp(`^/api/agent/conversations/${id}/reopen$`)],
  [/^GET$/, new RegExp(`^/api/agent/conversations/${id}/notes$`)],
  [/^POST$/, new RegExp(`^/api/agent/conversations/${id}/notes$`)],
  [/^GET$/, /^\/api\/agent\/quick-replies$/],
  [/^GET$/, /^\/api\/agent\/auth\/me$/],
];
export const caminhoPermitido = (metodo: string, caminho: string) => PERMITIDOS.some(([m, p]) => m.test(metodo) && p.test(caminho));

export const pedidoSchema = z
  .object({
    method: z.enum(["GET", "POST", "PATCH"]),
    path: z.string().max(300),
    query: z.record(z.string().max(120), z.string().max(120)).optional(),
    body: z.unknown().optional(),
  })
  .strict();

const EVENTOS = ["conversation_created", "conversation_assigned", "conversation_updated", "conversation_transferred", "conversation_closed", "conversation_deleted", "new_message", "message_read", "typing", "note_added"] as const;

export interface AtendimentoOpcoes {
  /** Origem da chat-api (a mesma do painel: ele repassa /api e /socket.io). */
  apiOrigin: string;
  /** Origem aceita como retorno do login (precisa estar na lista da chat-api e do Chat Interno). */
  redirectUri: string;
  chatOrigin: () => string;
  sessaoChat: () => Promise<string>;
  enviar: (canal: "atendimento:evento" | "atendimento:estado", payload: unknown) => void;
  fetchImpl?: typeof fetch;
}

type Tokens = { accessToken: string; refreshToken: string };
export type Agente = { id: number; name: string; email: string; role: string };

export function criarAtendimento(opcoes: AtendimentoOpcoes) {
  const doFetch = opcoes.fetchImpl ?? fetch;
  let tokens: Tokens | null = null;
  let agente: Agente | null = null;
  let socket: Socket | null = null;
  let renovando: Promise<void> | null = null;

  const falha = async (r: Response, padrao: string) => {
    const corpo = (await r.json().catch(() => ({}))) as { error?: unknown };
    return new Error(typeof corpo.error === "string" ? corpo.error : padrao);
  };

  async function trocarCodigo(): Promise<{ tokens: Tokens; agent: Agente }> {
    const chatToken = await opcoes.sessaoChat();
    const state = randomBytes(24).toString("base64url");
    const r1 = await doFetch(new URL("/api/integrations/atendimento/sso/code", opcoes.chatOrigin()), {
      method: "POST",
      headers: { Authorization: `Bearer ${chatToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ clientId: "acessanet-atendimento", redirectUri: opcoes.redirectUri, state }),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!r1.ok) throw await falha(r1, "Não foi possível iniciar o login do atendimento.");
    const { code } = z.object({ code: z.string().min(10).max(500) }).parse(await r1.json());
    const r2 = await doFetch(new URL("/api/agent/auth/internal-chat/callback", opcoes.apiOrigin), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ code, redirectUri: opcoes.redirectUri }),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!r2.ok) throw await falha(r2, r2.status === 403 ? "Você não está cadastrado como atendente." : "O atendimento recusou o login.");
    const corpo = z.object({
      accessToken: z.string().min(10), refreshToken: z.string().min(10),
      agent: z.object({ id: z.number(), name: z.string(), email: z.string(), role: z.string() }).passthrough(),
    }).parse(await r2.json());
    return { tokens: { accessToken: corpo.accessToken, refreshToken: corpo.refreshToken }, agent: corpo.agent };
  }

  async function renovar() {
    if (!tokens) throw new Error("Atendimento desconectado.");
    renovando ??= (async () => {
      try {
        const r = await doFetch(new URL("/api/agent/auth/refresh", opcoes.apiOrigin), {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refreshToken: tokens!.refreshToken }), redirect: "error", signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw await falha(r, "Sessão do atendimento expirada.");
        const c = z.object({ accessToken: z.string(), refreshToken: z.string() }).passthrough().parse(await r.json());
        tokens = { accessToken: c.accessToken, refreshToken: c.refreshToken };
        socket?.auth && ((socket.auth as Record<string, unknown>).token = tokens.accessToken);
      } finally { renovando = null; }
    })();
    return renovando;
  }

  function ligarSocket() {
    socket?.disconnect();
    if (!tokens) return;
    const s = io(opcoes.apiOrigin, { auth: { userType: "agent", token: tokens.accessToken }, transports: ["websocket", "polling"], reconnection: true, reconnectionDelayMax: 10000 });
    socket = s;
    s.on("connect", () => opcoes.enviar("atendimento:estado", { conectado: true, agente }));
    s.on("disconnect", () => opcoes.enviar("atendimento:estado", { conectado: false, agente }));
    // Token vencido no meio da conexão: renova e tenta de novo.
    s.on("connect_error", () => { void renovar().catch(() => opcoes.enviar("atendimento:estado", { conectado: false, agente: null, erro: "Sessão do atendimento expirada." })); });
    for (const nome of EVENTOS) s.on(nome, (dados: unknown) => opcoes.enviar("atendimento:evento", { tipo: nome, dados }));
  }

  return {
    async entrar() {
      const r = await trocarCodigo();
      tokens = r.tokens;
      agente = r.agent;
      ligarSocket();
      return { agente };
    },
    estado: () => ({ agente, conectado: !!socket?.connected }),
    async sair() {
      const t = tokens;
      tokens = null; agente = null;
      socket?.disconnect(); socket = null;
      if (t) await doFetch(new URL("/api/agent/auth/logout", opcoes.apiOrigin), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: t.refreshToken }), signal: AbortSignal.timeout(8000),
      }).catch(() => undefined);
    },
    /** Chamada à chat-api em nome do atendente; só caminhos conhecidos. */
    async chamar(entrada: unknown) {
      const p = pedidoSchema.parse(entrada);
      if (!caminhoPermitido(p.method, p.path)) throw new Error("Operação não permitida.");
      if (!tokens) throw new Error("Atendimento desconectado.");
      const url = new URL(p.path, opcoes.apiOrigin);
      for (const [k, v] of Object.entries(p.query ?? {})) url.searchParams.set(k, v);
      const enviar = () => doFetch(url, {
        method: p.method,
        headers: { Authorization: `Bearer ${tokens!.accessToken}`, Accept: "application/json", ...(p.body !== undefined ? { "Content-Type": "application/json" } : {}) },
        ...(p.body !== undefined ? { body: JSON.stringify(p.body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      let r = await enviar();
      if (r.status === 401) { await renovar(); r = await enviar(); }
      if (r.status === 204) return null;
      const corpo: unknown = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(String((corpo as { error?: unknown })?.error ?? `Erro ${r.status}`));
      return corpo;
    },
    /** Avisa a chat-api que o atendente está digitando (sem passar pela interface com o token). */
    digitando(conversationId: number, ligado: boolean) {
      socket?.emit(ligado ? "typing_start" : "typing_stop", { conversationId });
    },
    /** Passa a receber as mensagens destas conversas (a chat-api só entrega ao quem entrou na sala). */
    entrarNas(ids: number[]) {
      for (const conversationId of ids.slice(0, 200)) socket?.emit("join_conversation", { conversationId });
    },
  };
}
