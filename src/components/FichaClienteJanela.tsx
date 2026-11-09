import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Link2, PhoneCall, PhoneIncoming, PhoneOff, X } from "lucide-react";
import { useServers, useSession, usePreferences } from "../stores/workspace";
import { formatarTelefone } from "../services/chamador";
import { useApplicationZoom } from "../services/useApplicationZoom";
import { useAparencia } from "../services/aparencia";
import { dataCurta, useClienteLigacao, useVincularCliente, type ChamadoResumo, type ClienteLigacao } from "../services/clienteLigacao";
import { errorMessage } from "../services/api";
import "../styles/ficha-cliente.css";

type Fase = "tocando" | "chamando" | "conversando";
type Estado = { numero: string; nome: string; direcao: "in" | "out"; fase: Fase; atendidaMs: number | null; encerrada: boolean; fechaEm: number };
const lerHash = (): Estado => {
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const fase = q.get("estado");
  return {
    numero: q.get("numero") || "", nome: q.get("nome") || "", direcao: q.get("direcao") === "out" ? "out" : "in",
    fase: fase === "conversando" || fase === "chamando" ? fase : "tocando", atendidaMs: Number(q.get("atendida")) || null, encerrada: false, fechaEm: 0,
  };
};
const msgDe = (e: unknown) => (isAxiosError(e) && e.response?.data?.error ? String(e.response.data.error) : errorMessage(e));
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const banda = (nota: number) => (nota >= 4 ? "boa" : nota === 3 ? "media" : "ruim");
const MINUSCULAS = new Set(["da", "de", "do", "das", "dos", "e"]);
/** O SGP devolve nomes TODOS EM MAIÚSCULAS; mostra com iniciais maiúsculas (nome já misto fica como veio). */
const nomeBonito = (n: string) => (n && n === n.toUpperCase() ? n.toLowerCase().split(/\s+/).map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(" ") : n);
const encerrado = (s: string) => /encerr|finaliz|conclu|cancel/i.test(s);

/** Cinco barras de sinal, como no roteador: quanto mais barras acesas, melhor a nota. */
function Sinal({ nota }: { nota: number | null }) {
  return (
    <span className={`fc-sinal${nota ? ` ${banda(nota)}` : ""}`} role="img" aria-label={nota ? `Nota ${nota} de 5` : "Sem avaliação"}>
      {[1, 2, 3, 4, 5].map((n) => <i key={n} className={nota !== null && n <= nota ? "on" : ""} style={{ ["--i" as string]: n }} />)}
    </span>
  );
}

