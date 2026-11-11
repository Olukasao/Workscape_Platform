import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, ChevronsLeft, ChevronsRight, Zap, CheckCheck, CheckCircle2, CornerDownLeft, Edit3, Inbox, MessageSquareText, PhoneCall, Search, UserCheck, UserRound } from "lucide-react";
import { usePreferences } from "../../stores/workspace";
import { MacroAdminDialog } from "./console/components/macros/MacroAdminDialog";
import { MacroExecutionModal } from "./console/components/macros/MacroExecutionModal";
import { MacroExecutionProgress } from "./console/components/macros/MacroExecutionProgress";
import { useMacroExecution, type MacroActionRunner } from "./console/hooks/useMacroExecution";
import { useMacros } from "./console/hooks/useMacros";
import type { Macro } from "./console/types/macro";
import { canManageMacros } from "./console/utils/security";
import { ChatPanel } from "./console/components/chat/ChatPanel";
import { CloseConversationDialog } from "./console/components/chat/CloseConversationDialog";
import { TransferDialog } from "./console/components/chat/TransferDialog";
import { normalizeConversation, normalizeConversationNote, normalizeMessage } from "./console/mappers";
import type { AgentOption, ConversationCloseReason, ConversationDetail, ConversationFilter, ConversationNote, ConversationStatus, ConversationSummary, ConversationTag, Message, QuickReply } from "./console/types/domain";
import { getCustomerWaitingSince } from "./console/utils/sla";
import Ficha360 from "./Ficha360";
import { chamar, duracao, msgErro, type Cargo } from "./chamar";
import { useTelefoneAtendimento } from "./telefone";
import "../../styles/atendimento-console.css";

type FiltroMesa = ConversationFilter | "closed";
export interface SlaItem { conversationId: number; sectorId: number | null; state: "none" | "ok" | "warning" | "breached"; kind: string | null; waitingSeconds: number }
export interface ConfigOps { sectors: { id: number; slug: string; name: string; active: boolean; mine: boolean }[]; open: boolean }
export interface AgenteAtd { id: number; name: string; email: string; role: string }

const RAIL: { id: FiltroMesa; rotulo: string; Icone: typeof Inbox }[] = [
  { id: "new", rotulo: "Novos tickets", Icone: MessageSquareText },
  { id: "mine", rotulo: "Meus atendimentos", Icone: Inbox },
  { id: "open", rotulo: "Em atendimento", Icone: Edit3 },
  { id: "waiting_customer", rotulo: "Aguardando cliente", Icone: CheckCheck },
  { id: "closed", rotulo: "Encerrados", Icone: CheckCircle2 },
  { id: "archived", rotulo: "Arquivados", Icone: CornerDownLeft },
];
const STATUS_ROTULO: Record<ConversationStatus, string> = { new: "novo", open: "em atendimento", waiting_customer: "aguardando cliente", waiting_agent: "aguardando atendente", closed: "encerrado" };
const lerPref = (chave: string, padrao: boolean) => { try { const v = window.localStorage.getItem(`workspace:atendimento:${chave}`); return v === null ? padrao : v === "1"; } catch { return padrao; } };
const gravarPref = (chave: string, valor: boolean) => { try { window.localStorage.setItem(`workspace:atendimento:${chave}`, valor ? "1" : "0"); } catch { /* sem armazenamento */ } };
const iniciais = (nome: string) => { const p = nome.trim().split(/\s+/).filter(Boolean); return `${p[0]?.[0] ?? "C"}${p.length > 1 ? p[p.length - 1]![0] : p[0]?.[1] ?? ""}`.toUpperCase(); };
const horaCurta = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
const itensDe = (r: unknown): unknown[] => { const o = r as { items?: unknown[]; notes?: unknown[] } | unknown[] | null; return Array.isArray(o) ? o : o?.items ?? o?.notes ?? []; };

