import { useEffect, useMemo, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import { AlertTriangle, CalendarClock, Check, ChevronDown, Contact, Copy, ExternalLink, Link2, ListChecks, Mail, MapPin, Phone, PhoneCall, PhoneIncoming, PhoneOff, Repeat, Star, StickyNote, Wallet, Wifi, WifiOff, X, type LucideIcon } from "lucide-react";
import { useServers, useSession, usePreferences } from "../stores/workspace";
import { formatarTelefone } from "../services/chamador";
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

const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mesAno = (iso: string) => { const m = /^(\d{4})-(\d{2})/.exec(iso); return m ? `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m[2] - 1]}/${m[1]}` : ""; };
const diaSemana = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(+d) ? "" : d.toLocaleDateString("pt-BR", { weekday: "long" }); };
const quando = (t: string | null) => { const m = t ? /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(t) : null; return m ? `${m[3]}/${m[2]}${m[4] ? ` às ${m[4]}:${m[5]}` : ""}` : ""; };
/** GPON: acima de -25 dBm está folgado; até -28 já pede atenção; abaixo disso a ONU costuma cair. */
const qualidadeSinal = (dbm: number) => (dbm >= -25 ? "boa" : dbm >= -28 ? "media" : "ruim");
const tempoMedio = (d: number) => (d < 1 ? "menos de 1 dia" : `${String(d).replace(".", ",")} ${d === 1 ? "dia" : "dias"}`);

function Copiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="fc-copiar" aria-label={`Copiar ${rotulo}`} title={ok ? "Copiado" : `Copiar ${rotulo}`}
      onClick={() => { void navigator.clipboard?.writeText(texto).then(() => { setOk(true); window.setTimeout(() => setOk(false), 1400); }).catch(() => {}); }}>
      {ok ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
    </button>
  );
}

/** Um bloco da ficha que abre e fecha; o resumo fica visível mesmo fechado. */
function Painel({ titulo, Icone, resumo, tom, aberto = true, children }: { titulo: string; Icone: LucideIcon; resumo?: string; tom?: "ok" | "alerta" | "ruim"; aberto?: boolean; children: ReactNode }) {
  return (
    <details className={`fc-painel${tom ? ` ${tom}` : ""}`} open={aberto}>
      <summary>
        <span className="fc-painel-icone" aria-hidden="true"><Icone size={15} /></span>
        <h3>{titulo}</h3>
        {resumo ? <span className="fc-painel-resumo">{resumo}</span> : null}
        <ChevronDown size={15} className="fc-seta" aria-hidden="true" />
      </summary>
      <div className="fc-painel-corpo">{children}</div>
    </details>
  );
}

const Linha = ({ rotulo, children }: { rotulo: string; children: ReactNode }) => <div className="fc-linha"><dt>{rotulo}</dt><dd>{children}</dd></div>;

type Aviso = { tom: "ok" | "alerta" | "ruim" | "info"; Icone: LucideIcon; texto: string };
function avisosDo(c: ClienteLigacao): Aviso[] {
  const a: Aviso[] = [];
  if (c.conexao && !c.conexao.online) a.push({ tom: "ruim", Icone: WifiOff, texto: `Sem conexão (${c.conexao.status || "offline"})` });
  if (c.financeiro && c.financeiro.emAberto > 0) a.push({ tom: "ruim", Icone: Wallet, texto: `${moeda(c.financeiro.emAberto)} em aberto` });
  if (c.historico?.visitaAgendada) a.push({ tom: "info", Icone: CalendarClock, texto: `Visita ${dataCurta(c.historico.visitaAgendada.data).slice(0, 5)}` });
  if (/suspen|bloque/i.test(c.situacao)) a.push({ tom: "alerta", Icone: AlertTriangle, texto: c.situacao });
  if ((c.historico?.ultimos30Dias ?? 0) >= 3) a.push({ tom: "alerta", Icone: Repeat, texto: `${c.historico!.ultimos30Dias} chamados em 30 dias` });
  return a;
}

