import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Plus, SquareTerminal, Trash2 } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { mensagemLimpa, portaPadrao, type ProtocoloTerminal } from "../services/terminal";
import { useSession } from "../stores/workspace";

// Administração do Terminal: a lista de equipamentos é única para todos. Senhas são enviadas só ao salvar; o servidor as
// guarda cifradas e nunca as devolve a esta tela. Cada pessoa tem a própria observação, que o administrador pode consultar.
interface Item { id: string; nome: string; grupo: string; protocolo: ProtocoloTerminal; host: string; porta: number; usuario: string; temSenha: boolean; observacoes: { pessoa: string; texto: string }[] }
interface Form { id?: string; nome: string; grupo: string; protocolo: ProtocoloTerminal; host: string; porta: number; usuario: string; senha: string; guardarSenha: boolean }
const VAZIO: Form = { nome: "", grupo: "", protocolo: "ssh", host: "", porta: 22, usuario: "", senha: "", guardarSenha: true };

export default function ControleTerminal() {
  const cliente = useQueryClient();
  const dono = String(useSession((s) => s.user?.id ?? ""));
  const token = useSession((s) => s.token);
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const dados = useQuery({ queryKey: ["admin", "terminal"], queryFn: async () => (await api.get<{ equipamentos: Item[] }>("/admin/terminal")).data.equipamentos });
  const atualizar = () => { void cliente.invalidateQueries({ queryKey: ["admin", "terminal"] }); };

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const { id, ...corpo } = f;
      const envio = { ...corpo, senha: f.senha || undefined };
      if (id) await api.put(`/admin/terminal/${encodeURIComponent(id)}`, envio); else await api.post("/admin/terminal", envio);
    },
    onSuccess: () => { setForm(null); setErro(""); atualizar(); },
    onError: (e) => setErro(errorMessage(e)),
  });
  const excluir = useMutation({
    mutationFn: async (i: Item) => { await api.delete(`/admin/terminal/${encodeURIComponent(i.id)}`); },
    onSuccess: atualizar,
    onError: (e) => setAviso(errorMessage(e)),
  });
  const importar = useMutation({
    mutationFn: async () => window.desktop!.terminalImportarLocais({ dono, token: token || undefined }),
    onSuccess: (r) => { setAviso(r.total ? `Importado deste computador: ${r.novos} novo(s), ${r.atualizados} atualizado(s), ${r.ignorados} ignorado(s) (de ${r.total} encontrados).` : "Nenhum equipamento salvo neste computador foi encontrado."); atualizar(); },
    onError: (e) => setAviso(`Não foi possível importar: ${mensagemLimpa(e)}`),
  });
  const enviar = (e: FormEvent) => { e.preventDefault(); if (form) salvar.mutate(form); };
  const lista = dados.data ?? [];

  return (
    <section className="panel settings-section">
      <div className="section-title">
        <span className="section-icon"><SquareTerminal size={17} /></span>
        <div>
          <h2>Terminal</h2>
          <p>Equipamentos que aparecem no Terminal de todos. Só administradores criam, editam e apagam; cada pessoa pode anotar uma observação só dela.</p>
        </div>
      </div>
      <div className="term-form-acoes">
        <span>
          <button type="button" className="btn" onClick={() => { setForm({ ...VAZIO }); setErro(""); }}><Plus size={14} /> Novo equipamento</button>{" "}
          {window.desktop?.terminalImportarLocais ? <button type="button" className="btn" disabled={importar.isPending} onClick={() => importar.mutate()} title="Envia a lista salva neste computador (com as senhas) para todos"><Download size={14} /> Importar deste computador</button> : null}
        </span>
      </div>
      {aviso ? <p className="muted" role="status">{aviso}</p> : null}
      {dados.isError ? <p className="term-erro" role="alert">{errorMessage(dados.error)}</p> : null}
      {!lista.length && !dados.isLoading ? <p className="muted">Nenhum equipamento ainda. Importe a lista de quem já configurou o terminal ou crie um novo.</p> : null}
      <table className="tabela">
        <thead><tr><th>Nome</th><th>Pasta</th><th>Endereço</th><th>Usuário</th><th>Senha</th><th>Observações</th><th /></tr></thead>
        <tbody>
          {lista.map((i) => (
            <tr key={i.id}>
              <td>{i.nome}</td><td>{i.grupo || "—"}</td><td>{i.protocolo.toUpperCase()} · {i.host}:{i.porta}</td><td>{i.usuario || "—"}</td>
              <td>{i.temSenha ? "guardada" : "pede ao conectar"}</td>
              <td>{i.observacoes.length ? i.observacoes.map((o, n) => <div key={n}><b>{o.pessoa}:</b> {o.texto}</div>) : <span className="muted">—</span>}</td>
              <td>
                <button type="button" aria-label={`Editar ${i.nome}`} title="Editar" onClick={() => { setForm({ ...i, senha: "", guardarSenha: i.temSenha }); setErro(""); }}><Pencil size={14} /></button>
                <button type="button" aria-label={`Excluir ${i.nome}`} title="Excluir" onClick={() => { if (window.confirm(`Excluir "${i.nome}" para todos? A senha guardada também será apagada.`)) excluir.mutate(i); }}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {form ? (
        <div className="term-modal" role="dialog" aria-modal="true" aria-label="Equipamento">
          <form className="term-form" onSubmit={enviar}>
            <h3>{form.id ? "Editar equipamento" : "Novo equipamento"}</h3>
            <label>Nome<input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoFocus /></label>
            <label>Pasta (opcional)<input value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.target.value })} /></label>
            <div className="term-form-linha">
              <label>Protocolo
                <select value={form.protocolo} onChange={(e) => { const protocolo = e.target.value as ProtocoloTerminal; setForm({ ...form, protocolo, porta: portaPadrao(protocolo), guardarSenha: protocolo === "ssh" && form.guardarSenha }); }}>
                  <option value="ssh">SSH</option><option value="telnet">Telnet</option>
                </select>
              </label>
              <label>Porta<input type="number" min={1} max={65535} required value={form.porta} onChange={(e) => setForm({ ...form, porta: Number(e.target.value) })} /></label>
            </div>
            <label>Endereço (IP ou nome)<input required value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} /></label>
            <label>Usuário<input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} autoComplete="off" /></label>
            {form.protocolo === "ssh" ? (
              <>
                <label className="term-check"><input type="checkbox" checked={form.guardarSenha} onChange={(e) => setForm({ ...form, guardarSenha: e.target.checked })} />Guardar a senha no servidor (cifrada) para todos conectarem</label>
                {form.guardarSenha ? <label>Senha<input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder={form.id ? "Deixe em branco para manter a atual" : ""} autoComplete="new-password" /></label> : <small className="muted">Sem guardar, a senha é pedida a cada conexão.</small>}
              </>
            ) : <small className="muted">No Telnet a senha é digitada no próprio terminal e nunca é guardada.</small>}
            {erro ? <p className="term-erro" role="alert">{erro}</p> : null}
            <div className="term-form-acoes"><span /><span>
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancelar</button>{" "}
              <button type="submit" className="btn" disabled={salvar.isPending}>Salvar</button>
            </span></div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
