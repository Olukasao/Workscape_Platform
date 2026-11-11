import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Headset, Lock, MessageSquarePlus, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "../components/ui/button";
import { api, errorMessage } from "../services/api";
import { usePreferences, useSession } from "../stores/workspace";
import Mesa, { type AgenteAtd, type ConfigOps } from "./atendimento/Mesa";
import Supervisao from "./atendimento/Supervisao";
import Relatorios from "./atendimento/Relatorios";
import Configuracoes from "./atendimento/Configuracoes";
import { chamar, msgErro, type Cargo } from "./atendimento/chamar";
import { AuthContext } from "./atendimento/console/context/authContextValue";
import type { AgentUser } from "./atendimento/console/types/domain";
import { canManageCampaigns, canViewAuditLog, canViewAutomations, canViewMonitoring, canViewSalesAudit } from "./atendimento/console/utils/security";
import "../styles/atendimento-console.css";
import "../styles/atendimento.css";

// Telas do painel de atendimento, carregadas só quando a aba é aberta.
const VendasPage = lazy(() => import("./atendimento/console/pages/VendasPage").then((m) => ({ default: m.VendasPage })));
const FinalizadosPage = lazy(() => import("./atendimento/console/pages/FinalizadosPage").then((m) => ({ default: m.FinalizadosPage })));
const MonitoringPage = lazy(() => import("./atendimento/console/pages/MonitoringPage").then((m) => ({ default: m.MonitoringPage })));
const AuditoriaTicketsPage = lazy(() => import("./atendimento/console/pages/AuditoriaTicketsPage").then((m) => ({ default: m.AuditoriaTicketsPage })));
const AuditoriaVendasPage = lazy(() => import("./atendimento/console/pages/AuditoriaVendasPage").then((m) => ({ default: m.AuditoriaVendasPage })));
const DisparosPage = lazy(() => import("./atendimento/console/pages/DisparosPage").then((m) => ({ default: m.DisparosPage })));
const AutomationsPage = lazy(() => import("./atendimento/console/pages/AutomationsPage").then((m) => ({ default: m.AutomationsPage })));

interface ChamadoAberto { ticketId: string | null; contractId: string | null; protocol: string | null; customerName: string | null; title: string; openedAt: string; status: string; statusLabel: string }
type Aba = "conversas" | "chamados" | "finalizados" | "vendas" | "supervisao" | "monitoramento" | "relatorios" | "aud-tickets" | "aud-vendas" | "disparos" | "automacoes" | "config";

