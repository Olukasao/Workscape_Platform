import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
  HelpCircle,
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
  type AgendaFinanceira as AgendaFinanceiraDados,
  type Colaboradora,
  type Filtros,
  type Indicadores,
  type MovimentoHistorico,
  type Ocorrencia,
} from "../../services/agendaFinanceira";
import { passosTourAgendaFinanceira, TOUR_AGENDA_FIN } from "../../tour/passosAgendaFinanceira";
import { marcarVisto, useTour } from "../../tour/tour";
import { useSession } from "../../stores/workspace";
import { Button } from "../../components/ui/button";
import { Badge, EmptyState, Segmented, Skeleton, type Tone } from "../../components/ui/primitives";

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
type Modo = "quadro" | "agenda";
const CHAVE_MODO = "agenda-financeira:modo";
const CHAVE_PERIODO = "agenda-financeira:periodo";
const modoSalvo = (): Modo => {
  try { return localStorage.getItem(CHAVE_MODO) === "agenda" ? "agenda" : "quadro"; } catch { return "quadro"; }
};

export default function AgendaFinanceira({ active }: { active: boolean }) {
  const [data, setData] = useState(today);
  const [modo, setModoEstado] = useState<Modo>(modoSalvo);
  const [periodo, setPeriodoEstado] = useState<"dia" | "semana">(() => {
    try { return localStorage.getItem(CHAVE_PERIODO) === "semana" ? "semana" : "dia"; } catch { return "dia"; }
  });
  const setPeriodo = (p: "dia" | "semana") => {
    setPeriodoEstado(p);
    setData(p === "semana" ? addDays(today(), -6) : today()); // a semana termina hoje (o que importa é o que já abriu)
    try { localStorage.setItem(CHAVE_PERIODO, p); } catch { /* sem armazenamento */ }
  };
  const setModo = (m: Modo) => {
    setModoEstado(m);
    try { localStorage.setItem(CHAVE_MODO, m); } catch { /* sem armazenamento */ }
  };
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [pendentes, setPendentes] = useState<Record<string, Pendente>>({});
  const [aviso, setAviso] = useState<{ tom: "erro" | "ok"; texto: string } | null>(null);
  const [detalhe, setDetalhe] = useState<Ocorrencia | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [alvoDrop, setAlvoDrop] = useState<{ coluna: string; indice: number } | null>(null);
  // Tour guiado: os passos "af-ag-*" são do modo Agenda e os demais do Quadro; a escolha salva de cada pessoa não muda.
  const usuario = useSession((st) => st.user);
  const iniciarTour = useTour((t) => t.iniciar);
  const passoTour = useTour((t) => (t.ativo?.id === TOUR_AGENDA_FIN ? t.ativo.passos[t.passo]?.id : undefined));
  const modoAntesDoTour = useRef<Modo | null>(null);
  useEffect(() => {
    if (passoTour) {
      if (modoAntesDoTour.current === null) modoAntesDoTour.current = modo;
      setModoEstado(passoTour.startsWith("af-ag-") ? "agenda" : "quadro");
    } else if (modoAntesDoTour.current !== null) {
      setModoEstado(modoAntesDoTour.current);
      modoAntesDoTour.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passoTour]);
  const comoUsar = () => {
    if (usuario) marcarVisto(TOUR_AGENDA_FIN, usuario.id, "convite");
    iniciarTour(TOUR_AGENDA_FIN, passosTourAgendaFinanceira);
  };
  const { agenda, carregando, atualizando, erro, recarregar } = useAgendaFinanceira(data, active, modo === "agenda" && periodo === "semana" ? 7 : 1);
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
  const passo = modo === "agenda" && periodo === "semana" ? 7 : 1;
  const ehHoje = data === (passo > 1 ? addDays(today(), -6) : today());

  return (
    <section className="fin" aria-label="Agenda Financeira">
      <div className="toolbar agenda-toolbar">
        <div className="date-stepper" title="Escolhe o dia das ocorrências finalizadas; a fila de abertas é sempre a de agora">
          <Button variant="outline" size="icon" aria-label="Dia anterior" onClick={() => setData(addDays(dia, -passo))}>
            <ChevronLeft size={17} />
          </Button>
          <Button variant={ehHoje ? "soft" : "ghost"} size="sm" onClick={() => setData(passo > 1 ? addDays(today(), -6) : today())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" aria-label="Próximo dia" onClick={() => setData(addDays(dia, passo))}>
            <ChevronRight size={17} />
          </Button>
          <span className="fin-dia">
            <CalendarDays size={14} />{" "}
            {modo === "agenda" ? (periodo === "semana" ? `Semana de ${fmtDia.format(new Date(`${dia}T12:00:00Z`))} a ${fmtDia.format(new Date(`${addDays(dia, 6)}T12:00:00Z`))}` : dataLonga(dia)) : `Finalizadas em ${dataLonga(dia)}`}
          </span>
        </div>
        <span className="fin-inline" data-tour="af-modo">
        <Segmented
          label="Modo de visualização"
          value={modo}
          options={[
            ["quadro", "Quadro"],
            ["agenda", "Agenda"],
          ]}
          onChange={setModo}
        />
        </span>
        {modo === "agenda" ? (
          <span className="fin-inline" data-tour="af-periodo">
          <Segmented
            label="Período"
            value={periodo}
            options={[
              ["dia", "Dia"],
              ["semana", "7 dias"],
            ]}
            onChange={setPeriodo}
          />
          </span>
        ) : null}
        <label className="search-box" data-tour="af-filtros">
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
        <Button variant="outline" size="sm" data-tour="af-historico" onClick={() => setHistoricoAberto(true)} title="Quem moveu o quê, e o resultado no SGP">
          <History size={15} /> Histórico
        </Button>
        <Button variant="outline" size="sm" onClick={comoUsar} title="Passo a passo de como usar a Agenda Financeira">
          <HelpCircle size={15} /> Como usar
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
        <div className="fin-aviso is-info" role="note" data-tour="af-aviso-sgp">
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
          <Indicadores ind={agenda.indicadores} atualizadoEm={agenda.atualizadoEm} semana={agenda.dias > 1} />

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

          {modo === "agenda" ? (
            <GradeAgenda
              agenda={agenda}
              data={agenda.data}
              dias={agenda.dias}
              colunas={Object.fromEntries(Object.entries(quadro).map(([k, v]) => [k, visiveis(v, k)]))}
              finalizadas={visiveis(agenda.finalizadas, null)}
              podeDistribuir={podeDistribuir}
              selecionados={selecionados}
              pendentes={pendentes}
              onSelecionar={alternarSelecao}
              onAbrir={setDetalhe}
              onIniciarArraste={iniciarArraste}
              onSoltar={(ids, destino) => void distribuir(ids, destino === COLUNA_FILA ? null : destino, null)}
            />
          ) : (
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
            {agenda.colaboradoras.map((c, idx) => (
              <Coluna
                key={c.id}
                primeira={idx === 0}
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
          )}

          {modo === "quadro" ? (
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
          ) : null}
        </>
      ) : null}

      {detalhe ? <Detalhe o={detalhe} colaboradoras={agenda?.colaboradoras ?? []} onFechar={() => setDetalhe(null)} /> : null}
      {historicoAberto ? <Historico colaboradoras={agenda?.colaboradoras ?? []} onFechar={() => setHistoricoAberto(false)} /> : null}
    </section>
  );
}

function Indicadores({ ind, atualizadoEm, semana }: { ind: Indicadores; atualizadoEm: string; semana: boolean }) {
  const itens: Array<[string, string, string?, Tone?]> = [
    ["Na fila", String(ind.total), "Ocorrências de ativação abertas, pendentes ou em atendimento no SGP"],
    ["Sem responsável", String(ind.semResponsavel), "Sem ninguém no SGP e sem distribuição na agenda", ind.semResponsavel ? "warn" : undefined],
    ["Distribuídas", String(ind.distribuidas), "Com uma das colaboradoras do financeiro"],
    ["Em atendimento", String(ind.emAtendimento), "Status “Em execução” no SGP"],
    semana
      ? ["Finalizadas na semana", String(ind.finalizadasNoPeriodo ?? 0), "Finalizadas nos 7 dias mostrados", "ok"]
      : ["Finalizadas no dia", String(ind.finalizadasNoDia), "Finalizadas na data escolhida", "ok"],
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
    <div className="fin-kpis" role="list" aria-label="Indicadores da fila" data-tour="af-kpis">
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
  /** primeira coluna de colaboradora (alvo do tour) */
  primeira?: boolean;
}

function Coluna(p: ColunaProps) {
  const marcador = p.alvoDrop?.coluna === p.id ? p.alvoDrop.indice : null;
  return (
    <section className={`fin-coluna${p.fila ? " is-fila" : ""}${marcador !== null ? " is-alvo" : ""}`} aria-label={`Coluna ${p.titulo}`} data-tour={p.fila ? "af-fila" : p.primeira ? "af-colunas" : undefined}>
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
            <Cartao o={o} tour={!!p.fila && i === 0} podeDistribuir={p.podeDistribuir} selecionado={p.selecionados.has(o.id)} pendente={!!p.pendentes[o.id]} onSelecionar={p.onSelecionar} onAbrir={p.onAbrir} onIniciarArraste={p.onIniciarArraste} />
          </div>
        ))}
        {marcador !== null && marcador >= p.lista.length ? <div className="fin-marca" aria-hidden="true" /> : null}
      </div>
    </section>
  );
}

function Cartao({ o, compacto = false, tour = false, podeDistribuir, selecionado, pendente, onSelecionar, onAbrir, onIniciarArraste }: {
  o: Ocorrencia;
  compacto?: boolean;
  tour?: boolean;
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
      data-tour={tour ? "af-card" : undefined}
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

const fmtDiaIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const fmtHoraNum = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false });
/** Dia (AAAA-MM-DD) e hora cheia da abertura, em São Paulo. A hora só existe quando o número da ocorrência a traz (senão "sem horário"). */
function quandoAbriu(o: Ocorrencia): { dia: string; hora: number | null } {
  if (!o.abertoEm) return { dia: "", hora: null };
  const d = new Date(o.abertoEm);
  return { dia: fmtDiaIso.format(d), hora: o.aberturaComHora ? Number(fmtHoraNum.format(d)) % 24 : null };
}

/** Rótulos do tipo sem o prefixo "Ativação de". */
const tipoCurto = (t: string) => t.replace(/^ATIVA[ÇC][AÃ]O DE /i, "").toLowerCase().replace(/^./, (c) => c.toUpperCase());
const rotuloDia = (d: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/**
 * Modo "Agenda": a grade da Agenda dos Técnicos, mais simples e mais espaçada. Colunas = fila + colaboradoras. Em "Dia" há uma grade com as horas de
 * abertura; em "7 dias" há uma grade por dia (só com as horas que têm ocorrência). Em cima, o que continua aberto de dias anteriores; no fim de cada
 * dia, as concluídas (verdes), na coluna de quem finalizou.
 */
function GradeAgenda({ agenda, data, dias, colunas, finalizadas, podeDistribuir, selecionados, pendentes, onSelecionar, onAbrir, onIniciarArraste, onSoltar }: {
  agenda: AgendaFinanceiraDados;
  data: string;
  dias: number;
  colunas: Record<string, Ocorrencia[]>;
  finalizadas: Ocorrencia[];
  podeDistribuir: boolean;
  selecionados: Set<string>;
  pendentes: Record<string, Pendente>;
  onSelecionar: (id: string, soUm?: boolean) => void;
  onAbrir: (o: Ocorrencia) => void;
  onIniciarArraste: (e: React.DragEvent, o: Ocorrencia) => void;
  onSoltar: (ids: string[], destino: string) => void;
}) {
  const semana = dias > 1;
  const chaves = [COLUNA_FILA, ...agenda.colaboradoras.map((c) => c.id)];
  const titulo = (id: string) => (id === COLUNA_FILA ? "Fila (sem responsável)" : agenda.colaboradoras.find((c) => c.id === id)?.nome ?? id);
  const listaDias = Array.from({ length: dias }, (_, i) => addDays(data, i));
  const todas = chaves.flatMap((k) => colunas[k] ?? []);
  const quando = new Map(todas.map((o) => [o.id, quandoAbriu(o)]));
  const abertasEm = (k: string, d: string) => (colunas[k] ?? []).filter((o) => quando.get(o.id)?.dia === d);
  const anteriores = (k: string) => (colunas[k] ?? []).filter((o) => (quando.get(o.id)?.dia ?? "") < data);
  const colunaDeQuemFechou = (o: Ocorrencia) => agenda.colaboradoras.find((c) => c.usuarioSgp === o.usuarioFinalizacao || (!o.usuarioFinalizacao && c.usuarioSgp === o.responsavelSgp))?.id ?? COLUNA_FILA;
  const totalAnteriores = chaves.reduce((n, k) => n + anteriores(k).length, 0);
  const propsChip = { podeDistribuir, selecionados, pendentes, onSelecionar, onAbrir, onIniciarArraste };

  const celula = (k: string, itens: Ocorrencia[], extra = "") => (
    <div
      key={k}
      className={`tg-cell ${extra}`}
      onDragOver={(e) => { if (podeDistribuir) e.preventDefault(); }}
      onDragEnter={(e) => { if (podeDistribuir) e.currentTarget.classList.add("is-drop-target"); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) e.currentTarget.classList.remove("is-drop-target"); }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("is-drop-target");
        const bruto = e.dataTransfer.getData(MIME);
        if (!bruto) return;
        try {
          const ids = (JSON.parse(bruto) as string[]).filter((id) => !(colunas[k] ?? []).some((o) => o.id === id)); // já está nesta coluna: nada a fazer
          if (ids.length) onSoltar(ids, k);
        } catch { /* arraste de outra origem */ }
      }}
    >
      {itens.map((o) => <Chip key={o.id} o={o} {...propsChip} selecionado={selecionados.has(o.id)} pendente={!!pendentes[o.id]} />)}
    </div>
  );
  const cabecalho = (
    <>
      <div className="tg-corner" />
      {chaves.map((k) => (
        <div key={k} className="tg-head">
          <strong title={titulo(k)}>{titulo(k)}</strong>
          <span className="tg-tag" data-kind="carga" title={`${(colunas[k] ?? []).length} ocorrência(s) abertas`}>Carga {(colunas[k] ?? []).length}</span>
        </div>
      ))}
    </>
  );
  const bloco = (chave: string, linhas: React.ReactNode) => (
    <div className="tg-scroll" key={chave}>
      <div className="tg" style={{ "--cols": chaves.length } as React.CSSProperties}>
        {cabecalho}
        {linhas}
      </div>
    </div>
  );
  const linha = (rotulo: string, itensPor: (k: string) => Ocorrencia[], extra = "") => (
    <Fragment key={rotulo}>
      <div className={`tg-hour ${extra.includes("is-sem") ? "is-sem" : ""}`}>{rotulo}</div>
      {chaves.map((k) => celula(k, itensPor(k), extra))}
    </Fragment>
  );

  return (
    <div className={`fin-grade${semana ? " is-semana" : ""}`} data-tour="af-grade">
      <div className="agenda-legend fin-legenda" aria-label="Legenda das cores">
        <span><i className="is-0" /> Aberta</span>
        <span><i className="is-2" /> Em atendimento</span>
        <span><i className="is-3" /> Aguardando retorno</span>
        <span><i className="is-1" /> Concluída</span>
        <span className="fin-legenda-borda"><i className="is-urg" /> Urgente (borda vermelha)</span>
        <span className="fin-legenda-borda"><i className="is-atn" /> Atenção (borda amarela)</span>
      </div>
      {totalAnteriores ? (
        <div className="schedule-day">
          <div className="schedule-date">
            <span className="schedule-date-main"><strong>Ainda abertas de dias anteriores</strong><small>abertas antes de {fmtDia.format(new Date(`${data}T12:00:00Z`))}</small></span>
            <span className="schedule-date-count">{totalAnteriores} ocorrência{totalAnteriores === 1 ? "" : "s"}</span>
          </div>
          {bloco("anteriores", linha("Anteriores", anteriores, "is-sem"))}
        </div>
      ) : null}
      {listaDias.map((d) => {
        const doDia = chaves.flatMap((k) => abertasEm(k, d));
        const concluidasDia = finalizadas.filter((o) => o.dataFinalizacao === d);
        const horasComItem = [...new Set(doDia.map((o) => quando.get(o.id)?.hora).filter((h): h is number => h !== null && h !== undefined))].sort((a, b) => a - b);
        // dia: grade inteira (8h às 20h, ampliada se preciso); semana: só as horas com ocorrência, para não ficar enorme
        const horas = semana ? horasComItem : Array.from({ length: Math.max(20, ...horasComItem) - Math.min(8, ...horasComItem) + 1 }, (_, i) => Math.min(8, ...horasComItem) + i);
        const semHora = chaves.some((k) => abertasEm(k, d).some((o) => quando.get(o.id)?.hora === null));
        return (
          <div className="schedule-day" key={d}>
            {semana ? (
              <div className="schedule-date">
                <span className="schedule-date-main"><strong>{rotuloDia(d)}</strong></span>
                {d === agenda.hoje ? <Badge tone="live" dot>Hoje</Badge> : null}
                <span className="schedule-date-count">{doDia.length} aberta{doDia.length === 1 ? "" : "s"} · {concluidasDia.length} concluída{concluidasDia.length === 1 ? "" : "s"}</span>
              </div>
            ) : null}
            {semana && doDia.length === 0 && concluidasDia.length === 0 ? (
              <p className="fin-dia-vazio">Nenhuma ocorrência neste dia.</p>
            ) : bloco(
              d,
              <>
                {semHora || !semana ? linha("Sem horário", (k) => abertasEm(k, d).filter((o) => quando.get(o.id)?.hora === null), "is-sem") : null}
                {horas.map((h) => linha(`${String(h).padStart(2, "0")}:00`, (k) => abertasEm(k, d).filter((o) => quando.get(o.id)?.hora === h).sort((a, b) => (a.abertoEm || "").localeCompare(b.abertoEm || ""))))}
                {linha("Concluídas", (k) => concluidasDia.filter((o) => colunaDeQuemFechou(o) === k), "is-sem is-concluidas")}
              </>,
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Ficha da grade: cor pelo status do SGP (verde = concluída), borda pela prioridade; nome em cima e tipo + espera embaixo. */
function Chip({ o, podeDistribuir, selecionado, pendente, onSelecionar, onAbrir, onIniciarArraste }: {
  o: Ocorrencia;
  podeDistribuir: boolean;
  selecionado: boolean;
  pendente: boolean;
  onSelecionar: (id: string, soUm?: boolean) => void;
  onAbrir: (o: Ocorrencia) => void;
  onIniciarArraste: (e: React.DragEvent, o: Ocorrencia) => void;
}) {
  const aberta = o.statusId !== 1;
  return (
    <button
      type="button"
      className={`tg-event work-order is-${o.statusId} fin-chip is-${o.prioridade}${selecionado ? " is-sel" : ""}${pendente ? " is-pendente" : ""}`}
      draggable={podeDistribuir && aberta && !pendente}
      onDragStart={(e) => onIniciarArraste(e, o)}
      onClick={(e) => {
        if (podeDistribuir && aberta && (e.ctrlKey || e.metaKey || e.shiftKey)) onSelecionar(o.id);
        else onAbrir(o);
      }}
      title={[`Ocorrência ${o.numero}`, o.cliente, `Contrato ${o.contrato ?? "—"}`, o.tipo, `${o.statusRotulo}${aberta ? ` · aguardando ${formatarEspera(o.aguardandoMin)}` : o.usuarioFinalizacao ? ` por ${o.usuarioFinalizacao}` : ""}`, o.naoGravadoNoSgp ? "Não gravado no SGP" : "", o.responsavelSgp ? `SGP: ${o.responsavelSgp}` : ""].filter(Boolean).join("\n")}
    >
      <span className="fin-chip-linha">
        <span className="tg-cliente">{o.cliente || "Cliente sem nome"}</span>
        {aberta && o.prioridade !== "normal" ? <span className="fin-chip-prio" aria-label={ROTULO_PRIORIDADE[o.prioridade]}>{o.prioridade === "urgente" ? "!!" : "!"}</span> : null}
        {o.naoGravadoNoSgp ? <span className="fin-chip-local" aria-hidden="true">•</span> : null}
      </span>
      <span className="fin-chip-sub">
        {tipoCurto(o.tipo)}
        {aberta ? ` · ${formatarEspera(o.aguardandoMin)}` : o.usuarioFinalizacao ? ` · ${o.usuarioFinalizacao}` : ""}
      </span>
    </button>
  );
}
