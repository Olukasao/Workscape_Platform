import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Headset, Lock, MessageSquarePlus, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "../components/ui/button";
import { api, errorMessage } from "../services/api";
import Mesa, { type AgenteAtd, type ConfigOps } from "./atendimento/Mesa";
import Supervisao from "./atendimento/Supervisao";
import Relatorios from "./atendimento/Relatorios";
import Configuracoes from "./atendimento/Configuracoes";
import { chamar, msgErro, type Cargo } from "./atendimento/chamar";
import "../styles/atendimento.css";

interface ChamadoAberto { ticketId: string | null; contractId: string | null; protocol: string | null; customerName: string | null; title: string; openedAt: string; status: string; statusLabel: string }
type Aba = "conversas" | "chamados" | "supervisao" | "relatorios" | "config";

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

  if (!window.desktop?.atendimentoEntrar) return <div className="atd-vazio"><Headset size={28} /><p>O Atendimento só funciona no aplicativo do Workspace para Windows.</p></div>;
  if (fase !== "ok")
    return (
      <div className="atd-vazio" role="status">
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
      <nav className="atd-abas" role="tablist" aria-label="Atendimento">
        {aba_("conversas", "Conversas", naoLidas ? <i className="atd-badge">{naoLidas}</i> : null)}
        {aba_("chamados", "Chamados abertos")}
        {ehSupervisor ? aba_("supervisao", "Supervisão") : null}
        {ehSupervisor ? aba_("relatorios", "Relatórios") : null}
        {cargo === "admin" ? aba_("config", "Configurações") : null}
        {cfgOps && !cfgOps.open ? <span className="atd-fora" title="O relógio do SLA está parado">Fora do expediente</span> : null}
      </nav>
      {avisoAbrir ? <p className="term-erro" role="alert">{avisoAbrir}</p> : null}
      <div className="atd-corpo" hidden={aba !== "conversas"}>
        <Mesa agente={agente} cargo={cargo} statusAtd={statusAtd} cfgOps={cfgOps} visivel={active && aba === "conversas"} abrir={pedido} aoMudarNaoLidas={setNaoLidas} />
      </div>
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
