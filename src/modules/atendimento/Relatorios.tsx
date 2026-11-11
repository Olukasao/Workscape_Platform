import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { chamar, duracao, msgErro } from "./chamar";

interface Relatorio {
  totals: { created: number; closed: number; stillOpen: number };
  avgFirstResponseSeconds: number | null; avgResolutionSeconds: number | null;
  bySector: { sectorId: number; created: number; closed: number; avgFirstResponseSeconds: number | null }[];
  byAgent: { agentId: number; name: string; handled: number; closed: number; avgFirstResponseSeconds: number | null }[];
  byHour: { hour: number; count: number }[]; byDay: { day: string; created: number; closed: number }[];
  byCloseReason: { reason: string; count: number }[];
  sectors: { id: number; name: string }[];
}
const MOTIVO: Record<string, string> = { resolved: "Resolvido", no_customer_response: "Cliente não respondeu", sent_to_technician: "Enviado ao técnico", duplicate: "Duplicado", other: "Outro", sem_motivo: "Sem motivo" };

/** Relatórios do atendimento: volume, tempos de resposta e resolução, por setor, atendente, hora e motivo de encerramento. */
export default function Relatorios() {
  const [dias, setDias] = useState(7);
  const q = useQuery({ queryKey: ["atendimento", "relatorio", dias], queryFn: () => chamar<Relatorio>("GET", "/api/agent/ops/reports", { query: { days: String(dias) } }) });
  if (q.isError) return <div className="atd-painel"><p className="term-erro" role="alert">{msgErro(q.error)}</p></div>;
  const r = q.data;
  const maxHora = Math.max(1, ...(r?.byHour.map((h) => h.count) ?? [1]));
  const setor = (id: number) => r?.sectors.find((s) => s.id === id)?.name ?? `Setor ${id}`;
  return (
    <div className="atd-painel">
      <div className="atd-chamados-topo">
        <p className="muted">Tempos em relógio corrido (contam também o tempo fora do expediente).</p>
        <select aria-label="Período" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          {[1, 7, 30, 90].map((d) => <option key={d} value={d}>{d === 1 ? "Últimas 24 horas" : `Últimos ${d} dias`}</option>)}
        </select>
      </div>
      {!r ? <p className="muted">Carregando…</p> : (
        <>
          <div className="atd-cartoes">
            <div className="atd-cartao"><b>{r.totals.created}</b><span>conversas criadas</span></div>
            <div className="atd-cartao"><b>{r.totals.closed}</b><span>encerradas · {r.totals.stillOpen} em aberto</span></div>
            <div className="atd-cartao"><b>{duracao(r.avgFirstResponseSeconds)}</b><span>1ª resposta (média)</span></div>
            <div className="atd-cartao"><b>{duracao(r.avgResolutionSeconds)}</b><span>resolução (média)</span></div>
          </div>
          <h3>Por hora do dia</h3>
          <div className="atd-barras" role="img" aria-label="Conversas criadas por hora">
            {r.byHour.map((h) => <span key={h.hour} title={`${h.hour}h: ${h.count}`} style={{ height: `${(h.count / maxHora) * 100}%` }}><i>{h.hour}</i></span>)}
          </div>
          <h3>Por setor</h3>
          <table className="atd-tabela"><thead><tr><th>Setor</th><th>Criadas</th><th>Encerradas</th><th>1ª resposta</th></tr></thead>
            <tbody>{r.bySector.map((s) => <tr key={s.sectorId}><td>{setor(s.sectorId)}</td><td>{s.created}</td><td>{s.closed}</td><td>{duracao(s.avgFirstResponseSeconds)}</td></tr>)}</tbody></table>
          <h3>Por atendente</h3>
          <table className="atd-tabela"><thead><tr><th>Atendente</th><th>Atendidas</th><th>Encerradas</th><th>1ª resposta</th></tr></thead>
            <tbody>{r.byAgent.length ? r.byAgent.map((a) => <tr key={a.agentId}><td>{a.name}</td><td>{a.handled}</td><td>{a.closed}</td><td>{duracao(a.avgFirstResponseSeconds)}</td></tr>) : <tr><td colSpan={4} className="muted">Sem dados no período.</td></tr>}</tbody></table>
          <h3>Motivos de encerramento</h3>
          <ul className="atd-ficha-lista">{r.byCloseReason.length ? r.byCloseReason.map((m) => <li key={m.reason}><span>{MOTIVO[m.reason] ?? m.reason}: <b>{m.count}</b></span></li>) : <li className="muted">Nenhuma conversa encerrada no período.</li>}</ul>
        </>
      )}
    </div>
  );
}