interface Props {
  agente: AgenteAtd | null;
  cargo: Cargo;
  statusAtd: "AVAILABLE" | "INVISIBLE" | null;
  cfgOps: ConfigOps | null;
  visivel: boolean;
  /** Pedido para abrir uma conversa (vindo de "Chamados abertos" ou da Supervisão). O `n` muda a cada pedido. */
  abrir: { id: string; n: number } | null;
  aoMudarNaoLidas(total: number): void;
}

/** Mesa de atendimento: o mesmo layout e componentes do painel de atendimento, ligados aos dados e ao telefone do Workspace. */
export default function Mesa({ agente, cargo, statusAtd, cfgOps, visivel, abrir, aoMudarNaoLidas }: Props) {
  const tema = usePreferences((s) => s.theme) === "light" ? "claro" : "escuro";
  const [filtro, setFiltro] = useState<FiltroMesa>("new");
  const [busca, setBusca] = useState("");
  const [setorFiltro, setSetorFiltro] = useState<number | "meus" | "todos">("meus");
  const [lista, setLista] = useState<ConversationSummary[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [sla, setSla] = useState<Record<string, SlaItem>>({});
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<ConversationDetail | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [notas, setNotas] = useState<ConversationNote[]>([]);
  const [carregandoConversa, setCarregandoConversa] = useState(false);
  const [erroConversa, setErroConversa] = useState("");
  const [respostas, setRespostas] = useState<QuickReply[]>([]);
  const [naoLidas, setNaoLidas] = useState<Record<string, number>>({});
  const [digitando, setDigitando] = useState("");
  const [agora, setAgora] = useState(Date.now());
  // Barras laterais: a ficha, a lista de tickets (recolhe até sobrar só o trilho) e o trilho (ícones ou ícones com nomes).
  const [fichaAberta, setFichaAbertaEstado] = useState(() => lerPref("ficha", true));
  const [listaRecolhida, setListaRecolhidaEstado] = useState(() => lerPref("lista-recolhida", false));
  const [railAberto, setRailAbertoEstado] = useState(() => lerPref("rail-aberto", false));
  const setFichaAberta = (v: boolean | ((a: boolean) => boolean)) => setFichaAbertaEstado((a) => { const n = typeof v === "function" ? v(a) : v; gravarPref("ficha", n); return n; });
  const alternarLista = () => setListaRecolhidaEstado((a) => { gravarPref("lista-recolhida", !a); return !a; });
  const alternarRail = () => setRailAbertoEstado((a) => { gravarPref("rail-aberto", !a); return !a; });
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  const [atualizandoTags, setAtualizandoTags] = useState(false);
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [transferindo, setTransferindo] = useState<{ agentes: AgentOption[]; enviando: boolean } | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [aviso, setAviso] = useState("");
  const selRef = useRef<string | null>(null);
  const filtroRef = useRef<FiltroMesa>(filtro);
  const buscaRef = useRef(busca);
  const nomesAgentes = useRef<Record<string, string>>({});
  selRef.current = selecionada; filtroRef.current = filtro; buscaRef.current = busca;

  useEffect(() => { const t = window.setInterval(() => setAgora(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  useEffect(() => { aoMudarNaoLidas(Object.values(naoLidas).reduce((a, b) => a + b, 0)); }, [naoLidas, aoMudarNaoLidas]);

  const nomeDoAutor = useCallback((m: Message, d: ConversationDetail | null): Message => {
    if (m.authorType === "system") return { ...m, authorName: "Sistema" };
    if (m.authorType === "customer") return { ...m, authorName: d?.customerName || "Cliente" };
    const id = String(m.senderId ?? "");
    return { ...m, authorName: id && String(agente?.id) === id ? agente?.name ?? "Atendente" : nomesAgentes.current[id] || (m.authorName && m.authorName !== "Atendente" ? m.authorName : "Atendente") };
  }, [agente]);

  const carregarLista = useCallback(async () => {
    try {
      const r = await chamar<{ items: unknown[] }>("GET", "/api/agent/conversations", { query: { filter: filtroRef.current, limit: "100", ...(buscaRef.current.trim() ? { search: buscaRef.current.trim() } : {}) } });
      const itens = r.items.map((i) => normalizeConversation(i));
      setLista(itens); setErroLista("");
      void window.desktop!.atendimentoEntrarNas!({ ids: itens.map((c) => Number(c.id)).filter(Boolean) });
      void chamar<{ items: SlaItem[] }>("GET", "/api/agent/ops/sla", { query: { ids: itens.slice(0, 100).map((c) => c.id).join(",") } })
        .then((x) => setSla(Object.fromEntries(x.items.map((i) => [String(i.conversationId), i])))).catch(() => undefined);
    } catch (e) { setErroLista(msgErro(e)); } finally { setCarregandoLista(false); }
  }, []);
  useEffect(() => { setCarregandoLista(true); void carregarLista(); }, [filtro, carregarLista]);
  useEffect(() => { const t = window.setTimeout(() => void carregarLista(), 350); return () => window.clearTimeout(t); }, [busca, carregarLista]);
  useEffect(() => { if (!visivel) return; const t = window.setInterval(() => void carregarLista(), 20_000); return () => window.clearInterval(t); }, [visivel, carregarLista]);
  useEffect(() => {
    void chamar<{ items?: unknown[]; quickReplies?: unknown[] }>("GET", "/api/agent/quick-replies")
      .then((r) => setRespostas(itensDe(r.items ?? r.quickReplies ?? []).map((q) => { const o = q as Record<string, unknown>; const now = new Date().toISOString(); return { id: String(o.id), shortcut: String(o.shortcut ?? ""), title: String(o.title ?? ""), body: String(o.body ?? ""), category: (o.category as string | null) ?? null, active: o.active !== false, createdAt: String(o.createdAt ?? now), updatedAt: String(o.updatedAt ?? now) }; })))
      .catch(() => undefined);
  }, []);

  const abrirConversa = useCallback(async (id: string) => {
    setSelecionada(id); setErroConversa(""); setMsgs([]); setNotas([]); setCarregandoConversa(true); setDigitando(""); setAviso("");
    try {
      const [d, m, n] = await Promise.all([
        chamar<unknown>("GET", `/api/agent/conversations/${id}`),
        chamar<unknown>("GET", `/api/agent/conversations/${id}/messages`, { query: { limit: "100" } }),
        chamar<unknown>("GET", `/api/agent/conversations/${id}/notes`).catch(() => ({ items: [] })),
      ]);
      const det = normalizeConversation(d);
      if (selRef.current !== id) return;
      setDetalhe(det);
      setMsgs(itensDe(m).map((x) => nomeDoAutor(normalizeMessage(x), det)));
      setNotas(itensDe(n).map((x) => normalizeConversationNote(x)));
      setNaoLidas((u) => ({ ...u, [id]: 0 }));
      void chamar("POST", `/api/agent/conversations/${id}/read`).catch(() => undefined);
    } catch (e) { setErroConversa(msgErro(e)); } finally { setCarregandoConversa(false); }
  }, [nomeDoAutor]);

  // Pedido externo para abrir uma conversa (Chamados abertos / Supervisão).
  useEffect(() => { if (abrir) { setFiltro("mine"); setSetorFiltro("todos"); void abrirConversa(abrir.id); } }, [abrir, abrirConversa]);

  // Tempo real.
  useEffect(() => window.desktop?.onAtendimento?.("atendimento:evento", ({ tipo, dados }) => {
    const sel = selRef.current;
    if (tipo === "new_message") {
      const bruta = normalizeMessage(dados.message);
      if (bruta.conversationId === sel) {
        setMsgs((atual) => { const m = nomeDoAutor(bruta, detalheRef.current); const sem = atual.filter((x) => x.id !== m.id && !(m.clientMessageId && x.clientMessageId === m.clientMessageId)); return [...sem, { ...m, status: m.authorType === "agent" ? "sent" : m.status }]; });
        if (bruta.authorType === "customer") void chamar("POST", `/api/agent/conversations/${sel}/read`).catch(() => undefined);
      } else if (bruta.authorType === "customer") setNaoLidas((u) => ({ ...u, [bruta.conversationId]: (u[bruta.conversationId] ?? 0) + 1 }));
      void carregarLista();
    } else if (tipo === "typing") {
      if (String(dados.conversationId) === sel && dados.userType === "customer") setDigitando(dados.isTyping ? "Cliente digitando…" : "");
    } else if (tipo === "note_added") {
      if (String(dados.note?.conversationId) === sel) setNotas((n) => (n.some((x) => x.id === String(dados.note.id)) ? n : [...n, normalizeConversationNote(dados.note)]));
    } else if (String(tipo).startsWith("conversation_")) {
      if (tipo === "conversation_deleted" && String(dados.conversationId) === sel) { setSelecionada(null); setDetalhe(null); }
      else if (dados.conversation && String(dados.conversation.id) === sel) setDetalhe((d) => (d ? { ...d, ...normalizeConversation(dados.conversation), customer: d.customer } : d));
      void carregarLista();
    }
  }), [carregarLista, nomeDoAutor]);
  const detalheRef = useRef<ConversationDetail | null>(null);
  detalheRef.current = detalhe;

  const tel = useTelefoneAtendimento(
    detalhe ? { id: Number(detalhe.id), contractId: detalhe.contractId ?? "", ticketMetadata: { customer: { phone: detalhe.customer?.phone } } } : null,
    statusAtd,
  );

  const minha = !!detalhe && !!agente && String(detalhe.assignedAgentId ?? "") === String(agente.id);
  const encerrada = detalhe?.status === "closed";
  const podeTransferir = cargo === "supervisor" || cargo === "admin";
  const executar = async (f: () => Promise<unknown>) => { try { setAviso(""); await f(); await carregarLista(); } catch (e) { setAviso(msgErro(e)); } };

  const enviar = async (corpo: string, reenvio?: Message) => {
    if (!detalhe || !agente) return;
    const clientMessageId = reenvio?.clientMessageId ?? crypto.randomUUID();
    const pendente: Message = { id: clientMessageId, clientMessageId, conversationId: detalhe.id, senderId: String(agente.id), authorType: "agent", authorName: agente.name, body: corpo, createdAt: new Date().toISOString(), status: "sending" };
    setMsgs((a) => [...a.filter((x) => x.clientMessageId !== clientMessageId), pendente]);
    try {
      const r = await chamar<{ message: unknown }>("POST", `/api/agent/conversations/${detalhe.id}/messages`, { body: { message: corpo, clientMessageId } });
      const m = nomeDoAutor(normalizeMessage(r.message), detalhe);
      setMsgs((a) => [...a.filter((x) => x.clientMessageId !== clientMessageId && x.id !== m.id), { ...m, status: "sent" }]);
      void window.desktop!.atendimentoDigitando!({ conversationId: Number(detalhe.id), ligado: false });
    } catch (e) { setMsgs((a) => a.map((x) => (x.clientMessageId === clientMessageId ? { ...x, status: "failed" } : x))); setAviso(msgErro(e)); }
  };
  const assumir = () => detalhe && executar(async () => { await chamar("POST", `/api/agent/conversations/${detalhe.id}/assign`); await abrirConversa(detalhe.id); });
  const mudarStatus = (status: ConversationStatus) => detalhe && executar(async () => { setAtualizandoStatus(true); try { await chamar("PATCH", `/api/agent/conversations/${detalhe.id}/status`, { body: { status } }); setDetalhe({ ...detalhe, status }); } finally { setAtualizandoStatus(false); } });
  const arquivar = (arquivar: boolean) => detalhe && executar(async () => { setAtualizandoStatus(true); try { await chamar("POST", `/api/agent/conversations/${detalhe.id}/${arquivar ? "archive" : "restore"}`); await abrirConversa(detalhe.id); } finally { setAtualizandoStatus(false); } });
  const mudarTags = (tags: ConversationTag[]) => detalhe && executar(async () => { setAtualizandoTags(true); try { await chamar("PATCH", `/api/agent/conversations/${detalhe.id}/tags`, { body: { tags } }); setDetalhe({ ...detalhe, tags }); } finally { setAtualizandoTags(false); } });
  const adicionarNota = (texto: string) => detalhe && executar(async () => { setSalvandoNota(true); try { const r = await chamar<{ note: unknown }>("POST", `/api/agent/conversations/${detalhe.id}/notes`, { body: { note: texto } }); const n = normalizeConversationNote(r.note ?? r); setNotas((x) => (x.some((y) => y.id === n.id) ? x : [...x, n])); } finally { setSalvandoNota(false); } });
  const abrirTransferencia = async () => {
    setTransferindo({ agentes: [], enviando: false });
    try {
      const r = await chamar<{ agents: Array<{ id: number; name: string; email: string; role: string; attendanceStatus?: string; status?: string }> }>("GET", "/api/agent/agents");
      const agentes: AgentOption[] = r.agents.filter((a) => a.status !== "disabled" && a.id !== agente?.id).map((a) => ({ id: String(a.id), name: a.name, email: a.email, role: a.role as AgentOption["role"], attendanceStatus: (a.attendanceStatus as AgentOption["attendanceStatus"]) ?? "AVAILABLE" }));
      agentes.forEach((a) => { nomesAgentes.current[a.id] = a.name; });
      setTransferindo({ agentes, enviando: false });
    } catch (e) { setTransferindo(null); setAviso(msgErro(e)); }
  };
  const transferir = async (agentId: string) => { if (!detalhe) return; setTransferindo((t) => (t ? { ...t, enviando: true } : t)); await executar(async () => { await chamar("POST", `/api/agent/conversations/${detalhe.id}/transfer`, { body: { agentId: Number(agentId) } }); await abrirConversa(detalhe.id); }); setTransferindo(null); };
  const encerrar = async (motivo: ConversationCloseReason, nota: string) => { if (!detalhe) return; await executar(async () => { await chamar("PATCH", `/api/agent/conversations/${detalhe.id}/status`, { body: { status: "closed", closeReason: motivo, ...(nota.trim() ? { closeReasonNote: nota.trim() } : {}) } }); await abrirConversa(detalhe.id); }); setEncerrando(false); };
  const moverSetor = (sectorId: number) => detalhe && executar(async () => { await chamar("PUT", `/api/agent/ops/conversations/${detalhe.id}/sector`, { body: { sectorId } }); });

  // Macros: o mesmo menu, confirmação e execução passo a passo do painel. As ações usam as rotas normais deste módulo.
  const { macros, loading: carregandoMacros, reload: recarregarMacros, recentMacros, favoriteIds, registerRecent } = useMacros();
  const [macroAdminAberta, setMacroAdminAberta] = useState(false);
  const [macroPendente, setMacroPendente] = useState<Macro | null>(null);
  const aplicarTags = async (tags: ConversationTag[]) => { if (!detalhe) return; await chamar("PATCH", `/api/agent/conversations/${detalhe.id}/tags`, { body: { tags } }); setDetalhe({ ...detalhe, tags }); };
  const executorMacro: MacroActionRunner = {
    getTags: () => detalhe?.tags ?? [],
    sendMessage: (texto) => { void enviar(texto); },
    updateTags: aplicarTags,
    async addNote(texto) { if (!detalhe || !texto.trim()) return; const r = await chamar<{ note: unknown }>("POST", `/api/agent/conversations/${detalhe.id}/notes`, { body: { note: texto.trim() } }); const n = normalizeConversationNote(r.note ?? r); setNotas((x) => (x.some((y) => y.id === n.id) ? x : [...x, n])); },
    async setPriority() { throw new Error("Definir prioridade ainda não é suportado neste servidor."); },
    async transferToAgent(agentId) { if (!detalhe) return; await chamar("POST", `/api/agent/conversations/${detalhe.id}/transfer`, { body: { agentId: Number(agentId) } }); await abrirConversa(detalhe.id); },
  };
  const execucaoMacro = useMacroExecution(executorMacro);
  const acionarMacro = (macro: Macro) => { registerRecent(macro.id); setMacroPendente(macro); };
  const confirmarMacro = () => { if (!macroPendente || !detalhe) return; const macro = macroPendente; setMacroPendente(null); void execucaoMacro.start(macro, detalhe); };
  const gerenciaMacros = canManageMacros(cargo);

  const visiveis = useMemo(() => lista.filter((c) => {
    if (setorFiltro === "todos") return true;
    const setorId = sla[c.id]?.sectorId ?? null;
    if (setorFiltro === "meus") { const meus = cfgOps?.sectors.filter((x) => x.mine).map((x) => x.id); return !meus || !setorId || meus.includes(setorId); }
    return setorId === setorFiltro;
  }), [lista, sla, setorFiltro, cfgOps]);
  const setorNome = (id: number | null | undefined) => cfgOps?.sectors.find((x) => x.id === id)?.name ?? "";

  return (
    <div className="atd-sc atd-mesa-raiz" data-tema={tema}>
      <section className={`attendance-desk-body atd-mesa${detalhe && fichaAberta ? " com-ficha" : ""}${railAberto ? " rail-aberto" : ""}${listaRecolhida ? " lista-recolhida" : ""}`}>
        <aside className="attendance-desk-ticket-shell" aria-label="Tickets">
          <nav className={`attendance-desk-rail${railAberto ? " expandida" : ""}`} aria-label="Filtros de atendimento">
            <button type="button" className="atd-rail-controle" aria-label={listaRecolhida ? "Mostrar a lista de tickets" : "Recolher a lista de tickets"} title={listaRecolhida ? "Mostrar a lista de tickets" : "Recolher a lista de tickets"} aria-pressed={!listaRecolhida} onClick={alternarLista}>
              {listaRecolhida ? <PanelLeftOpen size={17} aria-hidden /> : <PanelLeftClose size={17} aria-hidden />}
              {railAberto ? <i className="atd-rail-rotulo">{listaRecolhida ? "Mostrar lista" : "Recolher lista"}</i> : null}
            </button>
            <button type="button" className="atd-rail-controle" aria-label={railAberto ? "Mostrar só os ícones" : "Mostrar os nomes dos filtros"} title={railAberto ? "Mostrar só os ícones" : "Mostrar os nomes dos filtros"} aria-expanded={railAberto} onClick={alternarRail}>
              {railAberto ? <ChevronsLeft size={17} aria-hidden /> : <ChevronsRight size={17} aria-hidden />}
              {railAberto ? <i className="atd-rail-rotulo">Só ícones</i> : null}
            </button>
            <span className="atd-rail-divisor" aria-hidden="true" />
            {RAIL.map(({ id, rotulo, Icone }) => (
              <button key={id} type="button" className={filtro === id ? "active" : ""} aria-label={rotulo} title={rotulo} onClick={() => { setFiltro(id); if (listaRecolhida) { setListaRecolhidaEstado(false); gravarPref("lista-recolhida", false); } }}>
                <Icone size={17} aria-hidden />
                {railAberto ? <i className="atd-rail-rotulo">{rotulo}</i> : null}
              </button>
            ))}
          </nav>
          <div className="attendance-desk-list" hidden={listaRecolhida}>
            <header className="attendance-desk-list-header">
              <label className="attendance-desk-search">
                <span className="sr-only">Buscar</span>
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" />
                <Search size={17} aria-hidden />
              </label>
            </header>
            {cfgOps ? (
              <div className="atd-mesa-setores">
                <select aria-label="Setor" value={String(setorFiltro)} onChange={(e) => setSetorFiltro(e.target.value === "meus" || e.target.value === "todos" ? e.target.value : Number(e.target.value))}>
                  <option value="meus">Meus setores</option>
                  <option value="todos">Todos os setores</option>
                  {cfgOps.sectors.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
            ) : null}
            {carregandoLista ? <p className="attendance-desk-feedback">Carregando tickets...</p> : null}
            {!carregandoLista && erroLista ? <div className="attendance-desk-error" role="alert"><p>{erroLista}</p><button type="button" onClick={() => void carregarLista()}>Tentar novamente</button></div> : null}
            {!carregandoLista && !erroLista && !visiveis.length ? (
              <div className="attendance-desk-empty-list">
                <span aria-hidden="true"><MessageSquareText size={27} /></span>
                <h2>Nenhum ticket aqui</h2>
                <p>Quando novos tickets chegarem, eles aparecerão aqui.</p>
              </div>
            ) : null}
            {!carregandoLista && !erroLista && visiveis.length ? (
              <div className="attendance-desk-ticket-list">
                {visiveis.map((c) => {
                  const s = sla[c.id];
                  const nao = naoLidas[c.id] ?? 0;
                  return (
                    <button key={c.id} type="button" className={`attendance-desk-ticket ${selecionada === c.id ? "selected" : ""}`} onClick={() => void abrirConversa(c.id)}>
                      <span className="attendance-desk-ticket-avatar" aria-hidden="true">{iniciais(c.customerName)}</span>
                      <span className="attendance-desk-ticket-body">
                        <span className="attendance-desk-ticket-head"><strong>{c.customerName}</strong><time>{horaCurta(c.lastMessageAt ?? c.updatedAt ?? c.createdAt)}</time></span>
                        <span className="attendance-desk-ticket-channel">{c.subject ?? c.ticketMetadata?.ticket?.title ?? "Atendimento"}</span>
                        <span className="attendance-desk-ticket-preview">{c.lastMessage ?? "Sem mensagens recentes."}</span>
                        <span className="attendance-desk-ticket-meta">
                          <span>{STATUS_ROTULO[c.status]}</span>
                          {c.assignedAgentName ? <span>{c.assignedAgentName}</span> : null}
                          {s ? <span>{setorNome(s.sectorId)}</span> : null}
                          {s && s.state !== "none" ? <span className={`atd-sla ${s.state}`} title={s.kind === "first_response" ? "Esperando a primeira resposta" : "Esperando resposta"}>{duracao(s.waitingSeconds)}{s.state === "breached" ? " ⚠" : ""}</span> : null}
                        </span>
                      </span>
                      {nao > 0 ? <span className="attendance-desk-unread">{nao}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </aside>

        <div className="attendance-desk-main atd-mesa-principal">
          {detalhe ? (
            <div className="atd-mesa-barra">
              {!detalhe.assignedAgentId && !encerrada ? <button type="button" className="primary-action" onClick={() => void assumir()}><UserCheck size={15} aria-hidden="true" /> Assumir atendimento</button> : null}
              {tel.numeros.length ? <button type="button" className="secondary-action" disabled={!tel.podeLigar} onClick={() => tel.ligar(tel.numeros[0]!)} title={tel.podeLigar ? `Ligar para ${tel.numeros[0]}` : tel.emLigacao ? "Você já está em uma ligação" : "Telefone desconectado"}><PhoneCall size={15} aria-hidden="true" /> Ligar</button> : null}
              {tel.chamadaDoCliente ? <span className="atd-ligacao-chip"><PhoneCall size={13} aria-hidden="true" /> {tel.chamadaDoCliente.estado === "conversando" ? "Em ligação com este cliente" : tel.chamadaDoCliente.estado === "tocando" ? "Este cliente está ligando" : "Ligando para este cliente"}</span> : null}
              {cfgOps && !encerrada ? (
                <select aria-label="Mover para o setor" value={sla[detalhe.id]?.sectorId ?? ""} onChange={(e) => void moverSetor(Number(e.target.value))} title="Mover a conversa para outro setor">
                  {cfgOps.sectors.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              ) : null}
              {gerenciaMacros ? <button type="button" className="secondary-action" onClick={() => setMacroAdminAberta(true)} title="Criar e editar macros"><Zap size={15} aria-hidden="true" /> Macros</button> : null}
              <button type="button" className={`secondary-action${fichaAberta ? " active" : ""}`} aria-pressed={fichaAberta} onClick={() => setFichaAberta((v) => !v)}><UserRound size={15} aria-hidden="true" /> Ficha</button>
              {aviso ? <span className="atd-mesa-aviso" role="alert">{aviso}</span> : null}
            </div>
          ) : null}
          <ChatPanel
            conversation={detalhe}
            messages={msgs}
            notes={notas}
            quickReplies={respostas}
            macros={macros}
            recentMacros={recentMacros}
            favoriteMacroIds={favoriteIds}
            onTriggerMacro={acionarMacro}
            loading={carregandoConversa}
            error={erroConversa}
            hasMore={false}
            typingLabel={digitando}
            now={agora}
            sendingDisabled={!minha || !agente}
            canTransfer={podeTransferir}
            canClose={minha}
            canArchive={minha || podeTransferir}
            canDelete={false}
            statusUpdating={atualizandoStatus}
            archiveUpdating={atualizandoStatus}
            tagsUpdating={atualizandoTags}
            noteSubmitting={salvandoNota}
            currentAgentName={agente?.name ?? ""}
            onLoadOlder={() => undefined}
            onSend={(texto) => void enviar(texto)}
            onRetry={(m) => void enviar(m.body, m)}
            onAddNote={(t) => void adicionarNota(t)}
            onTypingStart={() => { if (detalhe && minha) void window.desktop!.atendimentoDigitando!({ conversationId: Number(detalhe.id), ligado: true }); }}
            onTypingStop={() => { if (detalhe) void window.desktop!.atendimentoDigitando!({ conversationId: Number(detalhe.id), ligado: false }); }}
            onStatusChange={(s) => void mudarStatus(s)}
            onArchive={() => void arquivar(true)}
            onRestore={() => void arquivar(false)}
            onTagsChange={(t) => void mudarTags(t)}
            onOpenTransfer={() => void abrirTransferencia()}
            onOpenClose={() => setEncerrando(true)}
            onOpenDelete={() => undefined}
            onRetryLoad={() => detalhe && void abrirConversa(detalhe.id)}
          />
        </div>

        {detalhe && fichaAberta && detalhe.contractId ? <Ficha360 contrato={detalhe.contractId} /> : null}
      </section>
      <MacroExecutionModal macro={macroPendente} onCancel={() => setMacroPendente(null)} onConfirm={confirmarMacro} />
      <MacroExecutionProgress state={execucaoMacro.state} pendingGate={execucaoMacro.pendingGate} onConfirmStep={execucaoMacro.confirmStep} onResolveError={execucaoMacro.resolveError} onCancel={execucaoMacro.cancel} onClose={execucaoMacro.reset} />
      {gerenciaMacros ? <MacroAdminDialog open={macroAdminAberta} macros={macros} loading={carregandoMacros} onClose={() => setMacroAdminAberta(false)} onReload={() => void recarregarMacros()} /> : null}
      <TransferDialog open={!!transferindo} agents={transferindo?.agentes ?? []} loading={transferindo?.enviando ?? false} onCancel={() => setTransferindo(null)} onConfirm={(id) => void transferir(id)} />
      <CloseConversationDialog open={encerrando} onCancel={() => setEncerrando(false)} onConfirm={(motivo, nota) => void encerrar(motivo, nota)} />
    </div>
  );
}