function CartaoCliente({ c, outros }: { c: ClienteLigacao; outros?: string[] }) {
  const abertos = (c.chamados ?? []).filter((x) => !encerrado(x.status)).length;
  const sit = /ativo/i.test(c.situacao) && !/inativ/i.test(c.situacao) ? "ok" : /suspen|bloque/i.test(c.situacao) ? "alerta" : c.situacao ? "ruim" : "";
  return (
    <div className="fc-cliente">
      <section className="fc-quem" aria-label="Cliente">
        <h2>{nomeBonito(c.nome) || `Contrato ${c.contrato}`}</h2>
        <div className="fc-chips">
          {c.situacao ? <span className={`fc-chip ${sit}`}>{c.situacao}</span> : null}
          <span className="fc-chip" title={c.contratos && c.contratos.length > 1 ? `Contratos: ${c.contratos.join(", ")}` : undefined}>Contrato {c.contrato}{c.contratos && c.contratos.length > 1 ? ` +${c.contratos.length - 1}` : ""}</span>
          {c.plano ? <span className="fc-chip">{c.plano}</span> : null}
          {abertos ? <span className="fc-chip alerta">{abertos} {abertos === 1 ? "chamado aberto" : "chamados abertos"}</span> : null}
        </div>
        {outros ? <p className="fc-atencao">Este número está em {outros.length} contratos de clientes diferentes. Confirme com quem está falando.</p> : null}
      </section>

      {c.ultimaAvaliacao !== undefined ? (
        <section className="fc-nota" aria-label="Última avaliação">
          <Sinal nota={c.ultimaAvaliacao ? c.ultimaAvaliacao.nota : null} />
          <div>
            {c.ultimaAvaliacao ? (
              <>
                <strong className={banda(c.ultimaAvaliacao.nota)}>{c.ultimaAvaliacao.nota}<span>/5</span></strong>
                <small>Última avaliação, {dataCurta(c.ultimaAvaliacao.respondidoEm)}</small>
              </>
            ) : <small>Ainda não avaliou o atendimento.</small>}
          </div>
          {c.ultimaAvaliacao?.comentario ? <blockquote>{c.ultimaAvaliacao.comentario}</blockquote> : null}
        </section>
      ) : null}

      <section className="fc-chamados" aria-label="Chamados recentes">
        <header><h3>Chamados recentes</h3>{c.totalChamados ? <span>{c.totalChamados} no total</span> : null}</header>
        {c.chamados === null ? <p className="fc-vazio">Os chamados estão indisponíveis agora.</p> : c.chamados.length === 0 ? <p className="fc-vazio">Nenhum chamado registrado para este cliente.</p> : (
          <ol>
            {c.chamados.map((x: ChamadoResumo) => (
              <li key={x.protocolo || x.abertoEm + x.tipo} className={encerrado(x.status) ? "fechado" : "aberto"}>
                <span className="fc-ponto" aria-hidden="true" />
                <div>
                  <p><strong>{x.tipo || "Chamado"}</strong><span>{dataCurta(x.abertoEm)}</span></p>
                  {x.assunto ? <small>{x.assunto}</small> : null}
                  <em>{x.status}{x.metodo ? ` · ${x.metodo}` : ""}</em>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Busca({ numero }: { numero: string }) {
  const [ddd, setDdd] = useState("");
  const [digitado, setDigitado] = useState("");
  const [contrato, setContrato] = useState("");
  const q = useClienteLigacao(numero, true, ddd);
  const vincular = useVincularCliente(numero, ddd);
  const d = q.data;

  if (q.isLoading) return <div className="fc-carregando" aria-busy="true" role="status"><span /><span /><span /><p>Procurando o cliente no SGP…</p></div>;
  if (q.isError) return <div className="fc-aviso"><p>Não foi possível consultar o SGP agora.</p><button type="button" onClick={() => void q.refetch()}>Tentar de novo</button></div>;
  if (!d?.valido) return <div className="fc-aviso"><p>Este número não parece ser de cliente.</p></div>;

  if (d.semDdd) {
    return (
      <form className="fc-aviso fc-ddd" onSubmit={(e) => { e.preventDefault(); if (/^[1-9]\d$/.test(digitado)) setDdd(digitado); }}>
        {d.candidatos?.length ? (
          <>
            <p><strong>Este número existe com mais de um DDD.</strong> Qual é o do cliente?</p>
            <div className="fc-opcoes">{d.candidatos.map((c) => <button type="button" key={c.ddd} onClick={() => setDdd(c.ddd)}>({c.ddd})</button>)}</div>
          </>
        ) : (
          <>
            <p><strong>O número veio sem DDD.</strong> O SGP só acha o cliente com o DDD.</p>
            <label><span>DDD</span><input inputMode="numeric" maxLength={2} autoComplete="off" value={digitado} onChange={(e) => setDigitado(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="11" /></label>
            <button type="submit" disabled={!/^[1-9]\d$/.test(digitado)}>Buscar</button>
          </>
        )}
      </form>
    );
  }
  if (!d.encontrado || !d.cliente) {
    return (
      <form className="fc-aviso" onSubmit={(e) => { e.preventDefault(); if (contrato.trim()) vincular.mutate(contrato.trim()); }}>
        <p><strong>Este número não está ligado a nenhum cliente.</strong> Se você souber o contrato, vincule: da próxima vez o cliente aparece sozinho.</p>
        <label><span>Nº do contrato</span><input inputMode="numeric" autoComplete="off" value={contrato} onChange={(e) => setContrato(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 3005" /></label>
        <button type="submit" disabled={!contrato.trim() || vincular.isPending}><Link2 size={14} aria-hidden="true" /> {vincular.isPending ? "Vinculando…" : "Vincular"}</button>
        {vincular.isError ? <p role="alert" className="fc-erro">{msgDe(vincular.error)}</p> : null}
      </form>
    );
  }
  return <CartaoCliente c={d.cliente} outros={d.outrosContratos} />;
}

/** Janela flutuante da ficha do cliente na ligação (sempre com o visual escuro da marca, para destacar sobre qualquer tela). */
export default function FichaClienteJanela() {
  const { load } = useServers();
  const [pronto, setPronto] = useState<"carregando" | "ok" | "erro">("carregando");
  const [e, setE] = useState<Estado>(lerHash);
  const [agora, setAgora] = useState(Date.now());
  useApplicationZoom();
  useAparencia();
  const theme = usePreferences((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = "escuro";
    document.documentElement.dataset.anTheme = "dark";
    document.documentElement.style.colorScheme = "dark";
    document.title = "Ficha do cliente";
  }, [theme]);
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        await load();
        // Fora do app Windows (pré-visualização no navegador) usa o login da própria aba.
        const salva = (await window.desktop?.getSession?.()) ?? { token: sessionStorage.getItem("token") };
        if (!salva?.token) throw new Error("sem sessão");
        sessionStorage.setItem("token", salva.token);
        useSession.setState({ token: salva.token });
        if (!cancelado) setPronto("ok");
      } catch { if (!cancelado) setPronto("erro"); }
    })();
    return () => { cancelado = true; };
  }, [load]);
  useEffect(() => window.desktop?.onFichaEvento?.((ev) => {
    if (ev.tipo === "nova") setE({ numero: ev.numero, nome: ev.nome, direcao: ev.direcao, fase: ev.estado, atendidaMs: ev.atendidaMs, encerrada: false, fechaEm: 0 });
    else setE((a) => ({ ...a, encerrada: true, fechaEm: Date.now() + ev.fechaEm }));
  }), []);
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  const falando = !e.encerrada && e.fase === "conversando";
  const segundos = useMemo(() => (e.encerrada ? Math.max(0, Math.ceil((e.fechaEm - agora) / 1000)) : falando && e.atendidaMs ? Math.max(0, Math.floor((agora - e.atendidaMs) / 1000)) : 0), [e, agora, falando]);
  const rotulo = e.encerrada ? "Ligação encerrada" : e.fase === "conversando" ? "Em ligação" : e.direcao === "in" ? "Chamada recebida" : "Ligando";
  const Icone = e.encerrada ? PhoneOff : e.direcao === "in" && e.fase === "tocando" ? PhoneIncoming : PhoneCall;
  const mostrarNome = e.nome && !/^[\d\s()+\-.*#]+$/.test(e.nome);

  return (
    <div className="fc-janela">
      <header className={`fc-chamada ${e.encerrada ? "fim" : e.fase}`}>
        <span className="fc-icone" aria-hidden="true"><Icone size={17} /></span>
        <div className="fc-estado" aria-live="polite">
          <span>{rotulo}</span>
          {falando && e.atendidaMs ? <b>{mmss(segundos)}</b> : e.encerrada && segundos ? <b>fecha em {segundos} s</b> : null}
        </div>
        <button type="button" onClick={() => void window.desktop?.fichaFechar?.()} aria-label="Fechar a ficha" title="Fechar"><X size={16} /></button>
        <h1>{mostrarNome ? e.nome : formatarTelefone(e.numero)}</h1>
        {mostrarNome ? <p>{formatarTelefone(e.numero)}</p> : null}
      </header>
      <main className="fc-corpo">
        {pronto === "carregando" ? <div className="fc-carregando" aria-busy="true"><span /><span /><span /></div>
          : pronto === "erro" ? <div className="fc-aviso"><p>Entre no Workspace para ver a ficha do cliente.</p></div>
          : <Busca numero={e.numero} key={e.numero} />}
      </main>
    </div>
  );
}
