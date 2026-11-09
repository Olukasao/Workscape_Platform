import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { CheckCircle2, MonitorSmartphone, RefreshCw, Search, Send, Trash2, TriangleAlert, X } from "lucide-react";
import { clsx } from "clsx";
import { api, errorMessage } from "../services/api";
import { socket } from "../services/socket";

// Painel de administração: cada computador que usa o Workspace, quem o usa, em qual versão está e quando foi visto
// pela última vez. O botão "Forçar atualização" faz o que antes só dava pela linha de comando do servidor.
export interface Dispositivo {
  id: number;
  computador: string;
  ip: string;
  usuario: { id: number; nome: string; email: string; setor: string | null };
  versao: string | null;
  situacao: "atualizado" | "desatualizado" | "desconhecida";
  online: boolean;
  primeiro_visto: string;
  ultimo_visto: string;
}
export interface SinalAtualizacao { id: string; versao: string; obrigatoria: boolean; mensagem?: string; ignorarRegra?: boolean; criadoEm: string }
interface Resposta { publicada: string | null; sinal: SinalAtualizacao | null; dispositivos: Dispositivo[] }
export type Filtro = "todos" | "desatualizados" | "online" | "offline";

/** "agora", "há 5 min", "há 3 h", "ontem 14:30" ou a data: do jeito que se fala. */
export function vistoEm(iso: string, agora = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const min = Math.max(0, Math.floor((agora - t) / 60000));
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function contar(lista: Dispositivo[]) {
  return {
    total: lista.length,
    atualizados: lista.filter((d) => d.situacao === "atualizado").length,
    desatualizados: lista.filter((d) => d.situacao === "desatualizado").length,
    online: lista.filter((d) => d.online).length,
  };
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function filtrar(lista: Dispositivo[], filtro: Filtro, busca: string): Dispositivo[] {
  const termo = semAcento(busca.trim());
  return lista.filter((d) => {
    if (filtro === "desatualizados" && d.situacao !== "desatualizado") return false;
    if (filtro === "online" && !d.online) return false;
    if (filtro === "offline" && d.online) return false;
    return !termo || semAcento(`${d.usuario.nome} ${d.computador} ${d.ip} ${d.usuario.setor ?? ""}`).includes(termo);
  });
}

const rotuloSituacao = { atualizado: "Atualizado", desatualizado: "Desatualizado", desconhecida: "Versão desconhecida" } as const;
const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));

