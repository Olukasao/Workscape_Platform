import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Clock, Globe2, History, LayoutDashboard, Search, Waypoints } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "../components/ui/button";
import { EmptyState, Skeleton } from "../components/ui/primitives";
import { errorMessage } from "../services/api";
import {
  useBuscaBgp,
  useEstadoBgp,
  useHistoricoBgp,
  useMudancasBgp,
  usePeersBgp,
  useResumoBgp,
  type FiltroHistorico,
  type MudancaBgp,
} from "../services/rotasBgp";

const milhar = (n = 0) => n.toLocaleString("pt-BR");
const hora = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");
const dataHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
const diaTitulo = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const chaveDia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

function Caminho({ asns }: { asns: string[] }) {
  if (!asns?.length) return <span className="bgp-muted">—</span>;
  return (
    <span className="bgp-path" aria-label={`Caminho: ${asns.map((a) => `AS${a}`).join(", ")}`}>
      {asns.map((a, i) => (
        <span key={`${a}-${i}`} className={clsx("bgp-asn", i === asns.length - 1 && "is-origin")}>
          {i > 0 ? <ArrowRight size={10} aria-hidden="true" /> : null}AS{a}
        </span>
      ))}
    </span>
  );
}

function Evento({ m }: { m: MudancaBgp }) {
  const anunciada = m.event === "Advertised";
  return <span className={clsx("bgp-event", anunciada ? "is-up" : "is-down")}>{anunciada ? "Anunciada" : "Retirada"}</span>;
}

function LinhaMudanca({ m, comData = false }: { m: MudancaBgp; comData?: boolean }) {
  return (
    <li className="bgp-row">
      <time className="bgp-row-time">{comData ? dataHora(m.lastmodified) : hora(m.lastmodified)}</time>
      <strong className="bgp-row-prefix">{m.prefix}/{m.prefixlen}</strong>
      <Evento m={m} />
      <span className="bgp-row-origin">{m.origin_as ? `origem AS${m.origin_as}` : "sem origem"}</span>
      <Caminho asns={m.as_path} />
    </li>
  );
}

