import { create } from "zustand";
import { chamar } from "../modules/atendimento/chamar";

export type StatusAtd = "AVAILABLE" | "INVISIBLE";
export interface AgenteSessao { id: number; name: string; email: string; role: string }

const chave = (nome: string) => `workspace:atendimento:${nome}`;
const lerBool = (nome: string, padrao: boolean) => { try { const v = localStorage.getItem(chave(nome)); return v === null ? padrao : v === "1"; } catch { return padrao; } };
const gravarBool = (nome: string, valor: boolean) => { try { localStorage.setItem(chave(nome), valor ? "1" : "0"); } catch { /* preferência só vale nesta abertura */ } };

interface Estado {
  agente: AgenteSessao | null;
  status: StatusAtd | null;
  /** Quando a pessoa clicou em "Iniciar atendimento" (null = em pausa). */
  inicioEm: number | null;
  /** Atende na fila? Quem não atende (ex.: administração) não vê a tela inicial nem recebe alertas de fila. */
  naFila: boolean;
  naoLidas: Record<string, number>;
  /** Conversa aberta na tela agora (não alerta mensagem dela). */
  conversaAberta: string | null;
  som: boolean;
  aviso: boolean;
  setAgente(a: AgenteSessao | null): void;
  setStatus(s: StatusAtd | null): void;
  setNaFila(v: boolean): void;
  setNaoLidas(f: (atual: Record<string, number>) => Record<string, number>): void;
  setConversaAberta(id: string | null): void;
  setSom(v: boolean): void;
  setAviso(v: boolean): void;
}

export const useAtendimento = create<Estado>((set) => ({
  agente: null, status: null, inicioEm: null, naFila: true, naoLidas: {}, conversaAberta: null,
  som: lerBool("som", true), aviso: lerBool("aviso", true),
  setAgente: (agente) => set({ agente }),
  setStatus: (status) => set((e) => ({ status, inicioEm: status === "AVAILABLE" ? (e.status === "AVAILABLE" && e.inicioEm ? e.inicioEm : Date.now()) : null })),
  setNaFila: (naFila) => set({ naFila }),
  setNaoLidas: (f) => set((e) => ({ naoLidas: f(e.naoLidas) })),
  setConversaAberta: (conversaAberta) => set({ conversaAberta }),
  setSom: (som) => { gravarBool("som", som); set({ som }); },
  setAviso: (aviso) => { gravarBool("aviso", aviso); set({ aviso }); },
}));

export const totalNaoLidas = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

/** Muda a disponibilidade no servidor e na tela. */
export async function mudarStatusAtd(status: StatusAtd) {
  await chamar("PATCH", "/api/agent/users/me/status", { body: { attendanceStatus: status } });
  useAtendimento.getState().setStatus(status);
}

let sessao: Promise<AgenteSessao> | null = null;

/**
 * Entra no atendimento (uma vez por abertura do app; chamadas repetidas esperam a mesma entrada).
 * Quem atende na fila começa EM PAUSA: só recebe conversas depois de clicar em "Iniciar atendimento".
 */
export function garantirSessao(forcar = false): Promise<AgenteSessao> {
  if (forcar) sessao = null;
  sessao ??= (async () => {
    const d = window.desktop;
    if (!d?.atendimentoEntrar) throw new Error("Atendimento indisponível.");
    const est = forcar ? null : await d.atendimentoEstado?.().catch(() => null);
    const agente = est?.conectado && est.agente ? est.agente : (await d.atendimentoEntrar()).agente;
    const store = useAtendimento.getState();
    store.setAgente(agente);
    const [me, cfg] = await Promise.all([
      chamar<{ agent: { attendanceStatus?: StatusAtd } }>("GET", "/api/agent/auth/me").catch(() => null),
      chamar<{ inQueue?: boolean }>("GET", "/api/agent/ops/config").catch(() => null),
    ]);
    const naFila = cfg?.inQueue !== false;
    store.setNaFila(naFila);
    let status: StatusAtd = me?.agent.attendanceStatus ?? "AVAILABLE";
    if (naFila && !est?.conectado && status === "AVAILABLE") {
      await chamar("PATCH", "/api/agent/users/me/status", { body: { attendanceStatus: "INVISIBLE" } }).catch(() => undefined);
      status = "INVISIBLE";
    }
    store.setStatus(status);
    return agente;
  })().catch((e) => { sessao = null; throw e; });
  return sessao;
}
