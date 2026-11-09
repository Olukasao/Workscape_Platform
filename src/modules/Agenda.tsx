import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  Clock,
  X,
  ArrowRightLeft,
  Coffee,
  Copy,
  History,
  Navigation,
  SlidersHorizontal,
  ExternalLink,
  Globe,
  Maximize2,
  Minimize2,
  PanelTopClose,
} from "lucide-react";
import { clients, errorMessage } from "../services/api";
import {
  addDays,
  today,
  useAgendaFeed,
  useInstallationFeed,
  type WorkOrder,
} from "../services/agenda";
import { useServers, useSession } from "../stores/workspace";
import { avisarMudancaAgenda, destacar, reintegrar, podeDestacar } from "../services/janelaDestacada";
import { Button } from "../components/ui/button";
import {
  Badge,
  EmptyState,
  Segmented,
  Skeleton,
} from "../components/ui/primitives";
import { orderTone } from "./agendaStatus";
import CoordenadorRota from "./agenda/CoordenadorRota";
import AgendaWeb from "./agenda/AgendaWeb";
import MapaChamados from "./agenda/MapaChamados";
import HistoricoAcoes from "./agenda/HistoricoAcoes";
import GerenciarAgenda, { type Tecnico } from "./agenda/GerenciarAgenda";
import AgendaInterativa, { INICIO_AGENDA, TIPOS_BLOQUEIO, inicioPeloClique, type Popup } from "./agenda/AgendaInterativa";

