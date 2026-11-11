import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headset, Lock, RefreshCw, Search, Send, UserCheck, XCircle, RotateCcw, Zap } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "../components/ui/button";
import "../styles/atendimento.css";

type Status = "new" | "open" | "waiting_customer" | "waiting_agent" | "closed";
interface Conversa {
  id: number; customerId: string; contractId: string; ticketId: string; assignedAgentId: number | null; status: Status;
  createdAt: string; updatedAt: string; closedAt: string | null; tags?: string[];
  ticketMetadata?: { customer?: { name?: string; phone?: string }; contract?: { planName?: string; city?: string }; ticket?: { title?: string } } | null;
}
interface Mensagem { id: number; conversationId: number; clientMessageId?: string; senderType: "customer" | "agent" | "system"; senderId: string; message: string; createdAt: string; readAt: string | null }
interface Resposta { id: number; shortcut: string; title: string; body: string }
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
const chamar = <T,>(method: "GET" | "POST" | "PATCH", path: string, extra: { query?: Record<string, string>; body?: unknown } = {}) =>
  window.desktop!.atendimentoChamar!({ method, path, ...extra }) as Promise<T>;
const msgErro = (e: unknown) => {
  const m = e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "Erro inesperado.";
  const mapa: Record<string, string> = { agent_not_registered: "Você não está cadastrado como atendente. Peça ao administrador.", agent_disabled: "Seu acesso ao atendimento está desativado.", conversation_assigned_to_another_agent: "Esta conversa é de outro atendente.", conversation_not_assigned: "Assuma a conversa antes de responder.", conversation_already_assigned: "Outro atendente já assumiu esta conversa.", conversation_closed: "Esta conversa já foi encerrada." };
  return mapa[m] ?? m;
};

/** Atendimento por chat com os clientes da Central do assinante (chat-api). Tokens e tempo real ficam no processo principal. */
export default function Atendimento({ active }: { active: boolean }) {
  const [fase, setFase] = useState<"entrando" | "ok" | "erro">("entrando");
  const [erroLogin, setErroLogin] = useState("");
  const [agente, setAgente] = useState<Agente | null>(null);
  const [conectado, setConectado] = useState(false);
  const [filtro, setFiltro] = useState("new");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Conversa[]>([]);
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
    try { const r = await window.desktop!.atendimentoEntrar!(); setAgente(r.agente); setFase("ok"); }
    catch (e) { setErroLogin(msgErro(e)); setFase("erro"); }
  }, []);
  useEffect(() => { if (window.desktop?.atendimentoEntrar) void entrar(); }, [entrar]);

  const carregarLista = useCallback(async () => {
    try {
      const r = await chamar<{ items: Conversa[] }>("GET", "/api/agent/conversations", { query: { filter: filtroRef.current, limit: "100", ...(busca.trim() ? { search: busca.trim() } : {}) } });
      setLista(r.items);
      void window.desktop!.atendimentoEntrarNas!({ ids: r.items.map((c) => c.id) });
    } catch (e) { setErro(msgErro(e)); }
  }, [busca]);
  useEffect(() => { if (fase === "ok") void carregarLista(); }, [fase, filtro, carregarLista]);
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

  const atual = useMemo(() => lista.find((c) => c.id === selecionada) ?? null, [lista, selecionada]);
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
    <div className={clsx("atd", !active && "atd-oculto")}>
      <aside className="atd-lista">
        <div className="atd-topo">
          <label className="atd-busca"><Search size={15} /><input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void carregarLista()} placeholder="Buscar cliente ou protocolo" aria-label="Buscar conversa" /></label>
          <span className={clsx("atd-ponto", conectado && "on")} title={conectado ? "Tempo real conectado" : "Reconectando…"} />
        </div>
        <div className="atd-filtros" role="tablist">
          {FILTROS.map((f) => <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} className={clsx(filtro === f.id && "ativa")} onClick={() => setFiltro(f.id)}>{f.nome}</button>)}
        </div>
        <div className="atd-itens">
          {!lista.length ? <p className="muted atd-dica">Nenhuma conversa neste filtro.</p> : null}
          {lista.map((c) => (
            <button key={c.id} type="button" className={clsx("atd-item", c.id === selecionada && "ativa")} onClick={() => void abrir(c.id)}>
              <span className="atd-item-linha"><b>{nomeDe(c)}</b><small>{quando(c.updatedAt)}</small></span>
              <span className="atd-item-linha"><small className="atd-sub">{c.ticketMetadata?.ticket?.title || `Chamado ${c.ticketId}`}</small>
                {naoLidas[c.id] ? <i className="atd-badge">{naoLidas[c.id]}</i> : <em className={`atd-st ${c.status}`}>{ROTULO[c.status]}</em>}</span>
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
              </div>
            </header>
            {erro ? <p className="term-erro" role="alert">{erro}</p> : null}
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
  );
}