function CartaoCliente({ c, outros }: { c: ClienteLigacao; outros?: string[] }) {
  const h = c.historico;
  const abertos = h ? h.abertos : (c.chamados ?? []).filter((x) => !encerrado(x.status)).length;
  const sit = /ativo/i.test(c.situacao) && !/inativ/i.test(c.situacao) ? "ok" : /suspen|bloque/i.test(c.situacao) ? "alerta" : c.situacao ? "ruim" : "";
  const avisos = avisosDo(c);
  const e = c.endereco, f = c.financeiro, cx = c.conexao;
  const enderecoTexto = e ? [e.linha, e.complemento, e.bairro, [e.cidade, e.uf].filter(Boolean).join("/"), e.cep && `CEP ${e.cep}`].filter(Boolean).join(" · ") : "";
  const mapa = e?.coordenadas ? `https://www.google.com/maps?q=${e.coordenadas.lat},${e.coordenadas.lng}` : enderecoTexto ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoTexto)}` : "";
  const nota = c.ultimaAvaliacao;
  return (
    <div className="fc-cliente">
      <section className="fc-quem" aria-label="Cliente">
        <span className="fc-monograma" aria-hidden="true">{(nomeBonito(c.nome).match(/\p{L}/u)?.[0] ?? "#").toUpperCase()}</span>
        <div>
          <h2>{nomeBonito(c.nome) || `Contrato ${c.contrato}`}</h2>
          <div className="fc-chips">
            {c.situacao ? <span className={`fc-chip ${sit}`}>{c.situacao}</span> : null}
            <span className="fc-chip" title={c.contratos && c.contratos.length > 1 ? `Contratos: ${c.contratos.join(", ")}` : undefined}>Contrato {c.contrato}{c.contratos && c.contratos.length > 1 ? ` +${c.contratos.length - 1}` : ""}</span>
            {c.clienteDesde ? <span className="fc-chip">Cliente desde {mesAno(c.clienteDesde)}</span> : null}
            {c.plano ? <span className="fc-chip">{c.plano}</span> : null}
            {c.planoTv ? <span className="fc-chip">{c.planoTv}</span> : null}
            {c.pop ? <span className="fc-chip">{c.pop}</span> : null}
            {c.documento ? <span className="fc-chip" title="Documento (parcial)">{c.documento}</span> : null}
          </div>
        </div>
      </section>
      {outros ? <p className="fc-atencao">Este número está em {outros.length} contratos de clientes diferentes. Confirme com quem está falando.</p> : null}

      {avisos.length ? (
        <ul className="fc-avisos" aria-label="Pontos de atenção">
          {avisos.map((a) => <li key={a.texto} className={a.tom}><a.Icone size={14} aria-hidden="true" />{a.texto}</li>)}
        </ul>
      ) : null}
      {c.motivoStatus ? <p className="fc-atencao">Motivo do status: {c.motivoStatus}</p> : null}

      {cx ? (
        <Painel titulo="Conexão" Icone={cx.online ? Wifi : WifiOff} resumo={cx.online ? "Online" : cx.status || "Offline"} tom={cx.online ? "ok" : "ruim"}>
          <div className="fc-conexao">
            {cx.sinalOnuDbm !== null ? (
              <div className={`fc-dbm ${qualidadeSinal(cx.sinalOnuDbm)}`}>
                <strong>{String(cx.sinalOnuDbm).replace(".", ",")}<span> dBm</span></strong>
                <small>Sinal na ONU · {{ boa: "bom", media: "no limite", ruim: "fraco" }[qualidadeSinal(cx.sinalOnuDbm)]}</small>
              </div>
            ) : null}
            <dl>
              {cx.sinalOltDbm !== null ? <Linha rotulo="Sinal na OLT">{String(cx.sinalOltDbm).replace(".", ",")} dBm</Linha> : null}
              {cx.online && cx.onlineDesde ? <Linha rotulo="Online desde">{quando(cx.onlineDesde)}</Linha> : null}
              {cx.ultimaQueda ? <Linha rotulo="Última queda">{quando(cx.ultimaQueda)}</Linha> : null}
              {cx.modelo ? <Linha rotulo="Equipamento">{cx.modelo}</Linha> : null}
              {cx.olt ? <Linha rotulo="OLT / porta">{cx.olt}{cx.porta ? ` · ${cx.porta}` : ""}</Linha> : null}
            </dl>
          </div>
        </Painel>
      ) : null}

      {f ? (
        <Painel titulo="Financeiro" Icone={Wallet} resumo={f.emAberto > 0 ? `${moeda(f.emAberto)} em aberto` : "Em dia"} tom={f.emAberto > 0 ? "ruim" : "ok"}>
          <dl>
            <Linha rotulo="Em aberto"><b className={f.emAberto > 0 ? "ruim" : "ok"}>{moeda(f.emAberto)}</b></Linha>
            <Linha rotulo="Faturas a receber">{f.titulosAReceber}</Linha>
            {f.vencimentoDia ? <Linha rotulo="Vencimento">todo dia {f.vencimentoDia}</Linha> : null}
            {f.promessasMes ? <Linha rotulo="Promessas de pagamento no mês">{f.promessasMes}</Linha> : null}
            {f.isento ? <Linha rotulo="Cobrança">Isento</Linha> : null}
          </dl>
        </Painel>
      ) : null}

      {e && enderecoTexto ? (
        <Painel titulo="Endereço" Icone={MapPin} resumo={[e.bairro, e.cidade].filter(Boolean).join(", ")}>
          <p className="fc-endereco">{e.linha}{e.complemento ? `, ${e.complemento}` : ""}<br />{[e.bairro, [e.cidade, e.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")}{e.cep ? <><br />CEP {e.cep}</> : null}</p>
          {e.referencia ? <p className="fc-ref">Referência: {e.referencia}</p> : null}
          <div className="fc-acoes">
            <Copiar texto={enderecoTexto} rotulo="endereço" />
            {mapa ? <a href={mapa} target="_blank" rel="noreferrer"><ExternalLink size={13} aria-hidden="true" /> Abrir no mapa</a> : null}
          </div>
        </Painel>
      ) : null}

      {h?.visitaAgendada ? (
        <Painel titulo="Visita agendada" Icone={CalendarClock} resumo={dataCurta(h.visitaAgendada.data)} tom="ok">
          <p className="fc-visita"><b>{dataCurta(h.visitaAgendada.data)}</b> · {diaSemana(h.visitaAgendada.data)}<small>{h.visitaAgendada.tipo || "Chamado"} · protocolo {h.visitaAgendada.protocolo}</small></p>
        </Painel>
      ) : null}

      {c.ultimaAvaliacao !== undefined ? (
        <Painel titulo="Avaliações" Icone={Star} resumo={c.mediaAvaliacoes ? `média ${String(c.mediaAvaliacoes.media).replace(".", ",")}` : nota ? `${nota.nota}/5` : "sem avaliação"}>
          <div className="fc-nota">
            <Sinal nota={nota ? nota.nota : null} />
            <div>
              {nota ? (
                <>
                  <strong className={banda(nota.nota)}>{nota.nota}<span>/5</span></strong>
                  <small>Última avaliação, {dataCurta(nota.respondidoEm)}{nota.tecnico ? ` · técnico ${nota.tecnico}` : ""}</small>
                </>
              ) : <small>Ainda não avaliou o atendimento.</small>}
              {c.mediaAvaliacoes && c.mediaAvaliacoes.total > 1 ? <small>Média de {String(c.mediaAvaliacoes.media).replace(".", ",")} em {c.mediaAvaliacoes.total} avaliações</small> : null}
            </div>
            {nota?.comentario ? <blockquote>{nota.comentario}</blockquote> : null}
          </div>
        </Painel>
      ) : null}

      <Painel titulo="Chamados" Icone={ListChecks} resumo={c.totalChamados ? `${c.totalChamados} no total${abertos ? ` · ${abertos} ${abertos === 1 ? "aberto" : "abertos"}` : ""}` : undefined} tom={abertos ? "alerta" : undefined}>
        {h ? (
          <ul className="fc-numeros">
            <li><b>{h.ultimos30Dias}</b><span>nos últimos 30 dias</span></li>
            {h.tempoMedioDias !== null ? <li><b>{tempoMedio(h.tempoMedioDias)}</b><span>para resolver, em média</span></li> : null}
            {h.assuntoMaisComum ? <li><b>{h.assuntoMaisComum.tipo}</b><span>se repete ({h.assuntoMaisComum.vezes}×)</span></li> : null}
          </ul>
        ) : null}
        {c.chamados === null ? <p className="fc-vazio">Os chamados estão indisponíveis agora.</p> : c.chamados.length === 0 ? <p className="fc-vazio">Nenhum chamado registrado para este cliente.</p> : (
          <ol className="fc-linha-tempo">
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
      </Painel>

      {c.contatos?.length ? (
        <Painel titulo="Contatos" Icone={Contact} resumo={`${c.contatos.length}`}>
          <ul className="fc-contatos">
            {c.contatos.map((t) => (
              <li key={t.tipo + t.valor}>
                {t.tipo === "email" ? <Mail size={13} aria-hidden="true" /> : <Phone size={13} aria-hidden="true" />}
                <span>{t.tipo === "telefone" ? formatarTelefone(t.valor) : t.valor}</span>
                <Copiar texto={t.valor} rotulo={t.tipo === "email" ? "e-mail" : "telefone"} />
              </li>
            ))}
          </ul>
        </Painel>
      ) : null}

      {c.anotacoes?.length || c.etiquetas?.length ? (
        <Painel titulo="Observações do cadastro" Icone={StickyNote} resumo={`${(c.anotacoes?.length ?? 0) + (c.etiquetas?.length ?? 0)}`}>
          {c.etiquetas?.length ? <div className="fc-chips">{c.etiquetas.map((t) => <span key={t} className="fc-chip">{t}</span>)}</div> : null}
          {c.anotacoes?.length ? <ul className="fc-notas">{c.anotacoes.map((t, i) => <li key={i}>{t}</li>)}</ul> : null}
        </Painel>
      ) : null}
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
  useAparencia();
  const theme = usePreferences((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = "escuro";
    document.documentElement.dataset.anTheme = "dark";
    document.documentElement.style.colorScheme = "dark";
    document.documentElement.classList.add("ficha-janela");
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