export default function VersoesWorkspace() {
  const cliente = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [forcando, setForcando] = useState(false);
  const [comAviso, setComAviso] = useState(false);
  const [ignorarRegra, setIgnorarRegra] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [feito, setFeito] = useState("");
  const [confirmarRemocao, setConfirmarRemocao] = useState<number | null>(null);

  const dados = useQuery({
    queryKey: ["admin", "workspace-dispositivos"],
    queryFn: async () => (await api.get<Resposta>("/admin/workspace/dispositivos")).data,
    refetchInterval: 30000,
  });
  // Atualiza na hora quando alguém abre ou fecha o aplicativo.
  useEffect(() => {
    const s = socket;
    const mudou = () => void cliente.invalidateQueries({ queryKey: ["admin", "workspace-dispositivos"] });
    s.on("workspace_presence_changed", mudou);
    return () => { s.off("workspace_presence_changed", mudou); };
  }, [cliente]);

  const forcar = useMutation({
    mutationFn: async () => (await api.post<{ sinal: SinalAtualizacao }>("/admin/workspace/forcar-atualizacao", { obrigatoria: comAviso, mensagem: comAviso ? mensagem : "", ignorarRegra })).data.sinal,
    onSuccess: (sinal) => {
      setFeito(`Pedido enviado: os computadores recebem em até 1 minuto (versão ${sinal.versao}, ${sinal.obrigatoria ? "com aviso na tela" : "em silêncio"}${sinal.ignorarRegra ? ", ignorando a regra de ligação" : ""}).`);
      setForcando(false);
      setMensagem("");
      setIgnorarRegra(false);
      void cliente.invalidateQueries({ queryKey: ["admin", "workspace-dispositivos"] });
    },
  });
  const remover = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/admin/workspace/dispositivos/${id}`); },
    onSuccess: () => { setConfirmarRemocao(null); void cliente.invalidateQueries({ queryKey: ["admin", "workspace-dispositivos"] }); },
  });

  const todos = dados.data?.dispositivos ?? [];
  const publicada = dados.data?.publicada ?? null;
  const resumo = useMemo(() => contar(todos), [todos]);
  const lista = useMemo(() => filtrar(todos, filtro, busca), [todos, filtro, busca]);
  const sinal = dados.data?.sinal ?? null;

  return (
    <section className="versoes" aria-labelledby="versoes-titulo">
      <header className="versoes-topo">
        <div>
          <h2 id="versoes-titulo"><MonitorSmartphone size={18} aria-hidden="true" /> Computadores e versões</h2>
          <p className="muted">Quem usa o Workspace, em qual versão e quando foi visto pela última vez.</p>
        </div>
        <div className="versoes-acoes">
          <button type="button" className="icon-button" aria-label="Atualizar a lista" onClick={() => void dados.refetch()}>
            <RefreshCw size={16} className={dados.isFetching ? "animate-spin" : ""} />
          </button>
          <button type="button" className="versoes-forcar" onClick={() => { setForcando((v) => !v); setFeito(""); }} disabled={!publicada} aria-expanded={forcando}>
            <Send size={15} aria-hidden="true" /> Forçar atualização
          </button>
        </div>
      </header>

      <div className="versoes-cartoes">
        <div><span>Versão publicada</span><strong>{publicada ?? "—"}</strong></div>
        <div className="ok"><span>Atualizados</span><strong>{resumo.atualizados}</strong></div>
        <div className={clsx(resumo.desatualizados && "alerta")}><span>Desatualizados</span><strong>{resumo.desatualizados}</strong></div>
        <div><span>Online agora</span><strong>{resumo.online}</strong></div>
      </div>

      {feito ? <p role="status" className="versoes-feito"><CheckCircle2 size={15} aria-hidden="true" /> {feito}</p> : null}

      {forcando ? (
        <div className="versoes-forcar-painel" role="group" aria-label="Forçar atualização">
          <button type="button" className="versoes-fechar" aria-label="Fechar" onClick={() => setForcando(false)}><X size={15} /></button>
          <strong>Mandar os computadores atualizarem para a {publicada}</strong>
          <label className="versoes-opcao">
            <input type="radio" name="modo-atualizacao" checked={!comAviso} onChange={() => setComAviso(false)} />
            <span><b>Em silêncio</b><small>O app baixa e reinicia sozinho quando o PC está parado ou o app está minimizado. Ninguém é interrompido.</small></span>
          </label>
          <label className="versoes-opcao">
            <input type="radio" name="modo-atualizacao" checked={comAviso} onChange={() => setComAviso(true)} />
            <span><b>Com aviso na tela</b><small>Aparece uma mensagem com o botão "Atualizar agora" para quem estiver com o app aberto.</small></span>
          </label>
          {comAviso ? (
            <input className="versoes-mensagem" value={mensagem} maxLength={200} onChange={(e) => setMensagem(e.target.value)} placeholder="Mensagem (opcional). Ex.: Nova versão com o Assistente de IA. Clique em Atualizar agora." aria-label="Mensagem do aviso" />
          ) : null}
          <label className={clsx("versoes-opcao", "versoes-ignorar", ignorarRegra && "ativo")}>
            <input type="checkbox" checked={ignorarRegra} onChange={(e) => setIgnorarRegra(e.target.checked)} />
            <span><b>Ignorar a regra de ligação</b><small>Atualiza mesmo com telefone aberto, ligação em andamento ou envio de arquivo. {comAviso ? "Quem clicar em \"Atualizar agora\" reinicia na hora." : "O app reinicia sozinho assim que baixar, sem esperar o PC ficar parado."} Uma ligação em curso será encerrada.</small></span>
          </label>
          {forcar.isError ? <p role="alert" className="form-error">{msgDe(forcar.error)}</p> : null}
          <div className="versoes-forcar-botoes">
            <button type="button" className="versoes-cancelar" onClick={() => setForcando(false)}>Cancelar</button>
            <button type="button" className="versoes-confirmar" onClick={() => forcar.mutate()} disabled={forcar.isPending}>
              {forcar.isPending ? "Enviando…" : "Enviar para todos"}
            </button>
          </div>
        </div>
      ) : null}

      {sinal ? (
        <p className="muted versoes-sinal">
          Último pedido de atualização: versão {sinal.versao}, {sinal.obrigatoria ? "com aviso na tela" : "em silêncio"}{sinal.ignorarRegra ? ", ignorando a regra de ligação" : ""}, {vistoEm(sinal.criadoEm)}.
        </p>
      ) : null}

      <div className="versoes-barra">
        <label className="versoes-busca">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por pessoa, computador ou IP" aria-label="Buscar computador" />
        </label>
        <div className="versoes-filtros" role="group" aria-label="Filtrar">
          {([["todos", `Todos (${resumo.total})`], ["desatualizados", `Desatualizados (${resumo.desatualizados})`], ["online", `Online (${resumo.online})`], ["offline", "Offline"]] as [Filtro, string][]).map(([id, rotulo]) => (
            <button key={id} type="button" aria-pressed={filtro === id} className={clsx(filtro === id && "on")} onClick={() => setFiltro(id)}>{rotulo}</button>
          ))}
        </div>
      </div>

      {dados.isError ? <p role="alert" className="form-error">{errorMessage(dados.error)}</p> : null}
      <div className="versoes-tabela-caixa">
        <table className="versoes-tabela">
          <thead>
            <tr><th>Computador</th><th>Usuário</th><th>Versão</th><th>Visto por último</th><th><span className="sr-only">Ações</span></th></tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={5} className="versoes-vazio">
                {dados.isPending ? "Carregando…" : todos.length ? "Nenhum computador com esses filtros." : "Nenhum computador registrado ainda. Eles aparecem aqui quando o app (a partir da próxima versão) for aberto."}
              </td></tr>
            ) : lista.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.computador}</strong><small>{d.ip || "IP não informado"}</small></td>
                <td><strong>{d.usuario.nome}</strong><small>{d.usuario.setor || d.usuario.email}</small></td>
                <td>
                  <span className={clsx("versoes-pilula", d.situacao)}>
                    {d.situacao === "desatualizado" ? <TriangleAlert size={12} aria-hidden="true" /> : null}
                    {d.versao ?? "?"}
                  </span>
                  <small>{rotuloSituacao[d.situacao]}</small>
                </td>
                <td>
                  {d.online ? <span className="versoes-online"><i aria-hidden="true" /> Online agora</span> : <span>{vistoEm(d.ultimo_visto)}</span>}
                  <small>desde {new Date(d.primeiro_visto).toLocaleDateString("pt-BR")}</small>
                </td>
                <td className="versoes-linha-acoes">
                  {confirmarRemocao === d.id ? (
                    <span className="versoes-confirma">Remover? <button type="button" onClick={() => remover.mutate(d.id)}>Sim</button> <button type="button" onClick={() => setConfirmarRemocao(null)}>Não</button></span>
                  ) : (
                    <button type="button" className="icon-button" aria-label={`Remover o registro de ${d.computador}`} title="Remover este registro (some da lista; reaparece se o app abrir de novo)" onClick={() => setConfirmarRemocao(d.id)}><Trash2 size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted versoes-nota">PCs com versão anterior à 0.5.17 não informam a versão. Computadores só aparecem aqui depois de abrirem uma versão que informe o identificador (a partir da próxima publicada).</p>
    </section>
  );
}