function Busca() {
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const busca = useBuscaBgp(q);
  const r = busca.data;
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setQ(texto.trim());
  };
  return (
    <section className="bgp-card bgp-search" aria-label="Buscar IP, prefixo ou ASN">
      <form onSubmit={enviar} className="bgp-search-form">
        <Search size={16} aria-hidden="true" />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar IP, prefixo ou ASN — ex.: 8.8.8.8, 187.52.38.0/24, AS15169" aria-label="IP, prefixo ou ASN" />
        <Button type="submit" disabled={texto.trim().length < 2}>Buscar</Button>
      </form>
      {busca.isFetching ? <Skeleton className="h-12" /> : null}
      {busca.isError ? <div className="inline-error" role="alert">{errorMessage(busca.error)}</div> : null}
      {r && !busca.isFetching ? (
        <div className="bgp-search-result">
          {r.disponivel === false ? (
            <p className="bgp-muted">O coletor de rotas não respondeu agora.</p>
          ) : r.kind === "asn" ? (
            <p><strong>AS{String(r.query).replace(/^AS/i, "")}</strong> · {r.name || "Nome não encontrado"}</p>
          ) : r.found && r.route ? (
            <>
              <p>
                <strong>{r.route.prefix}/{r.route.prefixlen}</strong> · origem AS{r.route.origin_as}{" "}
                <span className={clsx("bgp-event", r.route.iswithdrawn ? "is-down" : "is-up")}>{r.route.iswithdrawn ? "Retirada" : "Ativa"}</span>
              </p>
              <Caminho asns={r.route.as_path} />
              <p className="bgp-muted">Next-hop {r.route.nh} · peer {r.route.peername} · atualizada em {dataHora(r.route.lastmodified)}</p>
            </>
          ) : (
            <p className="bgp-muted">Nenhuma rota encontrada para essa busca.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function VisaoGeral() {
  const peers = usePeersBgp();
  const mudancas = useMudancasBgp();
  return (
    <div className="bgp-grid">
      <Busca />
      <section className="bgp-card" aria-labelledby="bgp-peers-t">
        <header className="bgp-card-head">
          <h2 id="bgp-peers-t"><Waypoints size={16} aria-hidden="true" /> Sessões BGP</h2>
          <span className="bgp-muted">{peers.data?.items ? `${peers.data.items.length} peers` : ""}</span>
        </header>
        {peers.isPending ? <Skeleton className="h-24" /> : null}
        {peers.data?.items?.length ? (
          <ul className="bgp-peers">
            {peers.data.items.map((p) => (
              <li key={p.peer_hash_id} className={clsx("bgp-peer", p.peer_state !== "up" && "is-down")}>
                <span className="bgp-dot" aria-hidden="true" />
                <div>
                  <strong>{p.as_name || p.peername}</strong>
                  <span>AS{p.peerasn} · {p.peerip}</span>
                </div>
                <em>{p.peer_state === "up" ? "No ar" : "Caiu"}</em>
              </li>
            ))}
          </ul>
        ) : peers.data && !peers.isPending ? <p className="bgp-muted">Nenhuma sessão encontrada.</p> : null}
      </section>
      <section className="bgp-card" aria-labelledby="bgp-feed-t">
        <header className="bgp-card-head">
          <h2 id="bgp-feed-t"><Clock size={16} aria-hidden="true" /> Agora na rede</h2>
          <span className="bgp-live"><i aria-hidden="true" />ao vivo</span>
        </header>
        {mudancas.isPending ? <Skeleton className="h-24" /> : null}
        {mudancas.data?.items?.length ? (
          <ul className="bgp-feed">{mudancas.data.items.slice(0, 20).map((m) => <LinhaMudanca key={m.id} m={m} />)}</ul>
        ) : mudancas.data && !mudancas.isPending ? <p className="bgp-muted">Nenhuma mudança recente.</p> : null}
      </section>
    </div>
  );
}

const PERIODOS = [
  { id: "1h", rotulo: "1 hora", ms: 3600_000 },
  { id: "24h", rotulo: "24 horas", ms: 86_400_000 },
  { id: "7d", rotulo: "7 dias", ms: 7 * 86_400_000 },
  { id: "30d", rotulo: "30 dias", ms: 30 * 86_400_000 },
  { id: "tudo", rotulo: "Tudo", ms: 0 },
] as const;

function MaquinaDoTempo() {
  const [prefixo, setPrefixo] = useState("");
  const [quando, setQuando] = useState("");
  const [alvo, setAlvo] = useState({ prefixo: "", ts: "" });
  const [erro, setErro] = useState("");
  const q = useEstadoBgp(alvo.prefixo, alvo.ts);

  function consultar(e: FormEvent) {
    e.preventDefault();
    const p = prefixo.trim();
    if (!/^[0-9a-fA-F:.]{2,45}\/\d{1,3}$/.test(p)) return setErro("Informe o prefixo com máscara, ex.: 187.52.38.0/24.");
    if (!quando) return setErro("Escolha a data e a hora.");
    setErro("");
    setAlvo({ prefixo: p, ts: new Date(quando).toISOString() });
  }

  return (
    <section className="bgp-card" aria-labelledby="bgp-tempo-t">
      <header className="bgp-card-head">
        <h2 id="bgp-tempo-t"><Clock size={16} aria-hidden="true" /> Como estava em…</h2>
        <span className="bgp-muted">O caminho de um prefixo numa data e hora passadas</span>
      </header>
      <form onSubmit={consultar} className="bgp-filters-row">
        <label className="bgp-search-form" style={{ flex: 1, minWidth: 220 }}>
          <Search size={16} aria-hidden="true" />
          <input value={prefixo} onChange={(e) => setPrefixo(e.target.value)} placeholder="Prefixo — ex.: 187.52.38.0/24" aria-label="Prefixo" />
        </label>
        <input className="bgp-datetime" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} aria-label="Data e hora" />
        <Button type="submit">Ver estado</Button>
      </form>
      {erro ? <div className="inline-error" role="alert">{erro}</div> : null}
      {q.isFetching ? <Skeleton className="h-12" /> : null}
      {q.isError ? <div className="inline-error" role="alert">{errorMessage(q.error)}</div> : null}
      {q.data && !q.isFetching ? (
        q.data.disponivel === false || q.data.error ? (
          <p className="bgp-muted">Não foi possível consultar agora. Tente de novo.</p>
        ) : !q.data.peers?.length ? (
          <p className="bgp-muted">Nenhuma rota registrada para {q.data.prefix} até {dataHora(q.data.timestamp)}.</p>
        ) : (
          <ul className="bgp-feed">
            {q.data.peers.map((p) => (
              <li key={p.peer_hash_id} className="bgp-row">
                <strong>{p.peer_name} · AS{p.peer_as}</strong>
                <span className={clsx("bgp-event", p.iswithdrawn ? "is-down" : "is-up")}>{p.iswithdrawn ? "Sem rota" : "Com rota"}</span>
                {p.as_path?.length ? <Caminho asns={p.as_path} /> : <span className="bgp-muted">{p.attrs_unknown ? "caminho desconhecido nessa data" : "sem caminho"}</span>}
                {p.next_hop ? <span className="bgp-muted">next-hop {p.next_hop}</span> : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

function Historico() {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["id"]>("24h");
  const [texto, setTexto] = useState("");
  const [evento, setEvento] = useState<"todos" | "Advertised" | "Withdrawn">("todos");
  const [aplicado, setAplicado] = useState({ texto: "", periodo: "24h" as string, em: Date.now() });
  const [erroFiltro, setErroFiltro] = useState("");

  const filtro: FiltroHistorico = useMemo(() => {
    const t = aplicado.texto.trim();
    const p = PERIODOS.find((x) => x.id === aplicado.periodo);
    return {
      prefix: t.includes("/") ? t : "",
      asn: /^(AS)?\d{1,10}$/i.test(t) ? t.replace(/^AS/i, "") : "",
      start: p && p.ms ? new Date(aplicado.em - p.ms).toISOString() : "",
      end: "",
    };
  }, [aplicado]);

  const q = useHistoricoBgp(filtro, true);

  function aplicar(e?: FormEvent) {
    e?.preventDefault();
    const t = texto.trim();
    if (t && !t.includes("/") && !/^(AS)?\d{1,10}$/i.test(t)) {
      setErroFiltro("Use um prefixo com máscara (ex.: 8.8.8.0/24) ou um ASN (ex.: AS15169). Para achar o prefixo de um IP, use a busca na Visão geral.");
      return;
    }
    setErroFiltro("");
    setAplicado({ texto: t, periodo, em: Date.now() });
  }

  const itens = useMemo(() => {
    const todos = (q.data?.pages ?? []).flatMap((p) => p.items ?? []);
    return evento === "todos" ? todos : todos.filter((m) => m.event === evento);
  }, [q.data, evento]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { titulo: string; itens: MudancaBgp[] }>();
    for (const m of itens) {
      const k = chaveDia(m.lastmodified);
      if (!mapa.has(k)) mapa.set(k, { titulo: diaTitulo(m.lastmodified), itens: [] });
      mapa.get(k)!.itens.push(m);
    }
    return [...mapa.values()];
  }, [itens]);

  const anunciadas = itens.filter((m) => m.event === "Advertised").length;
  const indisponivel = q.data?.pages.some((p) => p.disponivel === false);

  return (
    <div className="bgp-grid">
      <MaquinaDoTempo />
      <section className="bgp-card bgp-filters" aria-label="Filtros do histórico">
        <form onSubmit={aplicar} className="bgp-filters-form">
          <label className="bgp-search-form">
            <Search size={16} aria-hidden="true" />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Prefixo ou ASN (deixe vazio para ver tudo) — ex.: 8.8.8.0/24 ou AS15169" aria-label="Prefixo ou ASN" />
          </label>
          <div className="bgp-filters-row">
            <div className="segmented" role="group" aria-label="Período">
              {PERIODOS.map((p) => (
                <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => setPeriodo(p.id)}>{p.rotulo}</button>
              ))}
            </div>
            <div className="segmented" role="group" aria-label="Tipo de evento">
              {([["todos", "Todos"], ["Advertised", "Anunciadas"], ["Withdrawn", "Retiradas"]] as const).map(([id, rotulo]) => (
                <button key={id} type="button" aria-pressed={evento === id} onClick={() => setEvento(id)}>{rotulo}</button>
              ))}
            </div>
            <Button type="submit">Filtrar</Button>
          </div>
        </form>
        {erroFiltro ? <div className="inline-error" role="alert">{erroFiltro}</div> : null}
      </section>

      <section className="bgp-card" aria-label="Resultados do histórico" aria-busy={q.isFetching}>
        {q.isPending ? <Skeleton className="h-40" /> : null}
        {q.isError ? <div className="inline-error" role="alert">{errorMessage(q.error)}</div> : null}
        {indisponivel ? <EmptyState title="Coletor de rotas indisponível">Não consegui falar com a VM do OpenBMP agora.</EmptyState> : null}
        {q.data && !indisponivel ? (
          <>
            <header className="bgp-card-head">
              <h2><History size={16} aria-hidden="true" /> Linha do tempo</h2>
              <span className="bgp-muted">
                {milhar(itens.length)} eventos carregados · {milhar(anunciadas)} anunciadas · {milhar(itens.length - anunciadas)} retiradas
              </span>
            </header>
            {!itens.length ? (
              <p className="bgp-muted">Nenhum evento neste período{aplicado.texto ? " para essa busca" : ""}.</p>
            ) : (
              grupos.map((g) => (
                <div key={g.titulo} className="bgp-day">
                  <h3>{g.titulo}</h3>
                  <ul className="bgp-feed">{g.itens.map((m) => <LinhaMudanca key={m.id} m={m} />)}</ul>
                </div>
              ))
            )}
            {q.hasNextPage ? (
              <div className="bgp-more">
                <Button variant="outline" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                  {q.isFetchingNextPage ? "Carregando…" : "Carregar mais eventos"}
                </Button>
              </div>
            ) : itens.length ? <p className="bgp-muted bgp-end">Fim do histórico para este filtro.</p> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

export default function RotasBgp() {
  const resumo = useResumoBgp();
  const [aba, setAba] = useState<"geral" | "historico">("geral");
  const t = resumo.data?.totals;
  const fora = resumo.data && resumo.data.disponivel === false;
  const saudavel = !!t && t.peers_up === t.peers && t.routers_up === t.routers;

  return (
    <div className="page bgp-page">
      <header className={clsx("bgp-hero", t && !saudavel && "is-alert", fora && "is-off")}>
        <div className="bgp-hero-main">
          <span className="bgp-hero-icon" aria-hidden="true"><Globe2 size={22} strokeWidth={1.7} /></span>
          <div>
            <p className="bgp-eyebrow">Rotas · BGP</p>
            <h1>{fora ? "Coletor de rotas indisponível" : !t ? "Carregando a rede…" : saudavel ? "Todas as sessões no ar" : "Atenção: há sessões fora do ar"}</h1>
            <p className="bgp-hero-sub">
              {t ? `${t.peers_up} de ${t.peers} sessões · última rota às ${hora(t.last_update)}` : "Sessões e rotas vistas pelo roteador de borda (OpenBMP)."}
            </p>
          </div>
        </div>
        {t ? (
          <dl className="bgp-stats">
            <div><dt>Roteadores</dt><dd>{t.routers_up}/{t.routers}</dd></div>
            <div><dt>Sessões BGP</dt><dd>{t.peers_up}/{t.peers}</dd></div>
            <div><dt>Prefixos</dt><dd>{milhar(t.prefixes)}</dd></div>
            <div><dt>Updates/min</dt><dd>{milhar(t.updates_last_minute)}</dd></div>
          </dl>
        ) : resumo.isPending ? <Skeleton className="h-16" /> : null}
      </header>

      {resumo.isError ? <div className="inline-error" role="alert">{errorMessage(resumo.error)}</div> : null}

      <nav className="bgp-tabs" role="tablist" aria-label="Seções de Rotas BGP">
        <button role="tab" aria-selected={aba === "geral"} onClick={() => setAba("geral")}><LayoutDashboard size={15} aria-hidden="true" /> Visão geral</button>
        <button role="tab" aria-selected={aba === "historico"} onClick={() => setAba("historico")}><History size={15} aria-hidden="true" /> Histórico</button>
      </nav>

      {aba === "geral" ? <VisaoGeral /> : <Historico />}
    </div>
  );
}
