import { useEffect } from "react";
import { garantirSessao, useAtendimento } from "../stores/atendimentoSessao";

/** Dois toques curtos e agudos (diferente da campainha do telefone). */
export function tocarAvisoAtendimento() {
  try {
    const ctx = new AudioContext();
    const t0 = ctx.currentTime;
    for (const [i, freq] of [880, 1174.66].entries()) {
      const osc = ctx.createOscillator(), ganho = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, t0 + i * 0.16);
      ganho.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.16 + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.15);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(t0 + i * 0.16); osc.stop(t0 + i * 0.16 + 0.16);
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), 800);
  } catch { /* sem áudio disponível */ }
}

interface ConversaDados { id?: number | string; ticketMetadata?: { customer?: { name?: string } } }
interface Evento { tipo: string; dados: { message?: { conversationId?: number | string; senderType?: string; authorType?: string; message?: string; text?: string }; conversation?: ConversaDados; auto?: boolean } }

/**
 * Alertas do Atendimento, ativos em qualquer tela do Workspace: som, aviso do Windows e contador de não lidas.
 * Entra no atendimento sozinho (só para quem tem o módulo liberado). Quem entrou começa em pausa e só recebe alertas de
 * fila depois de "Iniciar atendimento"; mensagens de conversas suas contam como não lidas sempre.
 */
export default function AtendimentoAlertas({ permitido }: { permitido: boolean }) {
  useEffect(() => {
    if (!permitido || !window.desktop?.atendimentoEntrar) return;
    const t = window.setTimeout(() => void garantirSessao().catch(() => undefined), 4000);
    const nomes = new Map<string, string>();
    const ultimo = new Map<string, number>();
    const avisar = (id: string, titulo: string, corpo: string) => {
      const e = useAtendimento.getState();
      const agora = Date.now();
      if (agora - (ultimo.get(id) ?? 0) < 15_000) return; // várias mensagens seguidas = um aviso só
      ultimo.set(id, agora);
      if (e.som) tocarAvisoAtendimento();
      if (e.aviso) void window.desktop?.notify({ title: titulo.slice(0, 120), body: corpo.slice(0, 300), target: "/atendimento", kind: "system", context: "Atendimento", tone: "info" });
    };
    const parar = window.desktop.onAtendimento?.("atendimento:evento", (valor) => {
      const { tipo, dados } = valor as Evento;
      const e = useAtendimento.getState();
      if (!e.agente) return;
      const emAtendimento = e.status === "AVAILABLE";
      const lembrar = (c?: ConversaDados) => { if (c?.id !== undefined && c.ticketMetadata?.customer?.name) nomes.set(String(c.id), c.ticketMetadata.customer.name); };
      lembrar(dados.conversation);
      if (tipo === "new_message" && dados.message) {
        const m = dados.message;
        const id = String(m.conversationId ?? "");
        if ((m.senderType ?? m.authorType) !== "customer" || !id) return;
        if (e.conversaAberta === id && document.hasFocus()) return;
        e.setNaoLidas((u) => ({ ...u, [id]: (u[id] ?? 0) + 1 }));
        if (emAtendimento) avisar(`m${id}`, nomes.get(id) ?? "Nova mensagem", String(m.message ?? m.text ?? "O cliente enviou uma mensagem."));
      } else if (tipo === "conversation_created" && emAtendimento && e.naFila) {
        avisar(`c${dados.conversation?.id}`, "Nova conversa na fila", `${dados.conversation?.ticketMetadata?.customer?.name ?? "Um cliente"} está aguardando atendimento.`);
      } else if (tipo === "conversation_assigned" && dados.auto) {
        avisar(`a${dados.conversation?.id}`, "Nova conversa para você", `${dados.conversation?.ticketMetadata?.customer?.name ?? "Um cliente"} foi encaminhado para o seu atendimento.`);
      }
    });
    return () => { window.clearTimeout(t); parar?.(); };
  }, [permitido]);
  return null;
}