/** Atendimento por chat com os clientes da Central do assinante (chat-api). Tokens e tempo real ficam no processo principal. */
export default function Atendimento({ active }: { active: boolean }) {
  const [fase, setFase] = useState<"entrando" | "ok" | "erro">("entrando");
  const [erroLogin, setErroLogin] = useState("");
  const [agente, setAgente] = useState<AgenteAtd | null>(null);
  const [statusAtd, setStatusAtd] = useState<"AVAILABLE" | "INVISIBLE" | null>(null);
  const [cfgOps, setCfgOps] = useState<ConfigOps | null>(null);
  const [aba, setAba] = useState<Aba>("conversas");
  const [naoLidas, setNaoLidas] = useState(0);
  const [pedido, setPedido] = useState<{ id: string; n: number } | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [avisoAbrir, setAvisoAbrir] = useState("");
  // Área em testes: quem não é administrador vê o aviso toda vez que entra na página.
  const ehAdminWorkspace = useSession((s) => s.user?.perfil) === "admin";
  const temaPainel = usePreferences((s) => s.theme) === "light" ? "claro" : "escuro";
  const [avisoTestes, setAvisoTestes] = useState(true);

  const entrar = useCallback(async () => {
    setFase("entrando"); setErroLogin("");
    try {
      const r = await window.desktop!.atendimentoEntrar!();
      setAgente(r.agente); setFase("ok");
      void chamar<{ agent: { attendanceStatus?: "AVAILABLE" | "INVISIBLE" } }>("GET", "/api/agent/auth/me").then((m) => setStatusAtd(m.agent.attendanceStatus ?? "AVAILABLE")).catch(() => setStatusAtd("AVAILABLE"));
    } catch (e) { setErroLogin(msgErro(e)); setFase("erro"); }
  }, []);
  useEffect(() => { if (window.desktop?.atendimentoEntrar) void entrar(); }, [entrar]);
  useEffect(() => { if (fase === "ok") void chamar<ConfigOps>("GET", "/api/agent/ops/config").then(setCfgOps).catch(() => undefined); }, [fase]);
  // Sessão do atendimento expirada no meio do uso: volta para a tela de entrada.
  useEffect(() => window.desktop?.onAtendimento?.("atendimento:estado", (e) => { if (e.erro) { setErroLogin(e.erro); setFase("erro"); } }), []);

  const cargo = (agente?.role ?? "agent") as Cargo;
  const ehSupervisor = cargo === "supervisor" || cargo === "admin";
  // Quem está logado, no formato que as telas do painel esperam.
  const usuarioPainel = useMemo<AgentUser | null>(() => (agente ? { id: String(agente.id), name: agente.name, email: agente.email, role: agente.role as AgentUser["role"], attendanceStatus: statusAtd ?? "AVAILABLE" } : null), [agente, statusAtd]);
  const abrirNaMesa = useCallback((id: string) => { setAba("conversas"); setPedido({ id, n: Date.now() }); }, []);

  // Chamados abertos pela Central do assinante (lista do site, via Chat Interno).
  const chamados = useQuery({
    queryKey: ["atendimento", "chamados-abertos"],
    enabled: fase === "ok" && aba === "chamados",
    refetchInterval: 60_000,
    queryFn: async () => {
      const partes = await Promise.all(["open", "scheduled", "in_progress"].map(async (status) =>
        (await api.get<{ items: ChamadoAberto[] }>("/chamados/site", { params: { period: "30d", limit: 100, status } })).data.items));
      const vistos = new Set<string>();
      return partes.flat().filter((c) => c.ticketId && c.contractId && !vistos.has(c.ticketId) && !!vistos.add(c.ticketId)).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    },
  });
  const abrirAtendimento = async (c: ChamadoAberto) => {
    if (!c.ticketId || !c.contractId) return;
    if (!window.confirm(`Abrir atendimento com ${c.customerName || "este cliente"}? O cliente passa a ver o chat na Central do assinante.`)) return;
    setAbrindo(c.ticketId); setAvisoAbrir("");
    try {
      const r = await chamar<{ conversation: { id: number | string }; created: boolean }>("POST", "/api/agent/conversations/start-from-ticket", { body: { contractId: c.contractId, ticketId: c.ticketId } });
      abrirNaMesa(String(r.conversation.id));
      if (!r.created) setAvisoAbrir("Este cliente já tinha uma conversa ativa; ela foi aberta.");
    } catch (e) { setAvisoAbrir(msgErro(e)); } finally { setAbrindo(null); }
  };

  const aviso = !ehAdminWorkspace && avisoTestes ? (
    <div className="atd-testes-fundo" role="dialog" aria-modal="true" aria-labelledby="atd-testes-titulo">
      <div className="atd-testes-caixa">
        <span className="atd-testes-icone" aria-hidden="true"><FlaskConical size={30} /></span>
        <h2 id="atd-testes-titulo">EM TESTES</h2>
        <p>O Atendimento ainda está em fase de testes. Algumas funções podem mudar ou não funcionar, e o acesso é liberado aos poucos pela administração.</p>
        <Button onClick={() => setAvisoTestes(false)} autoFocus>Entendi</Button>
      </div>
    </div>
  ) : null;
  if (!window.desktop?.atendimentoEntrar) return <div className="atd-vazio"><Headset size={28} /><p>O Atendimento só funciona no aplicativo do Workspace para Windows.</p></div>;
  if (fase !== "ok")
    return (
      <div className="atd-vazio" role="status">
        {aviso}
        {fase === "entrando" ? <><RefreshCw size={26} className="atd-gira" /><p>Entrando no atendimento…</p></> : (
          <><Lock size={28} /><p>{erroLogin || "Não foi possível entrar no atendimento."}</p><Button onClick={() => void entrar()}><RefreshCw size={14} />Tentar de novo</Button></>
        )}
      </div>
    );

  const aba_ = (id: Aba, rotulo: string, extra?: React.ReactNode) => (
    <button type="button" role="tab" aria-selected={aba === id} className={clsx(aba === id && "ativa")} onClick={() => setAba(id)}>{rotulo}{extra}</button>
  );
  return (
    <div className={clsx("atd-raiz", !active && "atd-oculto")}>
      {aviso}
      <nav className="atd-abas" role="tablist" aria-label="Atendimento">
        {aba_("conversas", "Conversas", naoLidas ? <i className="atd-badge">{naoLidas}</i> : null)}
        {aba_("chamados", "Chamados abertos")}
        {aba_("finalizados", "Finalizados")}
        {aba_("vendas", "Vendas")}
        {ehSupervisor ? aba_("supervisao", "Supervisão") : null}
        {canViewMonitoring(cargo) ? aba_("monitoramento", "Monitoramento") : null}
        {ehSupervisor ? aba_("relatorios", "Relatórios") : null}
        {canViewAuditLog(cargo) ? aba_("aud-tickets", "Auditoria de tickets") : null}
        {canViewSalesAudit(cargo) ? aba_("aud-vendas", "Auditoria de vendas") : null}
        {canManageCampaigns(cargo) ? aba_("disparos", "Disparos") : null}
        {canViewAutomations(cargo) ? aba_("automacoes", "Automações") : null}
        {cargo === "admin" ? aba_("config", "Configurações") : null}
        {!ehAdminWorkspace ? <span className="atd-selo-testes" title="Área em fase de testes">EM TESTES</span> : null}
        {cfgOps && !cfgOps.open ? <span className="atd-fora" title="O relógio do SLA está parado">Fora do expediente</span> : null}
      </nav>
      {avisoAbrir ? <p className="term-erro" role="alert">{avisoAbrir}</p> : null}
      <div className="atd-corpo" hidden={aba !== "conversas"}>
        <Mesa agente={agente} cargo={cargo} statusAtd={statusAtd} cfgOps={cfgOps} visivel={active && aba === "conversas"} abrir={pedido} aoMudarNaoLidas={setNaoLidas} />
      </div>
      <AuthContext.Provider value={{ user: usuarioPainel, updateUser: () => undefined }}>
        <Suspense fallback={<p className="muted atd-painel">Carregando…</p>}>
          <div className="atd-sc atd-pagina" data-tema={temaPainel} hidden={!["finalizados", "vendas", "monitoramento", "aud-tickets", "aud-vendas", "disparos", "automacoes"].includes(aba)}>
            {aba === "finalizados" ? <FinalizadosPage /> : null}
            {aba === "vendas" ? <VendasPage /> : null}
            {aba === "monitoramento" && canViewMonitoring(cargo) ? <MonitoringPage /> : null}
            {aba === "aud-tickets" && canViewAuditLog(cargo) ? <AuditoriaTicketsPage /> : null}
            {aba === "aud-vendas" && canViewSalesAudit(cargo) ? <AuditoriaVendasPage /> : null}
            {aba === "disparos" && canManageCampaigns(cargo) ? <DisparosPage /> : null}
            {aba === "automacoes" && canViewAutomations(cargo) ? <AutomationsPage /> : null}
          </div>
        </Suspense>
      </AuthContext.Provider>
      {aba === "supervisao" && ehSupervisor ? <Supervisao aoAbrir={(id) => abrirNaMesa(String(id))} /> : null}
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
    </div>
  );
}