const PREFERENCIA_VERSAO = "workspace.agenda.versao";
const preferirVersaoWeb = () => { try { return localStorage.getItem(PREFERENCIA_VERSAO) !== "minimalista"; } catch { return true; } };
type Aba = "instalacao" | "tecnica" | "rota" | "mapa" | "historico";
const ABAS: Aba[] = ["tecnica", "instalacao", "rota", "mapa", "historico"];
interface Absence {
  id?: number;
  ref?: string;
  technician_id: string;
  absence_reason: string;
  absence_note?: string;
  completed_at?: string | null;
}
interface Lunch {
  id?: number;
  ref?: string;
  tecnicoId: string;
  horaInicio: string;
  horaFim: string;
  tipo?: string;
  descricao?: string | null;
  finalizado?: boolean;
}
const dayName = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
export default function Agenda({
  service,
  detached = false,
  compact = false,
  onToggleCompact,
}: {
  service: "agenda";
  /** Renderizada na janela destacada (rota própria, sem a barra lateral do Workspace). */
  detached?: boolean;
  compact?: boolean;
  onToggleCompact?: () => void;
}) {
  const [date, setDate] = useState(today),
    [weekly, setWeekly] = useState(false),
    [search, setSearch] = useState(""),
    [technician, setTechnician] = useState(""),
    [selected, setSelected] = useState<(WorkOrder & { date: string }) | null>(
      null,
    ),
    [error, setError] = useState(""),
    [manageOpen, setManageOpen] = useState(false),
    [popup, setPopup] = useState<Popup | null>(null),
    [pending, setPending] = useState(false),
    [confirmMove, setConfirmMove] = useState<{
      order: WorkOrder & { date: string };
      destination: string;
    } | null>(null);
  const location = useLocation();
  const pageActive = location.pathname === "/agenda";
  const [aba, setAbaState] = useState<Aba>("tecnica");
  // A versão web (a agenda original, igual ao navegador) é a padrão no aplicativo: é o visual que a equipe prefere.
  // A versão minimalista do próprio Workspace continua a um clique ("Versão minimalista") e a escolha fica lembrada neste computador.
  // A versão web usa uma WebContentsView nativa; a minimalista fica como alternativa caso essa camada falhe.
  const [versaoWeb, setVersaoWebState] = useState(() => !!window.desktop && pageActive && preferirVersaoWeb());
  const setVersaoWeb = (web: boolean) => {
    setVersaoWebState(web);
    try { localStorage.setItem(PREFERENCIA_VERSAO, web ? "web" : "minimalista"); } catch { /* sem armazenamento: vale só nesta abertura */ }
  };
  // A página nativa da versão web nunca fica montada com a agenda escondida (ela esconderia a do Navegador): sai ao deixar a tela
  // e volta, pela preferência, ao entrar de novo.
  useEffect(() => {
    if (!pageActive) setVersaoWebState(false);
    else if (window.desktop && preferirVersaoWeb()) setVersaoWebState(true);
  }, [pageActive]);
  const [visitadas, setVisitadas] = useState<Set<Aba>>(() => new Set(["tecnica"]));
  const setAba = (a: Aba) => {
    setAbaState(a);
    setTechnician("");
    setSelected(null);
    setConfirmMove(null);
    setError("");
    setVisitadas((v) => (v.has(a) ? v : new Set(v).add(a)));
  };
  const dates = useMemo(
    () => Array.from({ length: weekly ? 7 : 1 }, (_, i) => addDays(date, i)),
    [date, weekly],
  );
  const maintenance = useAgendaFeed(service, dates, pageActive);
  const installationActive = pageActive && aba === "instalacao";
  const installation = useInstallationFeed(
    dates,
    installationActive,
    pageActive && maintenance.loaded,
  );
  const isInstallation = aba === "instalacao";
  const feed = isInstallation ? installation : maintenance;
  const agendaTitle = isInstallation ? "Agenda Instalação" : "Agenda Manutenção";
  const config = useServers((s) => s.config),
    user = useSession((s) => s.user),
    query = useQueryClient();
  const api = clients[service],
    prefix = isInstallation ? "/agenda-instalacao" : "/agenda-tecnicos";
  const enabled = !!config[service] && !!user && (!isInstallation || installation.loaded);
  const technicianName = (id: string) => isInstallation
    ? installation.technicians.find((t) => t.id === id)?.nome || id
    : id;
  const meta = useQuery({
    queryKey: [service, isInstallation ? "instalacao" : "manutencao", "meta", dates.join(",")],
    enabled,
    queryFn: async () => {
      const [absences, lunches, tech] = await Promise.allSettled([
        Promise.all(
          dates.map(async (day) => ({
            date: day,
            data: (
              await api.get(isInstallation ? `${prefix}/ausencias` : "/technician-absences", { params: { date: day } })
            ).data,
          })),
        ),
        Promise.all(
          dates.map(async (day) => ({
            date: day,
            data: (
              await api.get(`${prefix}/almocos`, { params: { data: day } })
            ).data,
          })),
        ),
        api.get(`${prefix}/tecnicos`),
      ]);
      return {
        absences:
          absences.status === "fulfilled"
            ? (absences.value.flatMap((v) =>
                (v.data.absences || v.data.ausencias || []).map(
                  (a: Absence) => ({ ...a, ref: a.technician_id, technician_id: technicianName(a.technician_id), date: v.date }),
                ),
              ) as (Absence & { date: string })[])
            : [],
        lunches:
          lunches.status === "fulfilled"
            ? (lunches.value.flatMap((v) =>
                (v.data.almocos || []).map((a: Lunch) => ({
                  ...a,
                  ref: a.tecnicoId,
                  tecnicoId: technicianName(a.tecnicoId),
                  date: v.date,
                })),
              ) as (Lunch & { date: string })[])
            : [],
        technicians:
          tech.status === "fulfilled"
            ? ((tech.value?.data.tecnicos || []).map((t: string | { nome: string }) => typeof t === "string" ? t : t.nome) as string[])
            : [],
        incomplete: [absences, lunches].some((r) => r.status === "rejected"),
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
  useEffect(() => {
    if (location.pathname !== "/agenda") return;
    const params = new URLSearchParams(location.search),
      requested = params.get("data");
    const abaPedida = params.get("aba") as Aba | null;
    if (abaPedida && ABAS.includes(abaPedida) && abaPedida !== aba) setAba(abaPedida);
    if (
      requested &&
      /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
      requested !== date
    ) {
      setDate(requested);
      return;
    }
    const id = params.get("os");
    if (id && versaoWeb) setVersaoWebState(false);
    if (id && feed.loaded) {
      const order = feed.items.find(
        (o) => String(o.idOrdemServico || o.id) === id,
      );
      if (order) setSelected(order);
    }
  }, [
    location.pathname,
    location.search,
    date,
    feed.loaded,
    feed.items,
    service,
  ]);
  const permissions = useQuery({
    queryKey: ["agenda", "transfer-capability"],
    enabled:
      enabled &&
      service === "agenda" &&
      user?.perfil === "admin",
    queryFn: async () => (await api.get("/agenda-tecnicos/tecnicos-sgp")).data,
  });
  useEffect(() => {
    if (!selected && !confirmMove) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(
      confirmMove ? "[role=alertdialog]" : "[role=dialog]",
    );
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),select,input,a[href],[tabindex="0"]',
        ) || [],
      );
    focusables()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (confirmMove && !pending) setConfirmMove(null);
        else if (!confirmMove) setSelected(null);
      }
      if (event.key === "Tab") {
        const targets = focusables(),
          first = targets[0],
          last = targets.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [selected, confirmMove, pending]);
  const canMove =
    service === "agenda" &&
    user?.perfil === "admin" &&
    permissions.data?.podeTrocarTecnico === true;
  const technicians = [
    ...new Set(
      [
        ...(meta.data?.technicians || []),
        ...feed.items.map((i) => i.tecnico),
      ].filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const visible = feed.items.filter(
    (o) =>
      (!technician || o.tecnico === technician) &&
      `${o.cliente} ${o.idOrdemServico || o.id || ""} ${o.bairro || ""} ${o.tecnico}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  async function transfer() {
    if (!confirmMove || !canMove) return;
    setPending(true);
    setError("");
    try {
      const { order, destination } = confirmMove;
      await api.post(
        `/agenda-tecnicos/ordens-servico/${order.idOrdemServico || order.id}/tecnico-responsavel`,
        {
          tecnicoDestino: destination,
          tecnicoAnterior: order.tecnico,
          responsavelAnteriorSgp: order.tecnicoResponsavelSgpId || "",
          data: order.date,
        },
      );
      setConfirmMove(null);
      setSelected(null);
      void query.invalidateQueries({ queryKey: ["agenda"] });
      avisarMudancaAgenda();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }
  const isToday = (d: string) => d === today();
  const teamColors = useQuery({
    queryKey: [service, "team-colors", date],
    enabled: enabled && !isInstallation,
    staleTime: 60000,
    refetchInterval: 120000,
    queryFn: async () => {
      const data = (await api.get("/technician-team-colors", { params: { date } })).data;
      return (data.teamColors || data.coresEquipe || []) as {
        id: number;
        technician_id: string;
        team_color: string;
      }[];
    },
  });
  const equipeDe = (t: string) =>
    !isInstallation ? teamColors.data?.find((c) => c.technician_id === t)?.team_color : undefined;
  const limiteMin = (isInstallation ? 21 : 24) * 60 - 1;
  const agoraHora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const contadores = (() => {
    let atrasados = 0,
      abertos = 0,
      andamento = 0;
    const execPorTecnico: Record<string, number> = {};
    for (const o of visible) {
      const n = statusNumero(o.status);
      if (n === 2) {
        andamento++;
        execPorTecnico[`${o.date}|${o.tecnico}`] =
          (execPorTecnico[`${o.date}|${o.tecnico}`] || 0) + 1;
      }
      if (n === 0 || n === 3) {
        abertos++;
        if (
          o.hora &&
          (o.date < today() || (isToday(o.date) && o.hora.slice(0, 5) < agoraHora))
        )
          atrasados++;
      }
    }
    return {
      atrasados,
      abertos,
      andamento,
      simultaneos: Object.values(execPorTecnico).filter((v) => v > 1).length,
      total: visible.length,
    };
  })();
  const ultimaHora = Math.max(
    18,
    ...visible
      .map((o) => parseInt(String(o.hora || "").split(":")[0], 10))
      .filter((h) => Number.isFinite(h) && h <= HORA_FIM),
  );
  const horas = Array.from(
    { length: ultimaHora - HORA_INICIO + 1 },
    (_, i) => HORA_INICIO + i,
  );
  const colunas = technician ? [technician] : technicians;
  const alvoDe = (nome: string) => ({ nome, ref: manageTechs.find((t) => t.nome === nome)?.id || nome });
  const manageTechs: Tecnico[] = isInstallation
    ? installation.technicians.map((t) => ({ id: t.id, nome: t.nome }))
    : technicians.map((t) => ({ id: t, nome: t }));
  return (
    <>
    {versaoWeb ? <AgendaWeb active={pageActive} onBack={() => setVersaoWeb(false)} /> : null}
    <div hidden={versaoWeb} className={`page agenda-page agenda-classic${compact ? " agenda-compacta" : ""}${detached ? " agenda-destacada" : ""}`}>
      <header className="agenda-topbar">
        <div className="agenda-title">
          <span className="page-heading-icon" aria-hidden="true">
            <CalendarDays size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h1>Agenda de técnicos</h1>
            <p>Equipes, atendimentos e horários em uma visão compartilhada.</p>
          </div>
          <span className="agenda-noc">NOC</span>
        </div>
        <div className="agenda-topbar-side">
          <span className={`connection ${feed.configured && !dates.some((d) => feed.feeds[d]?.error) ? "online" : ""}`}>
            <i />
            {feed.configured ? (dates.some((d) => feed.feeds[d]?.error) ? "Reconectando" : "Conectado") : "Não configurado"}
          </span>
          {window.desktop ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVersaoWeb(true)}
              title="Abre a agenda original (versão web) aqui dentro do aplicativo"
            >
              <Globe size={15} /> Versão web
            </Button>
          ) : null}
          {detached ? (
            <>
              <Button
                variant={compact ? "soft" : "outline"}
                size="sm"
                aria-pressed={compact}
                onClick={onToggleCompact}
                title="Oculta textos e blocos secundários para ganhar espaço"
              >
                {compact ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
                {compact ? "Modo normal" : "Modo compacto"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reintegrar("agenda")}
                title="Fecha esta janela e devolve a agenda ao Workspace"
              >
                <PanelTopClose size={15} /> Reintegrar
              </Button>
            </>
          ) : podeDestacar() ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => destacar("agenda")}
              title="Abre a agenda em uma janela separada, que pode ficar em outro monitor"
            >
              <ExternalLink size={15} /> Destacar
            </Button>
          ) : null}
          <label className="agenda-date">
            <span>Data</span>
            <input
              aria-label="Data da agenda"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
        </div>
      </header>
      <div className="agenda-legend" aria-label="Legenda">
        {(
          [
            ["is-0", "Aberta"],
            ["is-1", "Encerrada"],
            ["is-2", "Em execução"],
            ["is-4", "Iracema"],
            ["is-5", "POP"],
          ] as const
        ).map(([c, l]) => (
          <span key={l}>
            <i className={c} />
            {l}
          </span>
        ))}
      </div>
      <nav className="agenda-tabs" role="tablist" aria-label="Seções da agenda">
        {(
          [
            ["tecnica", "Agenda Manutenção", CalendarDays],
            ["instalacao", "Agenda Instalação", CalendarDays],
            ["rota", "Coordenador de Rota", Navigation],
            ["mapa", "Mapa de Chamados", MapPin],
            ["historico", "Histórico de Ações", History],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
      {visitadas.has("rota") ? (
        <div hidden={aba !== "rota"}>
          <CoordenadorRota date={date} active={pageActive && aba === "rota"} />
        </div>
      ) : null}
      {visitadas.has("mapa") ? (
        <div hidden={aba !== "mapa"}>
          <MapaChamados active={pageActive && aba === "mapa"} />
        </div>
      ) : null}
      {visitadas.has("historico") ? (
        <div hidden={aba !== "historico"}>
          <HistoricoAcoes active={pageActive && aba === "historico"} />
        </div>
      ) : null}
      <div hidden={aba !== "tecnica" && aba !== "instalacao"}>
        <div className="toolbar agenda-toolbar">
          <div className="date-stepper">
            <Button
              variant="outline"
              size="icon"
              aria-label="Dia anterior"
              title={weekly ? "Semana anterior" : "Dia anterior"}
              onClick={() => setDate(addDays(date, -(weekly ? 7 : 1)))}
            >
              <ChevronLeft size={17} />
            </Button>
            <Button
              variant={isToday(date) ? "soft" : "ghost"}
              size="sm"
              onClick={() => setDate(today())}
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximo dia"
              title={weekly ? "Próxima semana" : "Próximo dia"}
              onClick={() => setDate(addDays(date, weekly ? 7 : 1))}
            >
              <ChevronRight size={17} />
            </Button>
          </div>
          <Segmented
            label="Período"
            value={weekly ? "week" : "day"}
            options={[
              ["day", "Dia"],
              ["week", "7 dias"],
            ]}
            onChange={(v) => setWeekly(v === "week")}
          />
          <Button variant="outline" size="sm" onClick={() => setManageOpen(true)} title="Ausências, equipes e bloqueios de horário">
            <SlidersHorizontal size={15} /> Gerenciar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAba("historico")} title="Quem alterou o quê na agenda">
            <History size={15} /> Histórico
          </Button>
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="Pesquisar chamados"
              placeholder="Cliente, OS ou bairro"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                className="search-clear"
                aria-label="Limpar pesquisa"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            ) : null}
          </label>
          <select
            aria-label="Filtrar técnico"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
          >
            <option value="">Todos os técnicos</option>
            {technicians.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="agenda-counters panel">
          <div>
            <strong>{agendaTitle}</strong>
            <span>
              {canMove
                ? "Arraste um chamado para outro técnico para transferir."
                : "Clique em um chamado para ver os detalhes."}
            </span>
          </div>
          <ul>
            <li data-tone="crit">Atrasados: {contadores.atrasados}</li>
            <li data-tone="info">Abertos: {contadores.abertos}</li>
            <li data-tone="warn">Em andamento: {contadores.andamento}</li>
            <li data-tone="crit">
              Técnicos com chamados simultâneos: {contadores.simultaneos}
            </li>
            <li data-tone="neutral">Total: {contadores.total}</li>
          </ul>
        </div>
        {!feed.configured ? (
          <div className="panel">
            <EmptyState icon={CalendarDays} title="Conecte sua agenda">
              Configure a URL do serviço em Configurações para consultar dados
              reais.
            </EmptyState>
          </div>
        ) : (
          <>
            {dates.some((d) => feed.feeds[d]?.error) && (
              <div className="inline-error" role="status">
                {dates.map((d) => feed.feeds[d]?.error).filter(Boolean)[0]}
                {feed.items.length > 0
                  ? " Exibindo a última resposta recebida."
                  : ""}
              </div>
            )}
            {meta.data?.incomplete && (
              <div className="inline-error is-warn">
                Ausências ou horários de almoço indisponíveis. A agenda de
                chamados continua disponível.
              </div>
            )}
            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
            {!feed.loaded && !feed.items.length ? (
              <div className="tg-loading" aria-busy="true">
                <Skeleton className="h-28" />
                <Skeleton className="h-64" />
              </div>
            ) : (
              <div className="schedule-scroll">
                {dates.map((day) => {
                  const dayCount = visible.filter((i) => i.date === day).length;
                  return (
                    <div className="schedule-day" key={day}>
                      {weekly ? (
                        <div className="schedule-date">
                          <span className="schedule-date-main">
                            <strong>{dateLabel(day)}</strong>
                            <small>{dayName(day)}</small>
                          </span>
                          {isToday(day) ? (
                            <Badge tone="live" dot>
                              Hoje
                            </Badge>
                          ) : null}
                          <span className="schedule-date-count">
                            {dayCount} atendimento{dayCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      ) : null}
                      {colunas.length ? (
                        <div className="tg-scroll">
                          <div
                            className="tg"
                            style={{ "--cols": colunas.length } as React.CSSProperties}
                          >
                            <div className="tg-corner" />
                            {colunas.map((t) => {
                              const absence = meta.data?.absences.find(
                                (a) => a.technician_id === t && a.date === day,
                              );
                              const motivo = String(absence?.absence_reason || "").toLowerCase();
                              const equipe = equipeDe(t);
                              const carga = visible.filter(
                                (o) => o.tecnico === t && o.date === day,
                              ).length;
                              return (
                                <div
                                  key={t}
                                  className="tg-head"
                                  data-absence={absence ? motivo || "outro" : undefined}
                                >
                                  <button
                                    type="button"
                                    className="tg-tag is-action"
                                    data-kind={absence ? motivo || "outro" : "none"}
                                    title={absence ? "Alterar ou remover a ausência" : `Definir o motivo da ausência de ${t}`}
                                    onClick={(e) => {
                                      const r = e.currentTarget.getBoundingClientRect();
                                      setPopup({ kind: "ausencia", dia: day, x: r.left, y: r.bottom + 4, alvo: alvoDe(t), atual: absence ? { id: absence.id, ref: absence.ref || t, absence_reason: absence.absence_reason, absence_note: absence.absence_note, completed_at: absence.completed_at } : undefined });
                                    }}
                                  >
                                    {absence ? ausenciaLabel(motivo) : "Ausência"}
                                  </button>
                                  {isInstallation ? null : (
                                    <button
                                      type="button"
                                      className="tg-tag is-action"
                                      data-kind="equipe"
                                      style={equipe ? ({ "--team": EQUIPE_COR[equipe] || equipe } as React.CSSProperties) : undefined}
                                      title={`Definir a cor da equipe de ${t}`}
                                      onClick={(e) => {
                                        const r = e.currentTarget.getBoundingClientRect();
                                        setPopup({ kind: "equipe", dia: day, x: r.left, y: r.bottom + 4, alvo: alvoDe(t), atual: teamColors.data?.find((c) => c.technician_id === t) });
                                      }}
                                    >
                                      {equipe ? `Equipe ${equipe}` : "Equipe"}
                                    </button>
                                  )}
                                  <strong title={t}>{t}</strong>
                                  <span className="tg-tag" data-kind="carga" title={`${carga} chamado(s)`}>
                                    Carga {carga}
                                  </span>
                                </div>
                              );
                            })}
                            <div className="tg-hour is-sem">Sem horário</div>
                            {colunas.map((t) => {
                              const sem = visible.filter(
                                (o) => o.tecnico === t && o.date === day && !o.hora,
                              );
                              return (
                                <div key={t} className="tg-cell is-sem">
                                  {sem.map((o, i) => (
                                    <EventChip
                                      key={`${o.id || i}`}
                                      order={o}
                                      day={day}
                                      canMove={canMove}
                                      onOpen={() => setSelected(o)}
                                    />
                                  ))}
                                </div>
                              );
                            })}
                            {horas.map((h) => (
                              <Fragment key={h}>
                                <div className="tg-hour">{h}:00</div>
                                {colunas.map((t) => {
                                  const absence = meta.data?.absences.find(
                                    (a) => a.technician_id === t && a.date === day,
                                  );
                                  const motivo = String(absence?.absence_reason || "").toLowerCase();
                                  const lunch = meta.data?.lunches.filter(
                                    (a) => a.tecnicoId === t && a.date === day,
                                  );
                                  const lunchHere = lunch?.filter(
                                    (l) => parseInt(l.horaInicio, 10) === h,
                                  );
                                  const inLunch = lunch?.some(
                                    (l) =>
                                      parseInt(l.horaInicio, 10) <= h &&
                                      h < Math.max(parseInt(l.horaFim, 10), parseInt(l.horaInicio, 10) + 1),
                                  );
                                  const orders = visible
                                    .filter(
                                      (o) =>
                                        o.tecnico === t &&
                                        o.date === day &&
                                        parseInt(String(o.hora || "").split(":")[0], 10) === h,
                                    )
                                    .sort((a, b) =>
                                      (a.hora || "").localeCompare(b.hora || ""),
                                    );
                                  return (
                                    <div
                                      key={t}
                                      className={`tg-cell ${inLunch ? "is-lunch" : ""}`}
                                      data-absence={absence ? motivo || "outro" : undefined}
                                      title="Clique para adicionar almoço, reunião ou outro bloqueio neste horário"
                                      onClick={(e) => {
                                        if ((e.target as HTMLElement).closest(".tg-event, .lunch, .ag-pop")) return;
                                        const inicio = inicioPeloClique(e, h);
                                        if (inicio < INICIO_AGENDA || inicio >= limiteMin) return;
                                        setPopup({ kind: "novo-bloco", dia: day, x: e.clientX + 4, y: e.clientY + 4, alvo: alvoDe(t), inicio });
                                      }}
                                      onDragOver={(e) => {
                                        if (canMove) e.preventDefault();
                                      }}
                                      onDragEnter={(e) => {
                                        if (canMove) e.currentTarget.classList.add("is-drop-target");
                                      }}
                                      onDragLeave={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget as Node))
                                          e.currentTarget.classList.remove("is-drop-target");
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.remove("is-drop-target");
                                        if (!canMove) return;
                                        try {
                                          const data = JSON.parse(
                                            e.dataTransfer.getData("application/acessa-os"),
                                          );
                                          const order = feed.items.find(
                                            (i) =>
                                              String(i.idOrdemServico || i.id) === data.id &&
                                              i.date === data.date,
                                          );
                                          if (order && order.tecnico !== t)
                                            setConfirmMove({ order, destination: t });
                                        } catch {}
                                      }}
                                    >
                                      {lunchHere?.map((l, i) => {
                                        const cfg = TIPOS_BLOQUEIO[l.tipo || "almoco"] || TIPOS_BLOQUEIO.almoco;
                                        return (
                                          <button
                                            type="button"
                                            className={`lunch ${l.finalizado ? "is-done" : ""}`}
                                            data-tipo={l.tipo || "almoco"}
                                            key={`l${i}`}
                                            title="Clique para editar ou remover"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPopup({ kind: "acoes-bloco", dia: day, x: e.clientX + 4, y: e.clientY + 4, alvo: alvoDe(t), bloco: { id: l.id, ref: l.ref || t, tipo: l.tipo, descricao: l.descricao, horaInicio: l.horaInicio, horaFim: l.horaFim, finalizado: l.finalizado } });
                                            }}
                                          >
                                            <span aria-hidden="true">{cfg.icon}</span>
                                            {cfg.label} · {l.horaInicio}–{l.horaFim}{l.descricao ? ` · ${l.descricao}` : ""}
                                          </button>
                                        );
                                      })}
                                      {orders.map((o, i) => (
                                        <EventChip
                                          key={`${o.id || i}`}
                                          order={o}
                                          day={day}
                                          canMove={canMove}
                                          onOpen={() => setSelected(o)}
                                        />
                                      ))}
                                    </div>
                                  );
                                })}
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="panel">
                          <EmptyState
                            icon={CalendarDays}
                            title="Nenhum atendimento retornado"
                          >
                            O serviço não enviou chamados ou técnicos para esta
                            data.
                          </EmptyState>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {selected && (
        <div className="modal-backdrop is-drawer" onClick={() => setSelected(null)}>
          <section
            className="detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do chamado"
            data-tone={orderTone(selected.status)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="detail-head">
              <span className="detail-kicker mono">
                OS {String(selected.idOrdemServico || selected.id || "—")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fechar detalhes"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </Button>
            </div>
            <h2>{selected.cliente}</h2>
            <div className="detail-tags">
              <Badge tone={orderTone(selected.status)} dot>
                {selected.status || "Status indisponível"}
              </Badge>
              {selected.hora ? (
                <Badge>
                  <Clock size={12} />
                  {selected.hora}
                </Badge>
              ) : null}
              {selected.pop ? <Badge tone="info">{String(selected.pop)}</Badge> : null}
              <button
                type="button"
                className="text-button"
                onClick={() => void navigator.clipboard?.writeText(selected.cliente || "")}
              >
                <Copy size={13} />
                Copiar nome
              </button>
            </div>
            <dl>
              {[
                ["OS", selected.idOrdemServico || selected.id],
                ["ID do cliente", selected.idCliente],
                ["Técnico", selected.tecnico],
                ["Data", dateLabel(selected.date)],
                ["Horário", selected.hora],
                ["Turno", selected.turnoHorario],
                ["Motivo", selected.motivo],
                ["POP", selected.pop],
                ["Endereço", selected.enderecoCompleto],
                ["Bairro", selected.bairro],
                [
                  "Localização",
                  selected.latitude && selected.longitude
                    ? `${selected.latitude}, ${selected.longitude}`
                    : "Não informada pelo serviço",
                ],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{String(label)}</dt>
                  <dd>{String(value || "—")}</dd>
                </div>
              ))}
            </dl>
            <div className="subtle-note">
              <MapPin size={16} />
              Localização exibida somente quando enviada pela API.
            </div>
            {canMove && (
              <label className="field">
                <span>Transferir para</span>
                <select
                  aria-label="Transferir técnico"
                  defaultValue=""
                  onChange={(e) =>
                    e.target.value &&
                    setConfirmMove({
                      order: selected,
                      destination: e.target.value,
                    })
                  }
                >
                  <option value="">Selecione um técnico</option>
                  {technicians
                    .filter((t) => t !== selected.tecnico)
                    .map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                </select>
              </label>
            )}
          </section>
        </div>
      )}
      {popup && (aba === "tecnica" || aba === "instalacao") && (
        <AgendaInterativa
          key={JSON.stringify(popup)}
          popup={popup}
          instalacao={isInstallation}
          onClose={() => setPopup(null)}
          onOpen={setPopup}
          onChanged={() => {
            void query.invalidateQueries({ queryKey: [service] });
            void query.invalidateQueries({ queryKey: ["agenda"] });
            avisarMudancaAgenda();
          }}
        />
      )}
      {manageOpen && (aba === "tecnica" || aba === "instalacao") && (
        <GerenciarAgenda
          service={service}
          date={date}
          installation={isInstallation}
          technicians={manageTechs}
          onClose={() => setManageOpen(false)}
        />
      )}
      {confirmMove && (
        <div className="modal-backdrop">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar transferência"
          >
            <span className="confirm-icon">
              <ArrowRightLeft size={20} />
            </span>
            <h2>Transferir atendimento?</h2>
            <p>
              OS{" "}
              {String(confirmMove.order.idOrdemServico || confirmMove.order.id)}
              : {confirmMove.order.tecnico} → {confirmMove.destination}
            </p>
            <p>A alteração será enviada ao servidor e ao SGP.</p>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="confirm-actions">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setConfirmMove(null)}
              >
                Cancelar
              </Button>
              <Button disabled={pending} onClick={transfer}>
                {pending ? "Transferindo…" : "Confirmar transferência"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
    </>
  );
}

const HORA_INICIO = 8;
const HORA_FIM = 23;
const EQUIPE_COR: Record<string, string> = {
  azul: "#2f6bff",
  verde: "#17b26a",
  roxo: "#8b5cf6",
  laranja: "#f97316",
  vermelho: "#e5484d",
  cinza: "#64748b",
};
const AUSENCIA_LABEL: Record<string, string> = {
  folga: "Folga",
  ferias: "Férias",
  medico: "Médico",
  atestado: "Atestado",
  mecanico: "Mecânico",
  duplado: "Duplado",
  outro: "Ausência",
};
const ausenciaLabel = (m: string) => AUSENCIA_LABEL[m] || (m ? m[0].toUpperCase() + m.slice(1) : "Ausência");
const plain = (s?: unknown) =>
  String(s || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
/** Mesma regra da agenda original (getAgendaStatusNumero). */
function statusNumero(status?: string) {
  const t = plain(status);
  if (/finaliz|encerr|conclu|fechad/.test(t)) return 1;
  if (/execucao|andamento|running|check-?in/.test(t)) return 2;
  if (/abert|pendente/.test(t)) return 0;
  return 3;
}
function siglaPop(pop?: unknown) {
  const p = plain(pop);
  if (!p) return "";
  if (p.includes("francisco morato")) return "FMO";
  if (p.includes("franco da rocha")) return "FCO";
  if (p.includes("caieiras")) return "CAI";
  if (p.includes("laranjeiras") || p.includes("laranjeias")) return "LRJ";
  return String(pop).slice(0, 3).toUpperCase();
}
function motivoEspecial(m?: unknown) {
  const t = plain(m);
  if (t.includes("procon")) return "PROCON";
  if (t.includes("anatel")) return "ANATEL";
  if (t.includes("reclame aqui")) return "RECLAME AQUI";
  return null;
}
function classeVisual(o: WorkOrder) {
  const n = statusNumero(o.status);
  const cliente = plain(o.cliente),
    pop = plain(o.pop);
  const iracema = cliente.startsWith("pop iracema") || pop.includes("iracema") || cliente.includes("iracema");
  const isPop = iracema || cliente.startsWith("pop") || pop.startsWith("pop");
  if (isPop && (n === 1 || n === 2)) return `is-${n} is-pop`;
  if (iracema) return "is-4 is-pop";
  if (isPop) return "is-5 is-pop";
  return `is-${n}`;
}
function EventChip({
  order: o,
  day,
  canMove,
  onOpen,
}: {
  order: WorkOrder & { date: string };
  day: string;
  canMove: boolean;
  onOpen: () => void;
}) {
  const especial = motivoEspecial(o.motivo);
  const sigla = siglaPop(o.pop);
  const pop = classeVisual(o).includes("is-pop");
  return (
    <button
      type="button"
      className={`tg-event work-order ${classeVisual(o)} ${especial ? "has-especial" : ""}`}
      data-tone={orderTone(o.status)}
      draggable={canMove && !!(o.idOrdemServico || o.id)}
      onDragStart={(e) =>
        e.dataTransfer.setData(
          "application/acessa-os",
          JSON.stringify({ id: String(o.idOrdemServico || o.id), date: day }),
        )
      }
      onClick={onOpen}
      title={[
        o.cliente,
        o.idCliente ? `ID: ${o.idCliente}` : "",
        o.pop ? `Pop: ${o.pop}` : "",
        o.bairro ? `Bairro: ${o.bairro}` : "",
        o.status ? `Status: ${o.status}` : "",
        o.motivo ? `Motivo: ${o.motivo}` : "",
        o.hora ? `Horário: ${o.hora}` : "",
      ]
        .filter(Boolean)
        .join("\n")}
    >
      <span className="tg-cliente">{o.cliente || "Cliente sem nome"}</span>
      {!pop && (sigla || especial) ? (
        <span className="tg-tags">
          {sigla ? <span className="tg-pop">{sigla}</span> : null}
          {especial ? <span className="tg-especial">{especial}</span> : null}
        </span>
      ) : null}
    </button>
  );
}
