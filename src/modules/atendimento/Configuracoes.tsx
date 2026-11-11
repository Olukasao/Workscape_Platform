import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/button";
import { chamar, msgErro } from "./chamar";

interface Config {
  sectors: { id: number; slug: string; name: string; active: boolean }[];
  settings: { hours: { timezone: string; days: number[]; start: string; end: string }; sla: { firstResponseSeconds: number; warnAtSeconds: number; replySeconds: number }; afterHoursMessage: string; defaultSectorSlug: string };
}
interface AgentesResp { agents: { id: number; name: string; email: string; role: string; sectorIds: number[] }[] }
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Só administradores: expediente, metas de SLA, setores e quem atende cada setor. */
export default function Configuracoes() {
  const cliente = useQueryClient();
  const cfg = useQuery({ queryKey: ["atendimento", "config"], queryFn: () => chamar<Config>("GET", "/api/agent/ops/config") });
  const agentes = useQuery({ queryKey: ["atendimento", "agentes"], queryFn: () => chamar<AgentesResp>("GET", "/api/agent/ops/agents") });
  const [f, setF] = useState<Config["settings"] | null>(null);
  const [aviso, setAviso] = useState("");
  useEffect(() => { if (cfg.data && !f) setF(cfg.data.settings); }, [cfg.data, f]);
  if (cfg.isError) return <div className="atd-painel"><p className="term-erro" role="alert">{msgErro(cfg.error)}</p></div>;
  if (!cfg.data || !f) return <div className="atd-painel"><p className="muted">Carregando…</p></div>;

  const recarregar = () => { void cliente.invalidateQueries({ queryKey: ["atendimento"] }); };
  const salvar = async () => {
    setAviso("");
    try { await chamar("PUT", "/api/agent/ops/settings", { body: f }); setAviso("Configurações salvas."); recarregar(); }
    catch (e) { setAviso(msgErro(e)); }
  };
  const alternarSetor = async (id: number, ativo: boolean) => { try { await chamar("PATCH", `/api/agent/ops/sectors/${id}`, { body: { active: ativo } }); recarregar(); } catch (e) { setAviso(msgErro(e)); } };
  const setSetores = async (agentId: number, ids: number[]) => { try { await chamar("PUT", `/api/agent/ops/agents/${agentId}/sectors`, { body: { sectorIds: ids } }); await agentes.refetch(); } catch (e) { setAviso(msgErro(e)); } };
  const min = (s: number) => Math.round(s / 60);

  return (
    <div className="atd-painel atd-config">
      {aviso ? <p role="status" className="muted">{aviso}</p> : null}
      <h3>Expediente</h3>
      <div className="atd-form-linha">
        <label>Abre às<input type="time" value={f.hours.start} onChange={(e) => setF({ ...f, hours: { ...f.hours, start: e.target.value } })} /></label>
        <label>Fecha às<input type="time" value={f.hours.end} onChange={(e) => setF({ ...f, hours: { ...f.hours, end: e.target.value } })} /></label>
      </div>
      <div className="atd-dias" role="group" aria-label="Dias de atendimento">
        {DIAS.map((d, i) => (
          <label key={d}><input type="checkbox" checked={f.hours.days.includes(i)} onChange={(e) => setF({ ...f, hours: { ...f.hours, days: e.target.checked ? [...f.hours.days, i].sort() : f.hours.days.filter((x) => x !== i) } })} />{d}</label>
        ))}
      </div>
      <label>Mensagem fora do expediente<textarea rows={2} maxLength={500} value={f.afterHoursMessage} onChange={(e) => setF({ ...f, afterHoursMessage: e.target.value })} /></label>
      <h3>Metas de SLA</h3>
      <div className="atd-form-linha">
        <label>1ª resposta (min)<input type="number" min={1} value={min(f.sla.firstResponseSeconds)} onChange={(e) => setF({ ...f, sla: { ...f.sla, firstResponseSeconds: Number(e.target.value) * 60 } })} /></label>
        <label>Alerta aos (min)<input type="number" min={1} value={min(f.sla.warnAtSeconds)} onChange={(e) => setF({ ...f, sla: { ...f.sla, warnAtSeconds: Number(e.target.value) * 60 } })} /></label>
        <label>Demais respostas (min)<input type="number" min={1} value={min(f.sla.replySeconds)} onChange={(e) => setF({ ...f, sla: { ...f.sla, replySeconds: Number(e.target.value) * 60 } })} /></label>
      </div>
      <label>Setor padrão das conversas novas
        <select value={f.defaultSectorSlug} onChange={(e) => setF({ ...f, defaultSectorSlug: e.target.value })}>{cfg.data.sectors.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}</select>
      </label>
      <div><Button onClick={() => void salvar()}>Salvar configurações</Button></div>

      <h3>Setores</h3>
      <ul className="atd-ficha-lista">
        {cfg.data.sectors.map((s) => <li key={s.id}><label><input type="checkbox" checked={s.active} onChange={(e) => void alternarSetor(s.id, e.target.checked)} /> {s.name}</label></li>)}
      </ul>
      <h3>Quem atende cada setor</h3>
      <p className="muted">Atendente sem nenhum setor marcado atende todos. Isto organiza a fila; não impede um atendente de abrir uma conversa que lhe foi passada.</p>
      <table className="atd-tabela">
        <thead><tr><th>Atendente</th>{cfg.data.sectors.map((s) => <th key={s.id}>{s.name}</th>)}</tr></thead>
        <tbody>
          {(agentes.data?.agents ?? []).map((a) => (
            <tr key={a.id}>
              <td>{a.name}<small className="muted"> {a.role}</small></td>
              {cfg.data!.sectors.map((s) => (
                <td key={s.id}><input type="checkbox" aria-label={`${a.name} em ${s.name}`} checked={a.sectorIds.includes(s.id)} onChange={(e) => void setSetores(a.id, e.target.checked ? [...a.sectorIds, s.id] : a.sectorIds.filter((x) => x !== s.id))} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
