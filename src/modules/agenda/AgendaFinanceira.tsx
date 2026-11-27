import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  GripVertical,
  History,
  RefreshCw,
  Search,
  Undo2,
  X,
} from "lucide-react";
import "../../styles/agendaFinanceira.css";
import { errorMessage } from "../../services/api";
import { addDays, today } from "../../services/agenda";
import {
  FILTROS_VAZIOS,
  ROTULO_PRIORIDADE,
  formatarEspera,
  moverOcorrencias,
  passaNosFiltros,
  useAgendaFinanceira,
  useBuscaFinanceira,
  useHistoricoFinanceiro,
  type Colaboradora,
  type Filtros,
  type Indicadores,
  type MovimentoHistorico,
  type Ocorrencia,
} from "../../services/agendaFinanceira";
import { Button } from "../../components/ui/button";
import { Badge, EmptyState, Skeleton, type Tone } from "../../components/ui/primitives";

const COLUNA_FILA = "fila";
const MIME = "application/acessa-ocorrencia";

const fmtDataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const dataLonga = (data: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${data}T12:00:00Z`));

const toneStatus = (o: Ocorrencia): Tone => (o.statusId === 1 ? "ok" : o.statusId === 2 ? "live" : o.statusId === 3 ? "neutral" : o.responsavelUsuario ? "info" : "warn");
const tonePrioridade = (p: Ocorrencia["prioridade"]): Tone => (p === "urgente" ? "crit" : p === "atencao" ? "warn" : "neutral");

function abrirNoSgp(url: string) {
  if (window.desktop) void window.desktop.openSgpLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

type Pendente = { destino: string | null; indice: number | null };

export default function AgendaFinanceira({ active }: { active: boolean }) {
  const [data, setData] = useState(today);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [pendentes, setPendentes] = useState<Record<string, Pendente>>({});
  const [aviso, setAviso] = useState<{ tom: "erro" | "ok"; texto: string } | null>(null);
  const [detalhe, setDetalhe] = useState<Ocorrencia | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [alvoDrop, setAlvoDrop] = useState<{ coluna: string; indice: number } | null>(null);
  const { agenda, carregando, atualizando, erro, recarregar } = useAgendaFinanceira(data, active);
  const busca = useBuscaFinanceira(filtros.busca, active && !!agenda);

  const podeDistribuir = !!agenda?.podeDistribuir;
  const idsDocumento = busca.data ?? null;
  const filtrosEfetivos = useMemo<Filtros>(() => ({ ...filtros, idsDocumento }), [filtros, idsDocumento]);

  // Quadro visível: o do servidor, com as distribuições em andamento já aplicadas (volta ao lugar se o servidor recusar).
  const quadro = useMemo(() => {
    if (!agenda) return null;
    const todas = [...agenda.fila, ...Object.values(agenda.colunas).flat()];
    const porId = new Map(todas.map((o) => [o.id, o]));
    const colunas: Record<string, Ocorrencia[]> = { [COLUNA_FILA]: [] };
    for (const c of agenda.colaboradoras) colunas[c.id] = [];
    const nativa = (o: Ocorrencia) => o.responsavel ?? COLUNA_FILA;
    for (const o of todas) if (!pendentes[o.id]) colunas[nativa(o)]?.push(o);
    // ordem do servidor dentro de cada coluna
    const ordemServidor = new Map<string, number>();
    [agenda.fila, ...Object.values(agenda.colunas)].forEach((lista) => lista.forEach((o, i) => ordemServidor.set(o.id, i)));
    for (const k of Object.keys(colunas)) colunas[k].sort((a, b) => (ordemServidor.get(a.id) ?? 0) - (ordemServidor.get(b.id) ?? 0));
    for (const [id, p] of Object.entries(pendentes)) {
      const o = porId.get(id);
      const alvo = p.destino ?? COLUNA_FILA;
      if (!o || !colunas[alvo]) continue;
      const lista = colunas[alvo];
      lista.splice(p.indice === null ? lista.length : Math.min(p.indice, lista.length), 0, o);
    }
    return colunas;
  }, [agenda, pendentes]);

  const tipos = useMemo(() => {
    if (!agenda) return [];
    return [...new Set([...agenda.fila, ...Object.values(agenda.colunas).flat(), ...agenda.finalizadas].map((o) => o.tipo))].sort();
  }, [agenda]);
  const statusDisponiveis = ["Aguardando distribuição", "Pendente", "Em atendimento", "Aguardando retorno", "Finalizada"];

  const visiveis = (lista: Ocorrencia[], coluna: string | null) => lista.filter((o) => passaNosFiltros(o, filtrosEfetivos, coluna));
  const nomeColaboradora = (id: string | null) => (id ? agenda?.colaboradoras.find((c) => c.id === id)?.nome ?? id : "a fila");

  function alternarSelecao(id: string, soUm = false) {
    setSelecionados((atual) => {
      const novo = new Set(soUm ? [] : atual);
      if (atual.has(id) && !soUm) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function distribuir(ids: string[], destino: string | null, indice: number | null) {
    if (!agenda || !podeDistribuir || !ids.length) return;
    const porId = new Map([...agenda.fila, ...Object.values(agenda.colunas).flat()].map((o) => [o.id, o]));
    const validos = ids.filter((id) => porId.has(id));
    if (!validos.length) return;
    const versoes = Object.fromEntries(validos.map((id) => [id, porId.get(id)!.versao]));
    setAviso(null);
    setPendentes((p) => ({ ...p, ...Object.fromEntries(validos.map((id, i) => [id, { destino, indice: indice === null ? null : indice + i }])) }));
    try {
      const resposta = await moverOcorrencias(validos, destino, indice, versoes);
      const falhas = resposta.resultados.filter((r) => !r.ok);
      if (falhas.length) {
        const primeiro = falhas[0];
        setAviso({ tom: "erro", texto: `${falhas.length === 1 ? "Não foi possível mover a ocorrência" : `Não foi possível mover ${falhas.length} ocorrências`}: ${primeiro.erro ?? "erro desconhecido"}` });
      } else {
        setAviso({ tom: "ok", texto: `${validos.length === 1 ? "Ocorrência movida" : `${validos.length} ocorrências movidas`} para ${destino ? nomeColaboradora(destino) : "a fila"}.` });
        setSelecionados((s) => new Set([...s].filter((id) => !validos.includes(id))));
      }
    } catch (e) {
      setAviso({ tom: "erro", texto: `Nada foi alterado: ${errorMessage(e)}` });
    } finally {
      // o servidor é a verdade: confirma, e quem falhou volta ao lugar original sozinho
      await recarregar();
      setPendentes((p) => {
        const resto = { ...p };
        for (const id of validos) delete resto[id];
        return resto;
      });
    }
  }

  function iniciarArraste(e: React.DragEvent, o: Ocorrencia) {
    const ids = selecionados.has(o.id) ? [...selecionados] : [o.id];
    e.dataTransfer.setData(MIME, JSON.stringify(ids));
    e.dataTransfer.effectAllowed = "move";
  }
  function indiceDoDrop(e: React.DragEvent, container: HTMLElement) {
    const cards = [...container.querySelectorAll<HTMLElement>("[data-card-id]")];
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) return i;
    }
    return cards.length;
  }
  function aoSoltar(e: React.DragEvent, coluna: string) {
    e.preventDefault();
    const bruto = e.dataTransfer.getData(MIME);
    const indice = alvoDrop?.coluna === coluna ? alvoDrop.indice : null;
    setAlvoDrop(null);
    if (!bruto) return;
    try {
      const ids = JSON.parse(bruto) as string[];
      void distribuir(ids, coluna === COLUNA_FILA ? null : coluna, indice);
    } catch {
      /* arraste de outra origem */
    }
  }

  const dia = data;
  const ehHoje = agenda ? data === agenda.hoje : data === today();

  return (
    <section className="fin" aria-label="Agenda Financeira">
      <div className="toolbar agenda-toolbar">
        <div className="date-stepper" title="Escolhe o dia das ocorrências finalizadas; a fila de abertas é sempre a de agora">
          <Button variant="outline" size="icon" aria-label="Dia anterior" onClick={() => setData(addDays(dia, -1))}>
            <ChevronLeft size={17} />
          </Button>
          <Button variant={ehHoje ? "soft" : "ghost"} size="sm" onClick={() => setData(today())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" aria-label="Próximo dia" onClick={() => setData(addDays(dia, 1))}>
            <ChevronRight size={17} />
          </Button>
          <span className="fin-dia">
            <CalendarDays size={14} /> Finalizadas em {dataLonga(dia)}
          </span>
        </div>
        <label className="search-box">
          <Search size={16} />
          <input aria-label="Pesquisar ocorrências" placeholder="Cliente, CPF, contrato ou nº da ocorrência" value={filtros.busca} onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })} />
          {filtros.busca ? (
            <button type="button" className="search-clear" aria-label="Limpar pesquisa" onClick={() => setFiltros({ ...filtros, busca: "" })}>
              <X size={14} />
            </button>
          ) : null}
        </label>
        <select aria-label="Filtrar por colaboradora" value={filtros.colaboradora} onChange={(e) => setFiltros({ ...filtros, colaboradora: e.target.value })}>
          <option value="">Todas as colaboradoras</option>
          <option value={COLUNA_FILA}>Fila (sem coluna)</option>
          {agenda?.colaboradoras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por status" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}>
          <option value="">Todos os status</option>
          {statusDisponiveis.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por prioridade" value={filtros.prioridade} onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}>
          <option value="">Qualquer prioridade</option>
          <option value="urgente">Urgente</option>
          <option value="atencao">Atenção</option>
          <option value="normal">Normal</option>
        </select>
        <select aria-label="Filtrar por tipo de ocorrência" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t.replace(/^ATIVA[ÇC][AÃ]O DE /i, "").toLowerCase().replace(/^./, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
        <label className="fin-check">
          <input type="checkbox" checked={filtros.semResponsavel} onChange={(e) => setFiltros({ ...filtros, semResponsavel: e.target.checked })} /> Sem responsável
        </label>
        <Button variant="outline" size="sm" onClick={() => setHistoricoAberto(true)} title="Quem moveu o quê, e o resultado no SGP">
          <History size={15} /> Histórico
        </Button>
        <Button variant="outline" size="sm" onClick={() => void recarregar()} disabled={atualizando} title="Atualizar agora com o SGP">
          <RefreshCw size={15} className={atualizando ? "fin-gira" : undefined} /> Atualizar
        </Button>
      </div>

      {erro && !agenda ? (
        <div className="fin-aviso is-erro" role="alert">
          <AlertTriangle size={16} /> {erro}
        </div>
      ) : null}
      {agenda && !agenda.sgp.gravaResponsavel ? (
        <div className="fin-aviso is-info" role="note">
          <AlertTriangle size={16} />
          <span>
            A distribuição é registrada <b>na agenda</b> (com histórico e tempo real). O SGP ainda não recebe a troca de responsável, então os cards movidos aqui mostram <b>“não gravado no SGP”</b>. Se alguém mudar o responsável no próprio SGP, o SGP passa a valer.
          </span>
        </div>
      ) : null}
      {agenda?.erroFinalizadas ? (
        <div className="fin-aviso is-info" role="note">
          <AlertTriangle size={16} /> {agenda.erroFinalizadas}
        </div>
      ) : null}
      {aviso ? (
        <div className={`fin-aviso ${aviso.tom === "ok" ? "is-ok" : "is-erro"}`} role={aviso.tom === "ok" ? "status" : "alert"}>
          {aviso.tom === "ok" ? <Check size={16} /> : <AlertTriangle size={16} />} {aviso.texto}
          <button type="button" className="fin-fechar" aria-label="Fechar aviso" onClick={() => setAviso(null)}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      {carregando && !agenda ? (
        <div className="fin-esqueleto">
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      ) : null}

      {agenda && quadro ? (
        <>
          <Indicadores ind={agenda.indicadores} atualizadoEm={agenda.atualizadoEm} />

          {podeDistribuir && selecionados.size > 0 ? (
            <div className="fin-lote" role="region" aria-label="Distribuição em lote">
              <b>{selecionados.size}</b> selecionada{selecionados.size > 1 ? "s" : ""}
              <span className="fin-lote-sep">mover para</span>
              {agenda.colaboradoras.map((c) => (
                <Button key={c.id} variant="soft" size="sm" onClick={() => void distribuir([...selecionados], c.id, null)}>
                  <ArrowRightLeft size={14} /> {c.nome}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => void distribuir([...selecionados], null, null)} title="Devolve à fila de pendentes de distribuição">
                <Undo2 size={14} /> Fila
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>
                Limpar seleção
              </Button>
            </div>
          ) : null}

          <div className="fin-quadro">
            <Coluna
              id={COLUNA_FILA}
              titulo="Fila de distribuição"
              subtitulo="sem coluna"
              total={quadro[COLUNA_FILA].length}
              lista={visiveis(quadro[COLUNA_FILA], COLUNA_FILA)}
              podeDistribuir={podeDistribuir}
              selecionados={selecionados}
              alvoDrop={alvoDrop}
              pendentes={pendentes}
              onSelecionar={alternarSelecao}
              onAbrir={setDetalhe}
              onIniciarArraste={iniciarArraste}
              onDragOver={(e, col, el) => { if (podeDistribuir) { e.preventDefault(); setAlvoDrop({ coluna: col, indice: indiceDoDrop(e, el) }); } }}
              onDragLeave={() => setAlvoDrop(null)}
              onDrop={aoSoltar}
              fila
            />
            {agenda.colaboradoras.map((c) => (
              <Coluna
                key={c.id}
                id={c.id}
                titulo={c.nome}
                subtitulo={c.usuarioSgp}
                total={quadro[c.id].length}
                stats={agenda.indicadores.porColaboradora[c.id]}
                lista={visiveis(quadro[c.id], c.id)}
                podeDistribuir={podeDistribuir}
                selecionados={selecionados}
                alvoDrop={alvoDrop}
                pendentes={pendentes}
                onSelecionar={alternarSelecao}
                onAbrir={setDetalhe}
                onIniciarArraste={iniciarArraste}
                onDragOver={(e, col, el) => { if (podeDistribuir) { e.preventDefault(); setAlvoDrop({ coluna: col, indice: indiceDoDrop(e, el) }); } }}
                onDragLeave={() => setAlvoDrop(null)}
                onDrop={aoSoltar}
              />
            ))}
          </div>

          <details className="fin-finalizadas" open={agenda.finalizadas.length > 0 && agenda.finalizadas.length <= 40}>
            <summary>
              Finalizadas em {fmtDia.format(new Date(`${dia}T12:00:00Z`))} <Badge tone="ok">{visiveis(agenda.finalizadas, null).length}</Badge>
            </summary>
            {visiveis(agenda.finalizadas, null).length ? (
              <div className="fin-lista-fin">
                {visiveis(agenda.finalizadas, null).map((o) => (
                  <Cartao key={o.id} o={o} compacto podeDistribuir={false} selecionado={false} pendente={false} onSelecionar={() => undefined} onAbrir={setDetalhe} onIniciarArraste={() => undefined} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Check} title="Nenhuma ocorrência finalizada neste dia" />
            )}
          </details>
        </>
      ) : null}

      {detalhe ? <Detalhe o={detalhe} colaboradoras={agenda?.colaboradoras ?? []} onFechar={() => setDetalhe(null)} /> : null}
      {historicoAberto ? <Historico colaboradoras={agenda?.colaboradoras ?? []} onFechar={() => setHistoricoAberto(false)} /> : null}
    </section>
  );
}

function Indicadores({ ind, atualizadoEm }: { ind: Indicadores; atualizadoEm: string }) {
  const itens: Array<[string, string, string?, Tone?]> = [
    ["Na fila", String(ind.total), "Ocorrências de ativação abertas, pendentes ou em atendimento no SGP"],
    ["Sem responsável", String(ind.semResponsavel), "Sem ninguém no SGP e sem distribuição na agenda", ind.semResponsavel ? "warn" : undefined],
    ["Distribuídas", String(ind.distribuidas), "Com uma das colaboradoras do financeiro"],
    ["Em atendimento", String(ind.emAtendimento), "Status “Em execução” no SGP"],
    ["Finalizadas no dia", String(ind.finalizadasNoDia), "Finalizadas na data escolhida", "ok"],
    ["Espera média", formatarEspera(ind.esperaMediaMin), `Média do tempo desde a abertura das ocorrências ainda abertas (sem atendimento). Mediana: ${formatarEspera(ind.esperaMedianaMin)}.`, ind.urgentes ? "warn" : undefined],
    [
      "Atendimento médio",
      ind.atendimento.minutos === null ? "—" : formatarEspera(ind.atendimento.minutos),
      ind.atendimento.minutos === null
        ? "O SGP só informa o dia da finalização. Este tempo é medido pela própria agenda quando ela vê a ocorrência entrar em atendimento e terminar; ainda não há medições."
        : `Medido pela agenda (início em atendimento até a finalização) em ${ind.atendimento.amostra} ocorrência(s).`,
    ],
  ];
  return (
    <div className="fin-kpis" role="list" aria-label="Indicadores da fila">
      {itens.map(([rotulo, valor, dica, tom]) => (
        <div key={rotulo} className={`fin-kpi${tom ? ` is-${tom}` : ""}`} role="listitem" title={dica}>
          <span className="fin-kpi-valor">{valor}</span>
          <span className="fin-kpi-rotulo">{rotulo}</span>
        </div>
      ))}
      <span className="fin-kpi-hora" title="Última leitura do SGP">
        <Clock size={12} /> {fmtHora.format(new Date(atualizadoEm))}
      </span>
    </div>
  );
}

interface ColunaProps {
  id: string;
  titulo: string;
  subtitulo: string;
  total: number;
  stats?: Indicadores["porColaboradora"][string];
  lista: Ocorrencia[];
  podeDistribuir: boolean;
  selecionados: Set<string>;
  alvoDrop: { coluna: string; indice: number } | null;
  pendentes: Record<string, Pendente>;
  onSelecionar: (id: string, soUm?: boolean) => void;
  onAbrir: (o: Ocorrencia) => void;
  onIniciarArraste: (e: React.DragEvent, o: Ocorrencia) => void;
  onDragOver: (e: React.DragEvent, coluna: string, el: HTMLElement) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, coluna: string) => void;
  fila?: boolean;
}

function Coluna(p: ColunaProps) {
  const marcador = p.alvoDrop?.coluna === p.id ? p.alvoDrop.indice : null;
  return (
    <section className={`fin-coluna${p.fila ? " is-fila" : ""}${marcador !== null ? " is-alvo" : ""}`} aria-label={`Coluna ${p.titulo}`}>
      <header className="fin-coluna-cab">
        <span className="fin-avatar" aria-hidden="true">{p.fila ? "↧" : p.titulo.charAt(0)}</span>
        <div className="fin-coluna-nome">
          <b>{p.titulo}</b>
          <small className="mono">{p.subtitulo}</small>
        </div>
        <Badge tone={p.fila && p.total ? "warn" : "neutral"}>{p.total}</Badge>
      </header>
      {p.stats ? (
        <div className="fin-coluna-stats" aria-label={`Produtividade de ${p.titulo}`}>
          <span title="Em atendimento"><i className="fin-pt is-live" /> {p.stats.emAtendimento} em atend.</span>
          <span title="Pendentes ou aguardando retorno"><i className="fin-pt is-info" /> {p.stats.pendentes} pend.</span>
          <span title="Finalizadas na data escolhida (por quem finalizou no SGP)"><i className="fin-pt is-ok" /> {p.stats.finalizadasNoDia} fin.</span>
          <span title="Espera média das abertas desta coluna"><Clock size={11} /> {formatarEspera(p.stats.esperaMediaMin)}</span>
          {p.stats.atendimento.minutos !== null ? <span title="Tempo médio de atendimento medido pela agenda">⌀ {formatarEspera(p.stats.atendimento.minutos)}</span> : null}
          {p.stats.urgentes ? <span className="is-urg" title="Ocorrências urgentes">⚠ {p.stats.urgentes}</span> : null}
        </div>
      ) : null}
      <div
        className="fin-coluna-corpo"
        onDragOver={(e) => p.onDragOver(e, p.id, e.currentTarget)}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) p.onDragLeave(); }}
        onDrop={(e) => p.onDrop(e, p.id)}
      >
        {p.lista.length === 0 ? <div className="fin-vazio">{p.fila ? "Nenhuma ocorrência esperando distribuição." : "Nada com esta colaboradora."}</div> : null}
        {p.lista.map((o, i) => (
          <div key={o.id} data-card-id={o.id}>
            {marcador === i ? <div className="fin-marca" aria-hidden="true" /> : null}
            <Cartao o={o} podeDistribuir={p.podeDistribuir} selecionado={p.selecionados.has(o.id)} pendente={!!p.pendentes[o.id]} onSelecionar={p.onSelecionar} onAbrir={p.onAbrir} onIniciarArraste={p.onIniciarArraste} />
          </div>
        ))}
        {marcador !== null && marcador >= p.lista.length ? <div className="fin-marca" aria-hidden="true" /> : null}
      </div>
    </section>
  );
}

function Cartao({ o, compacto = false, podeDistribuir, selecionado, pendente, onSelecionar, onAbrir, onIniciarArraste }: {
  o: Ocorrencia;
  compacto?: boolean;
  podeDistribuir: boolean;
  selecionado: boolean;
  pendente: boolean;
  onSelecionar: (id: string, soUm?: boolean) => void;
  onAbrir: (o: Ocorrencia) => void;
  onIniciarArraste: (e: React.DragEvent, o: Ocorrencia) => void;
}) {
  const aberta = o.statusId !== 1;
  return (
    <article
      className={`fin-card is-${o.prioridade}${selecionado ? " is-sel" : ""}${pendente ? " is-pendente" : ""}${compacto ? " is-compacto" : ""}`}
      draggable={podeDistribuir && aberta && !pendente}
      onDragStart={(e) => onIniciarArraste(e, o)}
      onClick={(e) => {
        if (podeDistribuir && aberta && (e.ctrlKey || e.metaKey || e.shiftKey)) onSelecionar(o.id);
        else onAbrir(o);
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onAbrir(o);
        if (e.key === " " && podeDistribuir && aberta) { e.preventDefault(); onSelecionar(o.id); }
      }}
      aria-label={`Ocorrência ${o.numero}, ${o.cliente}, ${o.statusRotulo}`}
    >
      <div className="fin-card-topo">
        {podeDistribuir && aberta ? (
          <label className="fin-sel" onClick={(e) => e.stopPropagation()} title="Selecionar para distribuir em lote (ou Ctrl+clique)">
            <input type="checkbox" checked={selecionado} onChange={() => onSelecionar(o.id)} aria-label={`Selecionar ocorrência ${o.numero}`} />
          </label>
        ) : null}
        <span className="mono fin-num">{o.numero || o.id}</span>
        {o.prioridade !== "normal" ? <Badge tone={tonePrioridade(o.prioridade)}>{ROTULO_PRIORIDADE[o.prioridade]}</Badge> : null}
        <Badge tone={toneStatus(o)}>{o.statusRotulo}</Badge>
        {podeDistribuir && aberta ? <GripVertical size={14} className="fin-grip" aria-hidden="true" /> : null}
      </div>
      <b className="fin-cliente">{o.cliente || "Cliente não informado"}</b>
      <div className="fin-meta">
        <span>Contrato {o.contrato ?? "—"}</span>
        <span>{o.tipo.replace(/^ATIVA[ÇC][AÃ]O DE /i, "").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</span>
      </div>
      <div className="fin-meta">
        {o.abertoEm ? <span title={o.aberturaComHora ? "Abertura" : "Abertura (o SGP só informa o dia)"}>{o.aberturaComHora ? fmtDataHora.format(new Date(o.abertoEm)) : fmtDia.format(new Date(o.abertoEm))}</span> : null}
        {aberta ? (
          <span className={`fin-espera is-${o.prioridade}`} title="Tempo desde a abertura">
            <Clock size={11} /> {formatarEspera(o.aguardandoMin)}
          </span>
        ) : null}
        {o.responsavelSgp ? <span title="Responsável no SGP" className="mono">SGP: {o.responsavelSgp}</span> : null}
      </div>
      {o.naoGravadoNoSgp ? <span className="fin-local" title="Distribuída só na agenda: o SGP ainda mostra outro responsável">não gravado no SGP</span> : null}
      {o.outroResponsavel ? <span className="fin-local is-outro" title="O SGP tem outro responsável (fora do financeiro)">responsável no SGP: {o.outroResponsavel}</span> : null}
      {!compacto && o.descricao ? <p className="fin-desc">{o.descricao}</p> : null}
    </article>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor?: string | number | null }) {
  return (
    <div className="fin-campo">
      <span>{rotulo}</span>
      <b>{valor === null || valor === undefined || valor === "" ? "—" : valor}</b>
    </div>
  );
}

function Detalhe({ o, colaboradoras, onFechar }: { o: Ocorrencia; colaboradoras: Colaboradora[]; onFechar: () => void }) {
  const historico = useHistoricoFinanceiro(true, o.id);
  const nome = (usuario: string | null) => (usuario ? colaboradoras.find((c) => c.usuarioSgp === usuario)?.nome ?? usuario : "—");
  return (
    <div className="modal-backdrop is-drawer" onClick={onFechar}>
      <section className="detail-panel fin-detalhe" role="dialog" aria-modal="true" aria-label="Detalhes da ocorrência" data-tone={tonePrioridade(o.prioridade) === "crit" ? "crit" : tonePrioridade(o.prioridade) === "warn" ? "warn" : toneStatus(o) === "ok" ? "ok" : "info"} onClick={(e) => e.stopPropagation()}>
        <div className="detail-head">
          <span className="detail-kicker mono">Ocorrência {o.numero || o.id}</span>
          <Button variant="ghost" size="icon" aria-label="Fechar detalhes" onClick={onFechar}>
            <X size={17} />
          </Button>
        </div>
        <h3 className="fin-detalhe-titulo">{o.cliente || "Cliente não informado"}</h3>
        <div className="fin-detalhe-badges">
          <Badge tone={toneStatus(o)}>{o.statusRotulo}</Badge>
          {o.statusId !== 1 ? <Badge tone={tonePrioridade(o.prioridade)}>Prioridade: {ROTULO_PRIORIDADE[o.prioridade]}</Badge> : null}
          {o.naoGravadoNoSgp ? <span className="fin-local">não gravado no SGP</span> : null}
        </div>
        <div className="fin-detalhe-grid">
          <Campo rotulo="Contrato" valor={o.contrato} />
          <Campo rotulo="Situação do contrato" valor={o.contratoStatus} />
          <Campo rotulo="Tipo" valor={o.tipo} />
          <Campo rotulo="Método de abertura" valor={o.metodo} />
          <Campo rotulo="POP" valor={o.pop} />
          <Campo rotulo="Status no SGP" valor={o.status} />
          <Campo rotulo="Aberta em" valor={o.abertoEm ? (o.aberturaComHora ? fmtDataHora.format(new Date(o.abertoEm)) : `${fmtDia.format(new Date(o.abertoEm))} (só o dia)`) : null} />
          <Campo rotulo="Aguardando" valor={o.statusId === 1 ? null : formatarEspera(o.aguardandoMin)} />
          <Campo rotulo="Agendamento" valor={o.dataAgendamento ? fmtDia.format(new Date(`${o.dataAgendamento}T12:00:00Z`)) : null} />
          <Campo rotulo="Finalizada em" valor={o.dataFinalizacao ? fmtDia.format(new Date(`${o.dataFinalizacao}T12:00:00Z`)) : null} />
          <Campo rotulo="Aberta por" valor={o.usuarioAbertura} />
          <Campo rotulo="Finalizada por" valor={o.usuarioFinalizacao} />
          <Campo rotulo="Responsável no SGP" valor={o.responsavelSgp} />
          <Campo rotulo="Responsável na agenda" valor={o.responsavel ? nome(o.responsavelUsuario) : o.outroResponsavel ? `${o.outroResponsavel} (fora do financeiro)` : "Fila (sem responsável)"} />
          <Campo rotulo="Ordens de serviço" valor={o.ordensServico} />
        </div>
        <h4 className="fin-detalhe-sub">Descrição</h4>
        <p className="fin-detalhe-texto">{o.descricao || "Sem descrição."}</p>
        <h4 className="fin-detalhe-sub">Observações ({o.observacoes.length})</h4>
        {o.observacoes.length ? (
          <ul className="fin-obs">
            {o.observacoes.map((c, i) => (
              <li key={i}>
                <span className="mono">{c.usuario}{c.data ? ` · ${fmtDia.format(new Date(`${c.data}T12:00:00Z`))}` : ""}</span>
                <p>{c.texto}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Sem observações.</p>
        )}
        <h4 className="fin-detalhe-sub">Movimentações desta ocorrência</h4>
        {historico.data?.length ? <ListaMovimentos itens={historico.data} colaboradoras={colaboradoras} /> : <p className="muted">{historico.isLoading ? "Carregando…" : "Nenhuma movimentação pela agenda."}</p>}
        <div className="fin-detalhe-acoes">
          <Button variant="outline" size="sm" onClick={() => abrirNoSgp(o.linkSgp)} title="Abre o relatório de ocorrências do SGP já filtrado por este tipo e status">
            <ExternalLink size={15} /> Abrir no SGP
          </Button>
        </div>
      </section>
    </div>
  );
}

function ListaMovimentos({ itens, colaboradoras }: { itens: MovimentoHistorico[]; colaboradoras: Colaboradora[] }) {
  const nome = (usuario: string | null) => (usuario ? colaboradoras.find((c) => c.usuarioSgp === usuario)?.nome ?? usuario : "fila");
  const origem = { agenda: "Distribuiu", devolvida: "Devolveu à fila", "sgp-externo": "SGP alterou" } as const;
  const sgp = { ok: "gravado no SGP", nao_suportado: "só na agenda", erro: "erro no SGP" } as const;
  return (
    <ul className="fin-hist">
      {itens.map((h) => (
        <li key={h.id} className={h.resultadoSgp === "erro" ? "is-erro" : undefined}>
          <span className="mono fin-hist-hora">{fmtDataHora.format(new Date(h.em))}</span>
          <span>
            <b>{h.por?.nome || "SGP"}</b> {origem[h.origem]} <span className="mono">#{h.numero || h.ocorrenciaId}</span>: {nome(h.de)} <ArrowRightLeft size={11} /> {nome(h.para)}
            <small className={`fin-hist-sgp is-${h.resultadoSgp}`}>{sgp[h.resultadoSgp]}</small>
            {h.detalhe && h.resultadoSgp === "erro" ? <small className="fin-hist-det">{h.detalhe}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Historico({ colaboradoras, onFechar }: { colaboradoras: Colaboradora[]; onFechar: () => void }) {
  const q = useHistoricoFinanceiro(true);
  return (
    <div className="modal-backdrop is-drawer" onClick={onFechar}>
      <section className="detail-panel fin-detalhe" role="dialog" aria-modal="true" aria-label="Histórico de movimentações" onClick={(e) => e.stopPropagation()}>
        <div className="detail-head">
          <span className="detail-kicker">Histórico da Agenda Financeira</span>
          <Button variant="ghost" size="icon" aria-label="Fechar histórico" onClick={onFechar}>
            <X size={17} />
          </Button>
        </div>
        {q.isLoading ? <Skeleton className="h-28" /> : q.data?.length ? <ListaMovimentos itens={q.data} colaboradoras={colaboradoras} /> : <EmptyState icon={History} title="Nenhuma movimentação ainda" />}
      </section>
    </div>
  );
}
