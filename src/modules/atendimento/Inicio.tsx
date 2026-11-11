import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Headset, Inbox, MessageSquareText, Pause, Play, Volume2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { mudarStatusAtd, totalNaoLidas, useAtendimento } from "../../stores/atendimentoSessao";
import { chamar, msgErro } from "./chamar";
import type { ConfigOps } from "./Mesa";

interface Contagens { novos: number; meus: number }

const relogio = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":"); };

/** Tela inicial: é aqui que a pessoa começa (e pausa) o atendimento. */
export default function Inicio({ nome, cfgOps, aoIrParaConversas }: { nome: string; cfgOps: ConfigOps | null; aoIrParaConversas(filtro?: "new" | "mine"): void }) {
  const status = useAtendimento((s) => s.status);
  const inicioEm = useAtendimento((s) => s.inicioEm);
  const naFila = useAtendimento((s) => s.naFila);
  const naoLidas = useAtendimento((s) => totalNaoLidas(s.naoLidas));
  const som = useAtendimento((s) => s.som), setSom = useAtendimento((s) => s.setSom);
  const aviso = useAtendimento((s) => s.aviso), setAviso = useAtendimento((s) => s.setAviso);
  const [agora, setAgora] = useState(Date.now());
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState("");
  const ativo = status === "AVAILABLE";
  useEffect(() => { if (!ativo) return; const t = window.setInterval(() => setAgora(Date.now()), 1000); return () => window.clearInterval(t); }, [ativo]);

  const contagens = useQuery({
    queryKey: ["atendimento", "inicio-contagens"], refetchInterval: 20_000,
    queryFn: async (): Promise<Contagens> => {
      const [novos, meus] = await Promise.all(["new", "mine"].map((filter) => chamar<{ items: unknown[]; total?: number; pagination?: { total?: number } }>("GET", "/api/agent/conversations", { query: { filter, limit: "100" } })));
      const n = (r: typeof novos) => r.pagination?.total ?? r.total ?? r.items.length;
      return { novos: n(novos), meus: n(meus) };
    },
  });

  const alternar = async () => {
    setTrocando(true); setErro("");
    try { await mudarStatusAtd(ativo ? "INVISIBLE" : "AVAILABLE"); } catch (e) { setErro(msgErro(e)); } finally { setTrocando(false); }
  };
  const primeiroNome = nome.trim().split(/\s+/)[0] || "";
  const foraDoExpediente = cfgOps && !cfgOps.open;

  return (
    <div className="atd-inicio">
      <div className={`atd-inicio-cartao ${ativo ? "ativo" : ""}`}>
        <span className="atd-inicio-icone" aria-hidden="true"><Headset size={34} /></span>
        <h2>{primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!"}</h2>
        {naFila ? (
          <>
            <p className="muted">{ativo ? "Você está em atendimento: novas conversas chegam para você." : "Você está em pausa. Clique em Iniciar para começar a receber conversas."}</p>
            {ativo && inicioEm ? <p className="atd-inicio-tempo" aria-label="Tempo em atendimento">{relogio(agora - inicioEm)}</p> : null}
            <Button size="lg" variant={ativo ? "outline" : "default"} disabled={trocando || status === null} onClick={() => void alternar()}>
              {ativo ? <><Pause size={18} />Pausar atendimento</> : <><Play size={18} />Iniciar atendimento</>}
            </Button>
            {foraDoExpediente ? <p className="muted">Fora do expediente: clientes ainda podem deixar mensagens, e o relógio do SLA está parado.</p> : null}
          </>
        ) : <p className="muted">Você não faz parte da fila de atendimento. Use as outras abas para acompanhar conversas e chamados.</p>}
        {erro ? <p className="term-erro" role="alert">{erro}</p> : null}
      </div>

      <div className="atd-inicio-numeros">
        <button type="button" onClick={() => aoIrParaConversas("new")}><MessageSquareText size={18} aria-hidden="true" /><b>{contagens.data?.novos ?? "—"}</b><span>aguardando na fila</span></button>
        <button type="button" onClick={() => aoIrParaConversas("mine")}><Inbox size={18} aria-hidden="true" /><b>{contagens.data?.meus ?? "—"}</b><span>meus atendimentos</span></button>
        <button type="button" onClick={() => aoIrParaConversas("mine")}><Bell size={18} aria-hidden="true" /><b>{naoLidas}</b><span>mensagens não lidas</span></button>
      </div>

      <div className="atd-inicio-alertas">
        <h3>Avisos</h3>
        <label><input type="checkbox" checked={som} onChange={(e) => setSom(e.target.checked)} /><Volume2 size={15} aria-hidden="true" /> Tocar som quando chegar conversa ou mensagem</label>
        <label><input type="checkbox" checked={aviso} onChange={(e) => setAviso(e.target.checked)} /><Bell size={15} aria-hidden="true" /> Mostrar aviso do Windows</label>
        <p className="muted">Os avisos funcionam em qualquer tela do Workspace enquanto você estiver em atendimento.</p>
      </div>
    </div>
  );
}
