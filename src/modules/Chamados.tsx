import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, Globe, Headset, LoaderCircle, Network, RefreshCw, Star, Sparkles, Bell } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { Button } from "../components/ui/button";
import { PageHeader, EmptyState, Skeleton } from "../components/ui/primitives";
import styles from "../styles/Chamados.module.css";
import "../styles/avaliacoes.css";

interface ChamadoSite {
  activityId: number;
  protocol: string | null;
  customerName: string | null;
  cpfMasked: string | null;
  title: string;
  openedAt: string;
  status: string;
  statusLabel: string;
}
interface ChamadoSiteDetalhe extends ChamadoSite {
  description: string | null;
  closureReason: string | null;
  closedAt: string | null;
  contractId: string;
}
interface ListaChamadosSite { items: ChamadoSite[]; page: number; limit: number; total: number; truncated: boolean }

// Categorias do SGP: não existe API do SGP que liste chamados de todas as
// categorias (só por contrato individual), então aqui abre o relatório real
// do próprio SGP no navegador — mesma origem que já usamos em outros lugares
// do Workspace (electron/sgpReports.ts).
const CATEGORIAS_SGP: { key: "sgp-suporte-tecnico" | "sgp-n1" | "sgp-n2" | "sgp-n3"; label: string }[] = [
  { key: "sgp-suporte-tecnico", label: "Suporte Técnico" },
  { key: "sgp-n1", label: "N1" },
  { key: "sgp-n2", label: "N2" },
  { key: "sgp-n3", label: "N3" },
];

const formatarData = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

