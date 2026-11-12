import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { FileText, Mic, RefreshCw, Search, Trash2 } from "lucide-react";
import { api, errorMessage } from "../services/api";
import ConversaTranscrita from "./ConversaTranscrita";

// Admin > Histórico de chamadas: todas as ligações do Workscape Phone, com a transcrição, o resumo e o motivo sugerido.
// O áudio é transcrito no servidor (faster-whisper) e apagado em seguida; só o texto fica, pelo prazo configurado aqui.
type EstadoTranscricao = "fila" | "transcrevendo" | "pronta" | "erro" | "sem_fala";
interface Linha { id: number; usuarioId: number; nome: string; direcao: "in" | "out"; numero: string; resultado: string; duracaoSeg: number; inicio: string; transcricaoId: number | null; transcricao: EstadoTranscricao | null; resumo: string | null; motivo: string | null }
interface Detalhe { id: number; nome?: string; numero: string; resumo: string | null; motivo: string | null; status: EstadoTranscricao; erro: string | null; falas: { quem: "atendente" | "cliente"; ini: number; texto: string }[] }
interface Config { ativa: boolean; dias: number }

const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));
const RESULTADOS: Record<string, string> = { atendida: "Atendida", nao_atendida: "Não atendida", rejeitada: "Rejeitada", falhou: "Falhou" };
const ESTADOS: Record<EstadoTranscricao, string> = { fila: "Na fila", transcrevendo: "Transcrevendo…", pronta: "Pronta", erro: "Falhou", sem_fala: "Sem fala" };
const duracao = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const quando = (v: string) => new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const marca = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s) % 60).padStart(2, "0")}`;

export default function ControleHistoricoChamadas() {
  const cliente = useQueryClient();
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [dias, setDias] = useState<string>("");

  const config = useQuery({ queryKey: ["admin", "phone", "gravacao"], queryFn: async () => (await api.get<Config>("/admin/phone/gravacao-config")).data });
  const lista = useQuery({
    queryKey: ["admin", "phone", "historico", termo, de, ate],
    queryFn: async () => (await api.get<{ chamadas: Linha[] }>("/admin/phone/historico", { params: { q: termo || undefined, de: de || undefined, ate: ate || undefined } })).data.chamadas,
    // Enquanto alguma transcrição está em andamento, a lista se atualiza sozinha.
    refetchInterval: (q) => (q.state.data?.some((c) => c.transcricao === "fila" || c.transcricao === "transcrevendo") ? 8000 : false),
  });
  const detalhe = useQuery({
    queryKey: ["admin", "phone", "transcricao", aberta],
    queryFn: async () => (await api.get<Detalhe>(`/admin/phone/transcricoes/${aberta}`)).data,
    enabled: aberta !== null,
  });
  const salvarConfig = useMutation({
    mutationFn: async (corpo: Partial<Config>) => (await api.put<Config>("/admin/phone/gravacao-config", corpo)).data,
    onSuccess: () => { setErro(""); void cliente.invalidateQueries({ queryKey: ["admin", "phone", "gravacao"] }); },
    onError: (e) => setErro(msgDe(e)),
  });
  const excluir = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/admin/phone/transcricoes/${id}`); },
    onSuccess: () => { setAberta(null); void cliente.invalidateQueries({ queryKey: ["admin", "phone", "historico"] }); },
    onError: (e) => setErro(msgDe(e)),
  });

  const cfg = config.data;
  return (
    <section className="versoes iaadm" aria-labelledby="histchamadas-titulo">
      <header className="versoes-topo">
        <div>
          <h2 id="histchamadas-titulo">Histórico de chamadas</h2>
          <p className="muted">Ligações do Workscape Phone com transcrição, resumo e motivo sugerido. O áudio é apagado depois de transcrito.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Atualizar" onClick={() => { void lista.refetch(); void config.refetch(); }}>
          <RefreshCw size={16} className={lista.isFetching ? "animate-spin" : ""} />
        </button>
      </header>
      {erro ? <p role="alert" className="iaadm-erro">{erro}</p> : null}

      <h3 className="iaadm-h">Gravação e transcrição</h3>
      <div className="iaadm-nota">
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={!!cfg?.ativa} disabled={!cfg || salvarConfig.isPending} onChange={(e) => salvarConfig.mutate({ ativa: e.target.checked })} />
          <Mic size={15} aria-hidden="true" /> Gravar e transcrever as chamadas atendidas
        </label>
        <p className="muted">
          Ligue só depois de avisar o cliente no início da ligação (por exemplo, na mensagem da central: “esta ligação pode ser gravada”) e de definir quem pode ler as transcrições (LGPD).
          Cada leitura de transcrição fica na auditoria do telefone. A mudança vale na próxima ligação de cada atendente.
        </p>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Guardar o texto por
          <input type="number" min={1} max={3650} style={{ width: 80 }} value={dias || cfg?.dias || ""} onChange={(e) => setDias(e.target.value)} />
          dias
          <button type="button" className="secondary-action" disabled={!dias || salvarConfig.isPending} onClick={() => salvarConfig.mutate({ dias: Number(dias) })}>Salvar prazo</button>
        </label>
      </div>

      <h3 className="iaadm-h">Chamadas</h3>
      <form className="iaadm-nota" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} onSubmit={(e) => { e.preventDefault(); setTermo(busca.trim()); }}>
        <input type="search" placeholder="Buscar por nome, número ou trecho da conversa" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ minWidth: 280, flex: 1 }} aria-label="Buscar" />
        <label>De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        <button type="submit" className="secondary-action"><Search size={14} aria-hidden="true" /> Buscar</button>
      </form>
      {lista.isError ? <p role="alert" className="iaadm-erro">{msgDe(lista.error)}</p> : null}
      <div className="versoes-tabela-caixa">
        <table className="versoes-tabela">
          <thead><tr><th>Quando</th><th>Atendente</th><th>Número</th><th>Tipo</th><th>Resultado</th><th>Duração</th><th>Transcrição</th><th>Motivo sugerido</th><th /></tr></thead>
          <tbody>
            {lista.data?.map((c) => (
              <tr key={c.id}>
                <td>{quando(c.inicio)}</td><td>{c.nome}</td><td>{c.numero}</td><td>{c.direcao === "in" ? "Recebida" : "Feita"}</td>
                <td>{RESULTADOS[c.resultado] ?? c.resultado}</td><td>{duracao(c.duracaoSeg)}</td>
                <td>{c.transcricao ? ESTADOS[c.transcricao] : <span className="muted">—</span>}</td>
                <td>{c.motivo ?? <span className="muted">—</span>}</td>
                <td>{c.transcricaoId ? <button type="button" className="secondary-action" onClick={() => setAberta(c.transcricaoId)}><FileText size={14} aria-hidden="true" /> Abrir</button> : null}</td>
              </tr>
            ))}
            {lista.data && !lista.data.length ? <tr><td colSpan={9} className="muted">Nenhuma chamada encontrada.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {aberta !== null ? (
        <div className="modal-backdrop" onClick={() => setAberta(null)}>
        <div role="dialog" aria-modal="true" aria-label="Transcrição da chamada" className="detail-panel" style={{ width: "min(760px, 100%)" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <h3 className="iaadm-h" style={{ margin: 0 }}>Transcrição{detalhe.data?.nome ? ` · ${detalhe.data.nome}` : ""}{detalhe.data ? ` · ${detalhe.data.numero}` : ""}</h3>
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="secondary-action" disabled={excluir.isPending || detalhe.data?.status === "fila" || detalhe.data?.status === "transcrevendo"} onClick={() => { if (window.confirm("Excluir esta transcrição? Isso não pode ser desfeito.")) excluir.mutate(aberta); }}><Trash2 size={14} aria-hidden="true" /> Excluir</button>
              <button type="button" className="secondary-action" onClick={() => setAberta(null)}>Fechar</button>
            </span>
          </div>
          {detalhe.isLoading ? <p className="muted">Carregando…</p> : null}
          {detalhe.isError ? <p role="alert" className="iaadm-erro">{msgDe(detalhe.error)}</p> : null}
          {detalhe.data ? (
            <>
              {detalhe.data.status === "erro" ? <p role="alert" className="iaadm-erro">Não foi possível transcrever: {detalhe.data.erro}</p> : null}
              {detalhe.data.status === "sem_fala" ? <p className="muted">Não havia fala nesta gravação.</p> : null}
              {detalhe.data.falas.length ? <ConversaTranscrita falas={detalhe.data.falas} nomeAtendente={detalhe.data.nome || "Atendente"} /> : null}
              {detalhe.data.resumo ? <p style={{ marginTop: 12 }}><b>Resumo:</b> {detalhe.data.resumo}</p> : null}
              {detalhe.data.motivo ? <p><b>Motivo sugerido:</b> {detalhe.data.motivo}</p> : null}
            </>
          ) : null}
        </div>
        </div>
      ) : null}
    </section>
  );
}
