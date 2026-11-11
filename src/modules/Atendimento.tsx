import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Headset, Lock, MessageSquarePlus, RefreshCw, Search, Send, PhoneCall, UserCheck, UserRound, XCircle, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "../components/ui/button";
import { api, errorMessage } from "../services/api";
import { useTelefoneAtendimento } from "./atendimento/telefone";
import Ficha360 from "./atendimento/Ficha360";
import Supervisao from "./atendimento/Supervisao";
import Relatorios from "./atendimento/Relatorios";
import Configuracoes from "./atendimento/Configuracoes";
import { chamar, duracao, msgErro, type Cargo } from "./atendimento/chamar";
import "../styles/atendimento.css";

type Status = "new" | "open" | "waiting_customer" | "waiting_agent" | "closed";
interface Conversa {
  id: number; customerId: string; contractId: string; ticketId: string; assignedAgentId: number | null; status: Status;
  createdAt: string; updatedAt: string; closedAt: string | null; tags?: string[];
  ticketMetadata?: { customer?: { name?: string; phone?: string }; contract?: { planName?: string; city?: string }; ticket?: { title?: string } } | null;
}
interface Mensagem { id: number; conversationId: number; clientMessageId?: string; senderType: "customer" | "agent" | "system"; senderId: string; message: string; createdAt: string; readAt: string | null }
interface Resposta { id: number; shortcut: string; title: string; body: string }
interface ChamadoAberto { ticketId: string | null; contractId: string | null; protocol: string | null; customerName: string | null; title: string; openedAt: string; status: string; statusLabel: string }
type Sla = { conversationId: number; sectorId: number | null; state: "none" | "ok" | "warning" | "breached"; kind: string | null; waitingSeconds: number; targetSeconds: number | null };
interface ConfigOps { sectors: { id: number; slug: string; name: string; active: boolean; mine: boolean }[]; open: boolean }
type Agente = { id: number; name: string; email: string; role: string };

