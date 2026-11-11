import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { chamar, msgErro } from "./chamar";

interface Config {
  sectors: { id: number; slug: string; name: string; active: boolean }[];
  settings: { hours: { timezone: string; days: number[]; start: string; end: string }; sla: { firstResponseSeconds: number; warnAtSeconds: number; replySeconds: number }; afterHoursMessage: string; defaultSectorSlug: string };
}
interface Agente { id: number; name: string; email: string; role: "agent" | "supervisor" | "admin"; status: "active" | "disabled"; sectorIds: number[]; inQueue: boolean }
interface AgentesResp { agents: Agente[] }
interface Candidato { name: string; email: string; departmentName: string | null }
const CARGOS: { id: Agente["role"]; nome: string }[] = [{ id: "agent", nome: "Atendente" }, { id: "supervisor", nome: "Supervisor" }, { id: "admin", nome: "Administrador" }];
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Só administradores: expediente, metas de SLA, setores e quem atende cada setor. */
export default function Configuracoes() {
  const cliente = useQueryClient();
  const cfg = useQuery({ queryKey: ["atendimento", "config"], queryFn: () => chamar<Config>("GET", "/api/agent/ops/config") });
  const agentes = useQuery({ queryKey: ["atendimento", "agentes"], queryFn: () => chamar<AgentesResp>("GET", "/api/agent/ops/agents") });
  const [f, setF] = useState<Config["settings"] | null>(null);
  const [aviso, setAviso] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [mostrarRemovidos, setMostrarRemovidos] = useState(false);
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
  const todos = agentes.data?.agents ?? [];
  const ativos = todos.filter((a) => a.status === "active");
  const removidos = todos.filter((a) => a.status === "disabled");
  const mudarFila = async (a: Agente, inQueue: boolean) => { setAviso(""); try { await chamar("PUT", `/api/agent/ops/agents/${a.id}/queue`, { body: { inQueue } }); await agentes.refetch(); } catch (e) { setAviso(msgErro(e)); } };
  const mudarCargo = async (a: Agente, role: Agente["role"]) => { setAviso(""); try { await chamar("PATCH", `/api/agent/ops/agents/${a.id}`, { body: { role } }); await agentes.refetch(); } catch (e) { setAviso(msgErro(e)); await agentes.refetch(); } };
  const remover = async (a: Agente) => {
    if (!window.confirm(`Tirar ${a.name} do atendimento? Ele perde o acesso na hora. O histórico das conversas fica e você pode reativar depois.`)) return;
    setAviso("");
    try {
      const r = await chamar<{ pendingConversations: number }>("PATCH", `/api/agent/ops/agents/${a.id}`, { body: { status: "disabled" } });
      setAviso(r.pendingConversations ? `${a.name} foi removido, mas ${r.pendingConversations} conversa(s) ativa(s) continuam com ele: transfira em Supervisão.` : `${a.name} foi removido do atendimento.`);
      await agentes.refetch();
    } catch (e) { setAviso(msgErro(e)); }
  };
  const reativar = async (a: Agente) => { setAviso(""); try { await chamar("PATCH", `/api/agent/ops/agents/${a.id}`, { body: { status: "active" } }); setAviso(`${a.name} voltou ao atendimento.`); await agentes.refetch(); } catch (e) { setAviso(msgErro(e)); } };

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
      <div className="atd-config-cab">
        <h3>Atendentes e setores</h3>
        <Button size="sm" onClick={() => setAdicionando(true)}><UserPlus size={14} />Adicionar pessoas</Button>
      </div>
      <p className="muted"><b>Atende na fila:</b> desmarque para quem só administra (ex.: administradores). A pessoa continua entrando no Atendimento, mas não aparece para transferência nem nas contas de atendentes disponíveis. Atendente sem nenhum setor marcado atende todos. Os setores organizam a fila; não impedem um atendente de abrir uma conversa que lhe foi passada. Remover tira o acesso ao atendimento (o histórico das conversas fica e dá para reativar).</p>
      <table className="atd-tabela">
        <thead><tr><th>Pessoa</th><th>Cargo</th><th title="Desmarque para quem só administra e não deve receber atendimentos">Atende na fila</th>{cfg.data.sectors.map((s) => <th key={s.id}>{s.name}</th>)}<th /></tr></thead>
        <tbody>
          {ativos.map((a) => (
            <tr key={a.id}>
              <td>{a.name}<small className="muted"> {a.email}</small></td>
              <td>
                <select aria-label={`Cargo de ${a.name}`} value={a.role} onChange={(e) => void mudarCargo(a, e.target.value as Agente["role"])}>
                  {CARGOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </td>
              <td><input type="checkbox" aria-label={`${a.name} atende na fila`} checked={a.inQueue} onChange={(e) => void mudarFila(a, e.target.checked)} /></td>
              {cfg.data!.sectors.map((s) => (
                <td key={s.id}><input type="checkbox" aria-label={`${a.name} em ${s.name}`} checked={a.sectorIds.includes(s.id)} onChange={(e) => void setSetores(a.id, e.target.checked ? [...a.sectorIds, s.id] : a.sectorIds.filter((x) => x !== s.id))} /></td>
              ))}
              <td><button type="button" className="atd-link atd-perigo" onClick={() => void remover(a)} title="Tirar do atendimento"><UserMinus size={14} /> Remover</button></td>
            </tr>
          ))}
          {!ativos.length ? <tr><td colSpan={cfg.data.sectors.length + 4} className="muted">Nenhum atendente cadastrado.</td></tr> : null}
        </tbody>
      </table>
      {removidos.length ? (
        <>
          <button type="button" className="atd-link" onClick={() => setMostrarRemovidos((v) => !v)}>{mostrarRemovidos ? "Esconder" : "Mostrar"} removidos ({removidos.length})</button>
          {mostrarRemovidos ? (
            <ul className="atd-ficha-lista">
              {removidos.map((a) => <li key={a.id}><span>{a.name} <small className="muted">{a.email}</small> <button type="button" className="atd-link" onClick={() => void reativar(a)}>Reativar</button></span></li>)}
            </ul>
          ) : null}
        </>
      ) : null}
      {adicionando ? <AdicionarPessoas aoFechar={() => setAdicionando(false)} aoAdicionar={(msg) => { setAdicionando(false); setAviso(msg); void agentes.refetch(); }} /> : null}
    </div>
  );
}

