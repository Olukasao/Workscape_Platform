import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Users } from "lucide-react";
import { chamar, duracao, msgErro } from "./chamar";

interface Overview {
  open: boolean; sla: { firstResponseSeconds: number; warnAtSeconds: number; replySeconds: number };
  bySector: { sectorId: number; name: string; active: number; waiting: number; warning: number; breached: number; longestWaitSeconds: number | null; agentsOnline: number }[];
  agents: { id: number; name: string; role: string; attendanceStatus: string; sectorIds: number[]; activeConversations: number }[];
  atRisk: { conversationId: number; customerName: string | null; state: "warning" | "breached"; kind: string; waitingSeconds: number; sectorId: number | null; assignedAgentId: number | null }[];
}

/** Supervisão ao vivo: filas por setor, atendentes e conversas em risco de estourar o SLA. */
export default function Supervisao({ aoAbrir }: { aoAbrir: (id: number) => void }) {
  const q = useQuery({ queryKey: ["atendimento", "overview"], queryFn: () => chamar<Overview>("GET", "/api/agent/ops/overview"), refetchInterval: 10_000 });
  if (q.isLoading) return <div className="atd-painel"><p className="muted">Carregando…</p></div>;
  if (q.isError || !q.data) return <div className="atd-painel"><p className="term-erro" role="alert">{msgErro(q.error)}</p></div>;
  const o = q.data;
  const setor = (id: number | null) => o.bySector.find((s) => s.sectorId === id)?.name ?? "—";
  const agente = (id: number | null) => o.agents.find((a) => a.id === id)?.name ?? "Sem atendente";
  return (
    <div className="atd-painel">
      <p className="muted"><Clock size={13} /> {o.open ? "Dentro do expediente." : "Fora do expediente: o relógio do SLA está parado."} Meta: primeira resposta em {duracao(o.sla.firstResponseSeconds)}, demais respostas em {duracao(o.sla.replySeconds)}. Atualiza a cada 10 s.</p>
      <h3>Filas por setor</h3>
      <div className="atd-cartoes">
        {o.bySector.map((s) => (
          <div key={s.sectorId} className={`atd-cartao ${s.breached ? "ruim" : s.warning ? "alerta" : ""}`}>
            <b>{s.name}</b>
            <span>{s.active} ativa(s) · {s.waiting} esperando</span>
            <span>{s.breached} estourada(s) · {s.warning} em alerta</span>
            <small className="muted">Maior espera {duracao(s.longestWaitSeconds)} · {s.agentsOnline} atendente(s) disponível(is)</small>
          </div>
        ))}
      </div>
      <h3><AlertTriangle size={14} /> Em risco ({o.atRisk.length})</h3>
      {!o.atRisk.length ? <p className="muted">Nenhuma conversa em risco agora.</p> : (
        <ul className="atd-chamados-lista">
          {o.atRisk.map((c) => (
            <li key={c.conversationId}>
              <div><b>{c.customerName || `Conversa ${c.conversationId}`}</b><small>{setor(c.sectorId)} · {agente(c.assignedAgentId)} · {c.kind === "first_response" ? "primeira resposta" : "resposta"}</small></div>
              <span className={`atd-sla ${c.state}`}>{duracao(c.waitingSeconds)}</span>
              <button type="button" className="atd-link" onClick={() => aoAbrir(c.conversationId)}>Abrir</button>
            </li>
          ))}
        </ul>
      )}
      <h3><Users size={14} /> Atendentes</h3>
      <table className="atd-tabela">
        <thead><tr><th>Atendente</th><th>Cargo</th><th>Status</th><th>Conversas ativas</th><th>Setores</th></tr></thead>
        <tbody>
          {o.agents.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td><td>{a.role}</td>
              <td><i className={`atd-ponto ${a.attendanceStatus === "AVAILABLE" ? "on" : ""}`} /> {a.attendanceStatus === "AVAILABLE" ? "Disponível" : "Invisível"}</td>
              <td>{a.activeConversations}</td>
              <td>{a.sectorIds.length ? a.sectorIds.map(setor).join(", ") : "Todos"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