const FILTROS: { id: string; nome: string }[] = [
  { id: "new", nome: "Novas" }, { id: "mine", nome: "Minhas" }, { id: "open", nome: "Abertas" },
  { id: "waiting_agent", nome: "Aguardando eu" }, { id: "waiting_customer", nome: "Aguardando cliente" }, { id: "closed", nome: "Encerradas" },
];
const MOTIVOS: { id: string; nome: string }[] = [
  { id: "resolved", nome: "Resolvido" }, { id: "no_customer_response", nome: "Cliente não respondeu" },
  { id: "sent_to_technician", nome: "Enviado ao técnico" }, { id: "duplicate", nome: "Duplicado" }, { id: "other", nome: "Outro" },
];
const ROTULO: Record<Status, string> = { new: "Nova", open: "Aberta", waiting_customer: "Aguarda cliente", waiting_agent: "Aguarda atendente", closed: "Encerrada" };
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const quando = (iso: string) => { const d = new Date(iso); return d.toDateString() === new Date().toDateString() ? hora(iso) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
const nomeDe = (c: Conversa) => c.ticketMetadata?.customer?.name || `Cliente ${c.customerId}`;
/** Atendimento por chat com os clientes da Central do assinante (chat-api). Tokens e tempo real ficam no processo principal. */
export default function Atendimento({ active }: { active: boolean }) {
  const [fase, setFase] = useState<"entrando" | "ok" | "erro">("entrando");
  const [erroLogin, setErroLogin] = useState("");
  const [agente, setAgente] = useState<Agente | null>(null);
  const [statusAtd, setStatusAtd] = useState<"AVAILABLE" | "INVISIBLE" | null>(null);
  const [conectado, setConectado] = useState(false);
  const [fichaAberta, setFichaAberta] = useState(true);
  const [aba, setAba] = useState<"conversas" | "chamados" | "supervisao" | "relatorios" | "config">("conversas");
  const [setorFiltro, setSetorFiltro] = useState<number | "meus" | "todos">("meus");
  const [filtro, setFiltro] = useState("new");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Conversa[]>([]);
  const [sla, setSla] = useState<Record<number, Sla>>({});
  const [cfgOps, setCfgOps] = useState<ConfigOps | null>(null);
  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [naoLidas, setNaoLidas] = useState<Record<number, number>>({});
  const [digitando, setDigitando] = useState(false);
  const [encerrando, setEncerrando] = useState<{ motivo: string; nota: string } | null>(null);
  const selRef = useRef<number | null>(null);
  const filtroRef = useRef(filtro);
  const fim = useRef<HTMLDivElement>(null);
  selRef.current = selecionada; filtroRef.current = filtro;

  const entrar = useCallback(async () => {
    setFase("entrando"); setErroLogin("");
    try { const r = await window.desktop!.atendimentoEntrar!(); setAgente(r.agente); setFase("ok");
      void chamar<{ agent: { attendanceStatus?: "AVAILABLE" | "INVISIBLE" } }>("GET", "/api/agent/auth/me").then((m) => setStatusAtd(m.agent.attendanceStatus ?? "AVAILABLE")).catch(() => setStatusAtd("AVAILABLE")); }
    catch (e) { setErroLogin(msgErro(e)); setFase("erro"); }
  }, []);
  useEffect(() => { if (window.desktop?.atendimentoEntrar) void entrar(); }, [entrar]);

  const carregarLista = useCallback(async () => {
    try {
      const r = await chamar<{ items: Conversa[] }>("GET", "/api/agent/conversations", { query: { filter: filtroRef.current, limit: "100", ...(busca.trim() ? { search: busca.trim() } : {}) } });
      setLista(r.items);
      // SLA e setor de cada conversa visível (uma chamada só); falha aqui não impede a fila.
      void chamar<{ items: Sla[] }>("GET", "/api/agent/ops/sla", { query: { ids: r.items.map((c) => c.id).slice(0, 100).join(",") } })
        .then((x) => setSla(Object.fromEntries(x.items.map((i) => [i.conversationId, i])))).catch(() => undefined);
      void window.desktop!.atendimentoEntrarNas!({ ids: r.items.map((c) => c.id) });
    } catch (e) { setErro(msgErro(e)); }
  }, [busca]);
  useEffect(() => { if (fase === "ok") void carregarLista(); }, [fase, filtro, carregarLista]);
  useEffect(() => {
    if (fase !== "ok") return;
    void chamar<ConfigOps>("GET", "/api/agent/ops/config").then(setCfgOps).catch(() => undefined);
  }, [fase]);
  // O SLA anda com o tempo: reconsulta a cada 20 s enquanto a fila está aberta.
  useEffect(() => {
    if (fase !== "ok" || aba !== "conversas") return;
    const t = window.setInterval(() => void carregarLista(), 20_000);
    return () => window.clearInterval(t);
  }, [fase, aba, carregarLista]);
  useEffect(() => {
    if (fase !== "ok") return;
    void chamar<{ items?: Resposta[]; quickReplies?: Resposta[] }>("GET", "/api/agent/quick-replies").then((r) => setRespostas(r.items ?? r.quickReplies ?? [])).catch(() => undefined);
  }, [fase]);

  const abrir = useCallback(async (id: number) => {
    setSelecionada(id); setErro(""); setMsgs([]); setEncerrando(null);
    try {
      const r = await chamar<{ items: Mensagem[] }>("GET", `/api/agent/conversations/${id}/messages`, { query: { limit: "100" } });
      setMsgs(r.items);
      setNaoLidas((n) => ({ ...n, [id]: 0 }));
      void chamar("POST", `/api/agent/conversations/${id}/read`).catch(() => undefined);
    } catch (e) { setErro(msgErro(e)); }
  }, []);

  // Tempo real: mensagens novas e mudanças nas conversas.
  useEffect(() => {
    const sair1 = window.desktop?.onAtendimento?.("atendimento:estado", (e) => { setConectado(!!e.conectado); if (e.erro) { setErroLogin(e.erro); setFase("erro"); } });
    const sair2 = window.desktop?.onAtendimento?.("atendimento:evento", ({ tipo, dados }) => {
      if (tipo === "new_message") {
        const m: Mensagem = dados.message;
        if (m.conversationId === selRef.current) {
          setMsgs((a) => (a.some((x) => x.id === m.id) ? a : [...a, m]));
          if (m.senderType === "customer") void chamar("POST", `/api/agent/conversations/${m.conversationId}/read`).catch(() => undefined);
        } else if (m.senderType === "customer") setNaoLidas((n) => ({ ...n, [m.conversationId]: (n[m.conversationId] ?? 0) + 1 }));
        void carregarLista();
      } else if (tipo === "typing") {
        if (dados.conversationId === selRef.current && dados.userType === "customer") setDigitando(!!dados.isTyping);
      } else if (String(tipo).startsWith("conversation_")) {
        const c: Conversa | undefined = dados.conversation;
        if (c && c.id === selRef.current) setLista((l) => l.map((x) => (x.id === c.id ? { ...x, ...c } : x)));
        void carregarLista();
      }
    });
    return () => { sair1?.(); sair2?.(); };
  }, [carregarLista]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [msgs, selecionada]);

  // Chamados abertos pela Central do assinante (lista do site, via Chat Interno): quem ainda não tem conversa.
  const chamados = useQuery({
    queryKey: ["atendimento", "chamados-abertos"],
    enabled: fase === "ok" && aba === "chamados",
    refetchInterval: 60_000,
    queryFn: async () => {
      const partes = await Promise.all(["open", "scheduled", "in_progress"].map(async (status) =>
        (await api.get<{ items: ChamadoAberto[] }>("/chamados/site", { params: { period: "30d", limit: 100, status } })).data.items));
      const vistos = new Set<string>();
      return partes.flat().filter((c) => c.ticketId && c.contractId && !vistos.has(c.ticketId) && !!vistos.add(c.ticketId))
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    },
  });
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [avisoAbrir, setAvisoAbrir] = useState("");
  const abrirAtendimento = async (c: ChamadoAberto) => {
    if (!c.ticketId || !c.contractId) return;
    if (!window.confirm(`Abrir atendimento com ${c.customerName || "este cliente"}? O cliente passa a ver o chat na Central do assinante.`)) return;
    setAbrindo(c.ticketId); setAvisoAbrir("");
    try {
      const r = await chamar<{ conversation: Conversa; created: boolean }>("POST", "/api/agent/conversations/start-from-ticket", { body: { contractId: c.contractId, ticketId: c.ticketId } });
      setAba("conversas"); setFiltro("mine");
      await abrir(r.conversation.id);
      setAvisoAbrir(r.created ? "" : "Este cliente já tinha uma conversa ativa; ela foi aberta.");
    } catch (e) { setAvisoAbrir(msgErro(e)); }
    finally { setAbrindo(null); }
  };

  const cargo = (agente?.role ?? "agent") as Cargo;
  const ehSupervisor = cargo === "supervisor" || cargo === "admin";
  const setorNome = (id: number | null | undefined) => cfgOps?.sectors.find((x) => x.id === id)?.name ?? "";
  const visiveis = useMemo(() => lista.filter((c) => {
    if (setorFiltro === "todos") return true;
    const setorId = sla[c.id]?.sectorId ?? null;
    if (setorFiltro === "meus") { const meus = cfgOps?.sectors.filter((x) => x.mine).map((x) => x.id); return !meus || !setorId || meus.includes(setorId); }
    return setorId === setorFiltro;
  }), [lista, sla, setorFiltro, cfgOps]);
  const moverSetor = (sectorId: number) => atual && acao(async () => { await chamar("PUT", `/api/agent/ops/conversations/${atual.id}/sector`, { body: { sectorId } }); });

  const atual = useMemo(() => lista.find((c) => c.id === selecionada) ?? null, [lista, selecionada]);
  const tel = useTelefoneAtendimento(atual, statusAtd);
  const minha = !!atual && !!agente && atual.assignedAgentId === agente.id;
  const encerrada = atual?.status === "closed";
  const novasTotal = Object.values(naoLidas).reduce((a, b) => a + b, 0);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !atual) return;
    setTexto("");
    try {
      const r = await chamar<{ message: Mensagem }>("POST", `/api/agent/conversations/${atual.id}/messages`, { body: { message: t, clientMessageId: crypto.randomUUID() } });
      setMsgs((a) => (a.some((x) => x.id === r.message.id) ? a : [...a, r.message]));
      void window.desktop!.atendimentoDigitando!({ conversationId: atual.id, ligado: false });
    } catch (e) { setTexto(t); setErro(msgErro(e)); }
  };
  const acao = async (f: () => Promise<unknown>) => { try { setErro(""); await f(); await carregarLista(); } catch (e) { setErro(msgErro(e)); } };
  const assumir = () => atual && acao(() => chamar("POST", `/api/agent/conversations/${atual.id}/assign`));
  const encerrar = () => atual && encerrando && acao(async () => { await chamar("PATCH", `/api/agent/conversations/${atual.id}/status`, { body: { status: "closed", closeReason: encerrando.motivo, ...(encerrando.nota.trim() ? { closeReasonNote: encerrando.nota.trim() } : {}) } }); setEncerrando(null); });
  const reabrir = () => atual && acao(() => chamar("POST", `/api/agent/conversations/${atual.id}/reopen`));
  const aoDigitar = (v: string) => {
    setTexto(v);
    if (atual && minha) void window.desktop!.atendimentoDigitando!({ conversationId: atual.id, ligado: v.length > 0 });
    // Atalho "/" abre as respostas rápidas pelo comando digitado (ex.: /boleto).
    const m = /^\/(\S+)$/.exec(v);
    const r = m && respostas.find((x) => x.shortcut.replace(/^\//, "") === m[1]);
    if (r) setTexto(r.body);
  };

  if (!window.desktop?.atendimentoEntrar) return <div className="atd-vazio"><Headset size={28} /><p>O Atendimento só funciona no aplicativo do Workspace para Windows.</p></div>;
  if (fase !== "ok")
    return (
      <div className="atd-vazio" role="status">
        {fase === "entrando" ? <><RefreshCw size={26} className="atd-gira" /><p>Entrando no atendimento…</p></> : (
          <><Lock size={28} /><p>{erroLogin || "Não foi possível entrar no atendimento."}</p><Button onClick={() => void entrar()}><RefreshCw size={14} />Tentar de novo</Button></>
        )}
      </div>
    );

  return (
    <div className={clsx("atd-raiz", !active && "atd-oculto")}>
      <nav className="atd-abas" role="tablist" aria-label="Atendimento">
        <button type="button" role="tab" aria-selected={aba === "conversas"} className={clsx(aba === "conversas" && "ativa")} onClick={() => setAba("conversas")}>Conversas{novasTotal ? <i className="atd-badge">{novasTotal}</i> : null}</button>
        <button type="button" role="tab" aria-selected={aba === "chamados"} className={clsx(aba === "chamados" && "ativa")} onClick={() => setAba("chamados")}>Chamados abertos</button>
        {ehSupervisor ? <button type="button" role="tab" aria-selected={aba === "supervisao"} className={clsx(aba === "supervisao" && "ativa")} onClick={() => setAba("supervisao")}>Supervisão</button> : null}
        {ehSupervisor ? <button type="button" role="tab" aria-selected={aba === "relatorios"} className={clsx(aba === "relatorios" && "ativa")} onClick={() => setAba("relatorios")}>Relatórios</button> : null}
        {cargo === "admin" ? <button type="button" role="tab" aria-selected={aba === "config"} className={clsx(aba === "config" && "ativa")} onClick={() => setAba("config")}>Configurações</button> : null}
        {cfgOps && !cfgOps.open ? <span className="atd-fora" title="O relógio do SLA está parado">Fora do expediente</span> : null}
      </nav>
      {avisoAbrir ? <p className="term-erro" role="alert">{avisoAbrir}</p> : null}
      {aba === "supervisao" && ehSupervisor ? <Supervisao aoAbrir={(id) => { setAba("conversas"); setFiltro("open"); setSetorFiltro("todos"); void abrir(id); }} /> : null}
      {aba === "relatorios" && ehSupervisor ? <Relatorios /> : null}
      {aba === "config" && cargo === "admin" ? <Configuracoes /> : null}
      {aba === "chamados" ? (
        <div className="atd-chamados">
          <div className="atd-chamados-topo">
            <p className="muted">Clientes com chamado aberto pela Central do assinante. “Abrir atendimento” inicia a conversa e o cliente passa a ver o chat.</p>
            <Button size="sm" variant="outline" onClick={() => void chamados.refetch()}><RefreshCw size={14} />Atualizar</Button>
          </div>
          {chamados.isError ? <p className="term-erro" role="alert">{errorMessage(chamados.error)}</p> : null}
          {chamados.isLoading ? <p className="muted">Carregando…</p> : null}
          {chamados.data && !chamados.data.length ? <p className="muted">Nenhum chamado aberto agora.</p> : null}
          <ul className="atd-chamados-lista">
            {(chamados.data ?? []).map((c) => (
              <li key={c.ticketId}>
                <div><b>{c.customerName || "Cliente sem nome"}</b><small>{c.title} · {c.protocol ? `#${c.protocol} · ` : ""}aberto em {new Date(c.openedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {c.statusLabel}</small></div>
                <Button size="sm" disabled={abrindo === c.ticketId} onClick={() => void abrirAtendimento(c)}><MessageSquarePlus size={14} />{abrindo === c.ticketId ? "Abrindo…" : "Abrir atendimento"}</Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    <div className="atd" hidden={aba !== "conversas"}>
      <aside className="atd-lista">
        <div className="atd-topo">
          <label className="atd-busca"><Search size={15} /><input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void carregarLista()} placeholder="Buscar cliente ou protocolo" aria-label="Buscar conversa" /></label>
          <span className={clsx("atd-ponto", conectado && "on")} title={conectado ? "Tempo real conectado" : "Reconectando…"} />
        </div>
        <div className="atd-filtros" role="tablist">
          {FILTROS.map((f) => <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} className={clsx(filtro === f.id && "ativa")} onClick={() => setFiltro(f.id)}>{f.nome}</button>)}
        </div>
        {cfgOps ? (
          <div className="atd-setores">
            <select aria-label="Setor" value={String(setorFiltro)} onChange={(e) => setSetorFiltro(e.target.value === "meus" || e.target.value === "todos" ? e.target.value : Number(e.target.value))}>
              <option value="meus">Meus setores</option>
              <option value="todos">Todos os setores</option>
              {cfgOps.sectors.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        ) : null}
        <div className="atd-itens">
          {!visiveis.length ? <p className="muted atd-dica">Nenhuma conversa neste filtro.</p> : null}
          {visiveis.map((c) => (
            <button key={c.id} type="button" className={clsx("atd-item", c.id === selecionada && "ativa")} onClick={() => void abrir(c.id)}>
              <span className="atd-item-linha"><b>{nomeDe(c)}</b><small>{quando(c.updatedAt)}</small></span>
              <span className="atd-item-linha"><small className="atd-sub">{c.ticketMetadata?.ticket?.title || `Chamado ${c.ticketId}`}</small>
                {naoLidas[c.id] ? <i className="atd-badge">{naoLidas[c.id]}</i> : <em className={`atd-st ${c.status}`}>{ROTULO[c.status]}</em>}</span>
              {sla[c.id] && sla[c.id]!.state !== "none" ? <span className="atd-item-linha"><small>{setorNome(sla[c.id]!.sectorId)}</small><span className={`atd-sla ${sla[c.id]!.state}`} title={sla[c.id]!.kind === "first_response" ? "Esperando a primeira resposta" : "Esperando resposta"}>{duracao(sla[c.id]!.waitingSeconds)}{sla[c.id]!.state === "breached" ? " ⚠" : ""}</span></span> : sla[c.id] ? <span className="atd-item-linha"><small>{setorNome(sla[c.id]!.sectorId)}</small></span> : null}
            </button>
          ))}
        </div>
        {novasTotal ? <div className="atd-rodape">{novasTotal} mensagem(ns) não lida(s)</div> : null}
      </aside>
      <section className="atd-conversa">
        {!atual ? <div className="atd-vazio"><Headset size={30} /><p>Escolha uma conversa na lista.</p></div> : (
          <>
            <header className="atd-cab">
              <div><b>{nomeDe(atual)}</b><small>{[atual.ticketMetadata?.contract?.planName, atual.ticketMetadata?.contract?.city, `Chamado ${atual.ticketId}`].filter(Boolean).join(" · ")}</small></div>
              <div className="atd-acoes">
                {!atual.assignedAgentId && !encerrada ? <Button size="sm" onClick={() => void assumir()}><UserCheck size={14} />Assumir</Button> : null}
                {minha && !encerrada ? <Button size="sm" variant="outline" onClick={() => setEncerrando({ motivo: "resolved", nota: "" })}><XCircle size={14} />Encerrar</Button> : null}
                {encerrada ? <Button size="sm" variant="outline" onClick={() => void reabrir()}><RotateCcw size={14} />Reabrir</Button> : null}
                {cfgOps && !encerrada ? (
                  <select aria-label="Mover para o setor" value={sla[atual.id]?.sectorId ?? ""} onChange={(e) => void moverSetor(Number(e.target.value))} title="Mover a conversa para outro setor">
                    {cfgOps.sectors.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                ) : null}
                {tel.numeros.length ? (
                  <Button size="sm" variant="outline" disabled={!tel.podeLigar} onClick={() => tel.ligar(tel.numeros[0]!)} title={tel.podeLigar ? `Ligar para ${tel.numeros[0]}` : tel.emLigacao ? "Você já está em uma ligação" : "Telefone desconectado"}><PhoneCall size={14} />Ligar</Button>
                ) : null}
                <Button size="sm" variant="outline" aria-pressed={fichaAberta} onClick={() => setFichaAberta((v) => !v)} title="Mostra ou esconde a ficha do cliente"><UserRound size={14} />Ficha</Button>
              </div>
            </header>
            {erro ? <p className="term-erro" role="alert">{erro}</p> : null}
            {tel.chamadaDoCliente ? <div className="atd-ligacao" role="status"><PhoneCall size={14} /> {tel.chamadaDoCliente.estado === "conversando" ? "Em ligação com este cliente" : tel.chamadaDoCliente.estado === "tocando" ? "Este cliente está ligando" : "Ligando para este cliente"}</div> : null}
            <div className="atd-msgs">
              {msgs.map((m) => (
                <div key={m.id} className={clsx("atd-msg", m.senderType)}>
                  <p>{m.message}</p><small>{hora(m.createdAt)}</small>
                </div>
              ))}
              {digitando ? <div className="atd-msg customer atd-digitando">digitando…</div> : null}
              <div ref={fim} />
            </div>
            {encerrada ? <div className="atd-aviso">Conversa encerrada.</div> : !minha ? <div className="atd-aviso">{atual.assignedAgentId ? "Esta conversa é de outro atendente." : "Assuma a conversa para responder."}</div> : (
              <form className="atd-compor" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
                <textarea value={texto} onChange={(e) => aoDigitar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }} placeholder="Escreva a resposta… (digite / para respostas rápidas)" rows={2} maxLength={4000} />
                <div className="atd-compor-acoes">
                  <select aria-label="Respostas rápidas" value="" onChange={(e) => { const r = respostas.find((x) => String(x.id) === e.target.value); if (r) setTexto((t) => (t ? `${t} ${r.body}` : r.body)); }}>
                    <option value="">⚡ Respostas rápidas</option>
                    {respostas.map((r) => <option key={r.id} value={r.id}>{r.shortcut} · {r.title}</option>)}
                  </select>
                  <Button type="submit" size="sm" disabled={!texto.trim()}><Send size={14} />Enviar</Button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
      {atual && fichaAberta ? <Ficha360 contrato={atual.contractId} /> : null}
      {encerrando ? (
        <div className="term-modal" role="dialog" aria-modal="true" aria-label="Encerrar conversa">
          <form className="term-form" onSubmit={(e) => { e.preventDefault(); void encerrar(); }}>
            <h3>Encerrar conversa</h3>
            <label>Motivo<select value={encerrando.motivo} onChange={(e) => setEncerrando({ ...encerrando, motivo: e.target.value })}>{MOTIVOS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
            <label>Observação{encerrando.motivo === "other" ? " (obrigatória)" : " (opcional)"}<input value={encerrando.nota} maxLength={1000} onChange={(e) => setEncerrando({ ...encerrando, nota: e.target.value })} /></label>
            <div className="term-form-acoes"><span /><span><Button type="button" variant="outline" onClick={() => setEncerrando(null)}>Cancelar</Button>{" "}<Button type="submit" disabled={encerrando.motivo === "other" && !encerrando.nota.trim()}>Encerrar</Button></span></div>
          </form>
        </div>
      ) : null}
    </div>
    </div>
  );
}
