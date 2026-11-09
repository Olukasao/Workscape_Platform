import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Globe, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { api, errorMessage } from "../services/api";

// Navegador por setor: o administrador cadastra sites extras e escolhe quais sites cada setor vê.
// Setor sem lista salva vê todos. Administradores veem todos. Sites padrão não podem ser editados.
interface Site { id: string; nome: string; url?: string; personalizado: boolean }
interface Setor { id: number; nome: string; sites: string[] | null }
interface Config { sites: Site[]; setores: Setor[] }
const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));

export default function ControleNavegador() {
  const cliente = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "navegador"], queryFn: async () => (await api.get<Config>("/admin/navegador")).data });
  const refazer = () => { void cliente.invalidateQueries({ queryKey: ["admin", "navegador"] }); void cliente.invalidateQueries({ queryKey: ["navegador", "sites"] }); };

  // --- sites extras ---
  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const limpar = () => { setEditando(null); setNome(""); setUrl(""); };
  const salvarSite = useMutation({
    mutationFn: async () => editando ? (await api.put(`/admin/navegador/sites/${editando}`, { nome, url })).data : (await api.post("/admin/navegador/sites", { nome, url })).data,
    onSuccess: () => { limpar(); refazer(); },
  });
  const removerSite = useMutation({ mutationFn: async (id: string) => api.delete(`/admin/navegador/sites/${id}`), onSuccess: refazer });

  // --- quem vê cada site ---
  const [setorId, setSetorId] = useState<number | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState("");
  const setor = q.data?.setores.find((s) => s.id === setorId) ?? null;
  useEffect(() => { if (setorId === null && q.data?.setores.length) setSetorId(q.data.setores[0].id); }, [q.data, setorId]);
  useEffect(() => {
    if (!q.data || !setor) return;
    setMarcados(new Set(setor.sites ?? q.data.sites.map((s) => s.id)));
    setAviso("");
  }, [setor?.id, setor?.sites, q.data]);
  const salvarAcesso = useMutation({
    mutationFn: async (sites: string[] | null) => api.put(`/admin/navegador/setor/${setorId}`, { sites }),
    onSuccess: (_r, sites) => { setAviso(sites === null ? "Voltou ao padrão: o setor vê todos os sites." : "Salvo. Vale na próxima vez que a pessoa abrir o Navegador (até 1 minuto)."); refazer(); },
  });
  const alternar = (id: string) => setMarcados((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (q.isLoading) return <p>Carregando…</p>;
  if (q.error) return <p role="alert">{msgDe(q.error)}</p>;
  const dados = q.data!;
  const enviar = (e: FormEvent) => { e.preventDefault(); salvarSite.mutate(); };

  return (
    <section aria-labelledby="nav-titulo" style={{ display: "grid", gap: 24, maxWidth: 760 }}>
      <header>
        <h2 id="nav-titulo" style={{ margin: 0 }}>Navegador</h2>
        <p style={{ margin: "4px 0 0", opacity: 0.75 }}>Escolha quais sites cada setor vê no Navegador do Workspace e cadastre sites novos. Administradores veem todos.</p>
      </header>

      <div style={{ display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Sites extras</h3>
        {dados.sites.filter((s) => s.personalizado).length === 0 ? <p style={{ margin: 0, opacity: 0.7 }}>Nenhum site extra ainda. Os sites padrão (SGP, Mundiale, OLT, Call Center, Zabbix, Grafana e Navegador comum) já existem.</p> : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {dados.sites.filter((s) => s.personalizado).map((s) => (
              <li key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(128,128,128,.25)" }}>
                <Globe size={16} aria-hidden="true" />
                <div style={{ flex: 1, minWidth: 0 }}><strong>{s.nome}</strong><div style={{ opacity: 0.7, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.url}</div></div>
                <button type="button" aria-label={`Editar ${s.nome}`} onClick={() => { setEditando(s.id); setNome(s.nome); setUrl(s.url ?? ""); }}><Pencil size={14} /></button>
                <button type="button" aria-label={`Remover ${s.nome}`} disabled={removerSite.isPending} onClick={() => { if (window.confirm(`Remover "${s.nome}" para todos os setores?`)) removerSite.mutate(s.id); }}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={enviar} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4 }}><span>Nome</span><input value={nome} maxLength={30} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Portal do parceiro" required /></label>
          <label style={{ display: "grid", gap: 4, flex: 1, minWidth: 220 }}><span>Endereço</span><input value={url} maxLength={300} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required /></label>
          <button type="submit" disabled={salvarSite.isPending}>{editando ? <><Save size={14} /> Salvar site</> : <><Plus size={14} /> Adicionar site</>}</button>
          {editando ? <button type="button" onClick={limpar}><X size={14} /> Cancelar</button> : null}
        </form>
        {salvarSite.isError ? <p role="alert" style={{ margin: 0 }}>{msgDe(salvarSite.error)}</p> : null}
        {removerSite.isError ? <p role="alert" style={{ margin: 0 }}>{msgDe(removerSite.error)}</p> : null}
        {!editando ? <p style={{ margin: 0, opacity: 0.65, fontSize: 12 }}>O site novo só aparece para os setores que você liberar abaixo (setores sem lista salva veem todos).</p> : null}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Quem vê cada site</h3>
        <label style={{ display: "grid", gap: 4, maxWidth: 320 }}><span>Setor</span>
          <select value={setorId ?? ""} onChange={(e) => setSetorId(Number(e.target.value))}>
            {dados.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.sites ? " · personalizado" : ""}</option>)}
          </select>
        </label>
        {setor ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 6 }}>
              {dados.sites.map((s) => (
                <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={marcados.has(s.id)} onChange={() => alternar(s.id)} /> {s.nome}{s.personalizado ? " (extra)" : ""}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" disabled={salvarAcesso.isPending} onClick={() => salvarAcesso.mutate([...marcados])}><Save size={14} /> Salvar para {setor.nome}</button>
              <button type="button" disabled={salvarAcesso.isPending || !setor.sites} onClick={() => salvarAcesso.mutate(null)}>Voltar ao padrão (ver todos)</button>
            </div>
            {marcados.size === 0 ? <p style={{ margin: 0 }}>Com nenhum site marcado, o Navegador desse setor fica vazio.</p> : null}
            {aviso ? <p role="status" style={{ margin: 0 }}>{aviso}</p> : null}
            {salvarAcesso.isError ? <p role="alert" style={{ margin: 0 }}>{msgDe(salvarAcesso.error)}</p> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