function ChamadosDoSite() {
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const limite = 25;
  const lista = useQuery({
    queryKey: ["chamados", "site", pagina],
    queryFn: async () => (await api.get<ListaChamadosSite>("/chamados/site", { params: { period: "30d", page: pagina, limit: limite } })).data,
  });
  const detalhe = useQuery({
    queryKey: ["chamados", "site", "detalhe", selecionado],
    enabled: !!selecionado,
    queryFn: async () => (await api.get<ChamadoSiteDetalhe>(`/chamados/site/${selecionado}`)).data,
  });

  if (selecionado) {
    return (
      <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSelecionado(null)} style={{ width: "fit-content" }}>
          <ArrowLeft size={14} /> Voltar à lista
        </Button>
        {detalhe.isLoading ? (
          <Skeleton lines={5} />
        ) : detalhe.error ? (
          <p role="alert" className="form-error">{errorMessage(detalhe.error)}</p>
        ) : detalhe.data ? (
          <>
            <h2>{detalhe.data.title}</h2>
            <p className="muted">
              {detalhe.data.customerName || "Cliente"} {detalhe.data.cpfMasked ? `· ${detalhe.data.cpfMasked}` : ""} · Protocolo {detalhe.data.protocol || "—"}
            </p>
            <p><strong>Situação:</strong> {detalhe.data.statusLabel}</p>
            <p><strong>Aberto em:</strong> {formatarData(detalhe.data.openedAt)}</p>
            {detalhe.data.closedAt && <p><strong>Encerrado em:</strong> {formatarData(detalhe.data.closedAt)}</p>}
            {detalhe.data.description && <p style={{ whiteSpace: "pre-wrap" }}>{detalhe.data.description}</p>}
            {detalhe.data.closureReason && <p className="muted">Motivo do encerramento: {detalhe.data.closureReason}</p>}
          </>
        ) : null}
      </section>
    );
  }

  return (
    <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {lista.isLoading ? (
        <Skeleton lines={6} />
      ) : lista.error ? (
        <EmptyState icon={ClipboardList} title="Não foi possível carregar">{errorMessage(lista.error)}</EmptyState>
      ) : !lista.data?.items.length ? (
        <EmptyState icon={ClipboardList} title="Nenhum chamado pelo site nos últimos 30 dias" />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Protocolo</th><th>Cliente</th><th>Assunto</th><th>Situação</th><th>Aberto em</th></tr>
              </thead>
              <tbody>
                {lista.data.items.map((c) => (
                  <tr key={c.activityId} onClick={() => setSelecionado(c.protocol)} style={{ cursor: c.protocol ? "pointer" : "default" }}>
                    <td>{c.protocol || "—"}</td>
                    <td>{c.customerName || "—"}</td>
                    <td>{c.title}</td>
                    <td>{c.statusLabel}</td>
                    <td>{formatarData(c.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button type="button" size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
            <span className="muted">Página {pagina}</span>
            <Button type="button" size="sm" variant="outline" disabled={pagina * limite >= (lista.data?.total || 0)} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
          </div>
        </>
      )}
    </section>
  );
}

function ChamadosDoSgp() {
  const navigate = useNavigate();
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS_SGP)[number] | null>(null);
  // O SGP não tem API de lista por categoria (só por contrato individual): a
  // lista aqui vem de ler, por trás, a mesma página de relatório que o
  // Navegador > SGP já abre — usa a sessão de quem já logou lá.
  const resultado = useQuery({
    queryKey: ["chamados", "sgp", categoria?.key],
    enabled: !!categoria,
    queryFn: async () => window.desktop!.sgpListarChamados(categoria!.key),
  });

  const carregando = resultado.isLoading || resultado.isFetching;
  return (
    <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {CATEGORIAS_SGP.map((c) => (
          <Button key={c.key} type="button" variant={categoria?.key === c.key ? "default" : "outline"} onClick={() => setCategoria(c)}>
            <Headset size={14} /> {c.label}
          </Button>
        ))}
        {categoria && (
          <Button type="button" size="sm" variant="ghost" disabled={carregando} onClick={() => void resultado.refetch()}>
            {carregando ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Atualizar
          </Button>
        )}
      </div>
      {!categoria ? (
        <EmptyState icon={Headset} title="Escolha uma fila" />
      ) : carregando ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LoaderCircle size={16} className="animate-spin" />
          <span className="muted">Lendo os chamados no SGP...</span>
        </div>
      ) : resultado.error ? (
        <EmptyState icon={Headset} title="Não foi possível ler os chamados do SGP">{errorMessage(resultado.error)}</EmptyState>
      ) : resultado.data && !resultado.data.autenticado ? (
        <EmptyState icon={Headset} title="Faça login no SGP primeiro">
          <p>
            O login do Chrome/Edge do computador não vale aqui: é preciso entrar pelo
            Navegador do próprio Workspace (ele tem uma sessão só dele). Uma vez só por computador.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="button" onClick={() => navigate("/navegador")}>
              <Network size={14} /> Abrir Navegador &gt; SGP para entrar
            </Button>
            <Button type="button" variant="outline" onClick={() => void resultado.refetch()}>
              <RefreshCw size={14} /> Já entrei, tentar de novo
            </Button>
          </div>
        </EmptyState>
      ) : !resultado.data?.linhas.length ? (
        <EmptyState icon={Headset} title={`Nenhum chamado em ${categoria.label} agora`} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>{resultado.data.colunas.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {resultado.data.linhas.map((linha, i) => (
                <tr
                  key={i}
                  style={{ cursor: linha.link ? "pointer" : "default" }}
                  onClick={() => { if (linha.link) void window.desktop?.openSgpLink(linha.link); }}
                >
                  {linha.colunas.map((valor, j) => <td key={j}>{valor}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface RelatorioAvaliacoes {
  periodo: string;
  resumo: { total: number; media: number | null; comComentario: number; distribuicao: Record<string, number> };
  tecnicos: { tecnico: string; avaliacoes: number; media: number }[];
  itens: { protocolo: string; nota: number; comentario: string; respondidoEm: string; assunto: string; tecnico: string; cliente?: string; destaque?: boolean }[];
  podeDestacar?: boolean;
}
const PERIODOS = [["7d", "7 dias"], ["30d", "30 dias"], ["90d", "90 dias"]] as const;
const casas = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
const faixa = (n: number) => (n >= 4 ? "bom" : n === 3 ? "medio" : "ruim");
const MAX_ESTRELAS = "★★★★★";

/** Cinco estrelas preenchidas na fração exata (4,27 enche 85% da régua). */
function Estrelas({ valor, pequena }: { valor: number; pequena?: boolean }) {
  return (
    <span className={`aval-estrelas${pequena ? " aval-estrelas--p" : ""}`} role="img" aria-label={`${casas(valor)} de 5`}>
      {MAX_ESTRELAS}
      <span style={{ width: `${Math.max(0, Math.min(5, valor)) * 20}%` }} aria-hidden="true">{MAX_ESTRELAS}</span>
    </span>
  );
}

function Avaliacoes() {
  const [periodo, setPeriodo] = useState<"7d" | "30d" | "90d">("30d");
  const [filtroNota, setFiltroNota] = useState<number | null>(null);
  const [soComentario, setSoComentario] = useState(false);
  const [soDestaques, setSoDestaques] = useState(false);
  const cliente = useQueryClient();
  const destacar = useMutation({
    mutationFn: async (v: { protocolo: string; destacar: boolean }) => api.put("/chamados/avaliacoes/destaque", v),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ["chamados", "avaliacoes"] });
      void cliente.invalidateQueries({ queryKey: ["avaliacoes", "destaques"] });
    },
  });
  const [aviso, setAviso] = useState<{ protocolo: string; texto: string; erro?: boolean } | null>(null);
  const notificar = useMutation({
    mutationFn: async (protocolo: string) => (await api.post<{ ok: boolean; alcancados: number }>("/chamados/avaliacoes/notificar", { protocolo })).data,
    onSuccess: (r, protocolo) => setAviso({ protocolo, texto: r.alcancados ? `Enviada para ${r.alcancados} ${r.alcancados === 1 ? "pessoa online" : "pessoas online"}.` : "Enviada, mas ninguém está online agora." }),
    onError: (e, protocolo) => setAviso({ protocolo, texto: errorMessage(e), erro: true }),
  });
  const q = useQuery({
    queryKey: ["chamados", "avaliacoes", periodo],
    queryFn: async () => (await api.get<RelatorioAvaliacoes>("/chamados/avaliacoes", { params: { period: periodo } })).data,
    refetchInterval: 60_000,
  });
  const d = q.data;
  const itens = (d?.itens ?? []).filter((i) => (filtroNota ? i.nota === filtroNota : true) && (soComentario ? !!i.comentario : true) && (soDestaques ? !!i.destaque : true));
  const filtros = (
    <div className="aval-barra">
      {PERIODOS.map(([id, rotulo]) => (
        <button key={id} type="button" className="aval-chip" aria-pressed={periodo === id} onClick={() => setPeriodo(id)}>{rotulo}</button>
      ))}
      <Button type="button" size="sm" variant="ghost" className="aval-atualizar" disabled={q.isFetching} onClick={() => void q.refetch()}>
        {q.isFetching ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar
      </Button>
    </div>
  );
  if (q.isLoading) return <section style={{ display: "grid", gap: 16 }}>{filtros}<Skeleton lines={5} /></section>;
  if (q.error) return <section style={{ display: "grid", gap: 16 }}>{filtros}<EmptyState icon={Star} title="Não foi possível carregar as avaliações">{errorMessage(q.error)}</EmptyState></section>;
  if (!d || !d.resumo.total) {
    return <section style={{ display: "grid", gap: 16 }}>{filtros}<EmptyState icon={Star} title={`Nenhuma avaliação em ${PERIODOS.find(([id]) => id === periodo)?.[1]}`}>Os clientes avaliam depois que o chamado é encerrado. Tente um período maior.</EmptyState></section>;
  }
  const { resumo } = d;
  const inteira = (casas(resumo.media) || "").split(",");
  return (
    <section style={{ display: "grid", gap: 20 }}>
      {filtros}
      <div className="aval">
        <aside className="aval-resumo" aria-label="Resumo das avaliações">
          <div className="aval-nota">
            <div className="aval-nota-valor">{inteira[0]}{inteira[1] ? `,${inteira[1]}` : ""}<small>/ 5</small></div>
            <Estrelas valor={resumo.media ?? 0} />
            <p><b>{resumo.total}</b> {resumo.total === 1 ? "avaliação" : "avaliações"}, <b>{resumo.comComentario}</b> com comentário</p>
          </div>
          <div>
            <h3>Distribuição das notas</h3>
            <div className={`aval-dist${filtroNota ? " filtrando" : ""}`}>
              {[5, 4, 3, 2, 1].map((n) => {
                const total = resumo.distribuicao[n] ?? 0;
                return (
                  <button key={n} type="button" aria-pressed={filtroNota === n} aria-label={`${total} avaliações com nota ${n}. Filtrar`} onClick={() => setFiltroNota(filtroNota === n ? null : n)}>
                    <span>{n}★</span>
                    <span className="aval-trilho"><i className={faixa(n)} style={{ width: `${(total / resumo.total) * 100}%` }} /></span>
                    <b>{total}</b>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="aval-tecnicos">
            <h3>Por técnico</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
            {d.tecnicos.map((t) => (
              <li key={t.tecnico} className={`aval-tec${t.tecnico.startsWith("Sem técnico") ? " sem" : ""}`}>
                <strong>{t.tecnico}</strong>
                <span>★ {casas(t.media)}</span>
                <small>{t.avaliacoes} {t.avaliacoes === 1 ? "avaliação" : "avaliações"}</small>
              </li>
            ))}
            </ul>
          </div>
        </aside>

        <div className="aval-feed">
          <div className="aval-feed-topo">
            <h3>{filtroNota ? `Avaliações com nota ${filtroNota}` : "O que os clientes disseram"}</h3>
            <label>
              <input type="checkbox" checked={soComentario} onChange={(e) => setSoComentario(e.target.checked)} /> Só com comentário
            </label>
            <label>
              <input type="checkbox" checked={soDestaques} onChange={(e) => setSoDestaques(e.target.checked)} /> Só destaques
            </label>
          </div>
          {d.podeDestacar ? <p className="aval-dica"><Sparkles size={14} aria-hidden="true" /> Como administrador, em cada avaliação você pode <b>Destacar no Início</b> (aparece num cartão para todos) ou <b>Notificar equipe</b> (aviso na hora para quem está online).</p> : null}
          {destacar.isError ? <p role="alert" className="form-error">{errorMessage(destacar.error)}</p> : null}
          {itens.length === 0 ? (
            <p className="aval-vazio">Nenhuma avaliação com esse filtro. Limpe o filtro de nota ou de comentário para ver as outras.</p>
          ) : (
            <ul className="aval-lista">
              {itens.map((i) => (
                <li key={i.protocolo + i.respondidoEm} className={`aval-item ${faixa(i.nota)}`}>
                  <div className="aval-item-cab">
                    <Estrelas valor={i.nota} pequena />
                    {i.destaque ? <span className="aval-selo"><Sparkles size={12} aria-hidden="true" /> Em destaque no Início</span> : null}
                    <span className="data">{formatarData(i.respondidoEm)}</span>
                  </div>
                  {i.comentario ? <p className="aval-comentario">“{i.comentario}”</p> : <p className="aval-sem-comentario">Sem comentário</p>}
                  <div className="aval-meta">
                    <span>{i.assunto || "Chamado"}</span>
                    <span>Cliente: <b>{i.cliente || "não identificado"}</b></span>
                    <span>Técnico: <b>{i.tecnico || "não informado"}</b></span>
                    <span>Protocolo {i.protocolo || "—"}</span>
                  </div>
                  {d.podeDestacar ? (
                    <div className="aval-acoes" role="group" aria-label="Ações do administrador">
                      <button type="button" className="aval-destacar" aria-pressed={!!i.destaque} disabled={destacar.isPending}
                        title="Mostra esta avaliação num cartão no Início de todo mundo"
                        onClick={() => destacar.mutate({ protocolo: i.protocolo, destacar: !i.destaque })}>
                        <Sparkles size={14} aria-hidden="true" /> {i.destaque ? "Tirar do destaque" : "Destacar no Início"}
                      </button>
                      <button type="button" className="aval-destacar" disabled={notificar.isPending && notificar.variables === i.protocolo}
                        title="Manda esta avaliação como notificação para quem está online agora"
                        onClick={() => { setAviso(null); notificar.mutate(i.protocolo); }}>
                        <Bell size={14} aria-hidden="true" /> {notificar.isPending && notificar.variables === i.protocolo ? "Enviando…" : "Notificar equipe"}
                      </button>
                      {aviso?.protocolo === i.protocolo ? <span role={aviso.erro ? "alert" : "status"} className={aviso.erro ? "aval-acao-erro" : "aval-acao-ok"}>{aviso.texto}</span> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Chamados() {
  const [params] = useSearchParams();
  const [aba, setAba] = useState<"site" | "sgp" | "avaliacoes">(params.get("aba") === "avaliacoes" ? "avaliacoes" : "site");
  // Aviso de avaliação nova abre direto nesta aba, mesmo com a tela de Chamados já aberta.
  useEffect(() => { if (params.get("aba") === "avaliacoes") setAba("avaliacoes"); }, [params]);
  return (
    <div className="page chamados-page">
      <PageHeader icon={ClipboardList} title="Chamados" description="Chamados abertos pelo site, filas de suporte do SGP e avaliações do atendimento." />
      <div className="segmented segmented--fill" style={{ maxWidth: 520 }}>
        <button type="button" aria-pressed={aba === "site"} onClick={() => setAba("site")}>
          <Globe size={14} /> Pelo site
        </button>
        <button type="button" aria-pressed={aba === "sgp"} onClick={() => setAba("sgp")}>
          <Headset size={14} /> SGP
        </button>
        <button type="button" aria-pressed={aba === "avaliacoes"} onClick={() => setAba("avaliacoes")}>
          <Star size={14} /> Avaliações
        </button>
      </div>
      {aba === "site" ? <ChamadosDoSite /> : aba === "sgp" ? <ChamadosDoSgp /> : <Avaliacoes />}
    </div>
  );
}