/** Escolher, entre as pessoas do Chat Interno, quem passa a atender. Só aparece quem ainda não é atendente. */
function AdicionarPessoas({ aoFechar, aoAdicionar }: { aoFechar: () => void; aoAdicionar: (mensagem: string) => void }) {
  const lista = useQuery({ queryKey: ["atendimento", "candidatos"], queryFn: () => chamar<{ candidates: Candidato[] }>("GET", "/api/agent/ops/candidates"), staleTime: 0 });
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [cargo, setCargo] = useState<Agente["role"]>("agent");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const q = busca.trim().toLowerCase();
  const visiveis = (lista.data?.candidates ?? []).filter((c) => !q || `${c.name} ${c.email} ${c.departmentName ?? ""}`.toLowerCase().includes(q));
  const alternar = (email: string) => setMarcados((m) => (m.includes(email) ? m.filter((x) => x !== email) : [...m, email]));
  const adicionar = async () => {
    setSalvando(true); setErro("");
    try {
      const r = await chamar<{ created: { name: string }[]; skipped: { email: string; reason: string }[] }>("POST", "/api/agent/ops/agents", { body: { people: marcados.map((email) => ({ email, role: cargo })) } });
      aoAdicionar(`${r.created.length} pessoa(s) adicionada(s) ao atendimento${r.skipped.length ? `; ${r.skipped.length} não puderam ser adicionadas (${r.skipped.map((x) => x.email).join(", ")})` : ""}.`);
    } catch (e) { setErro(msgErro(e)); } finally { setSalvando(false); }
  };
  return (
    <div className="term-modal" role="dialog" aria-modal="true" aria-label="Adicionar pessoas ao atendimento">
      <div className="term-form atd-adicionar">
        <div className="atd-config-cab"><h3>Adicionar pessoas ao atendimento</h3><button type="button" className="atd-link" aria-label="Fechar" onClick={aoFechar}><X size={16} /></button></div>
        <p className="muted">São as pessoas do Chat Interno. Elas entram no atendimento com o mesmo login do Workspace.</p>
        <input placeholder="Buscar por nome, e-mail ou setor" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
        <div className="atd-candidatos" role="group" aria-label="Pessoas">
          {lista.isLoading ? <p className="muted">Carregando…</p> : null}
          {lista.isError ? <p className="term-erro" role="alert">{msgErro(lista.error)}</p> : null}
          {lista.data && !visiveis.length ? <p className="muted">Ninguém encontrado.</p> : null}
          {visiveis.map((c) => (
            <label key={c.email} className="atd-candidato"><input type="checkbox" checked={marcados.includes(c.email)} onChange={() => alternar(c.email)} /><span><b>{c.name}</b><small className="muted">{c.email}{c.departmentName ? ` · ${c.departmentName}` : ""}</small></span></label>
          ))}
        </div>
        <label>Cargo das pessoas escolhidas
          <select value={cargo} onChange={(e) => setCargo(e.target.value as Agente["role"])}>{CARGOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </label>
        {erro ? <p className="term-erro" role="alert">{erro}</p> : null}
        <div className="term-form-acoes"><span /><span>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>{" "}
          <Button type="button" disabled={!marcados.length || salvando} onClick={() => void adicionar()}>{salvando ? "Adicionando…" : `Adicionar ${marcados.length || ""}`.trim()}</Button>
        </span></div>
      </div>
    </div>
  );
}
