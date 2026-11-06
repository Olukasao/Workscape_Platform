import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as TeclaEvento, type PointerEvent } from "react";
import { BellOff, Copy, Delete, Grid3x3, Mic, MicOff, Pause, Phone, PhoneCall, PhoneForwarded, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Play, X, ExternalLink } from "lucide-react";
import type { PhoneCall as Chamada } from "../../electron/phone";
import { useTelefone } from "../stores/telefone";
import { definirNaoPerturbe, iniciarTelefone, marcarVistas, observarTelefone, useNiveis, usePerdidasNovas, usePhone } from "../stores/phone";
import { useNomesPorRamal } from "../services/ramais";
import { iniciais, identificarChamador, nivelParaAnel } from "../services/chamador";
import { duracaoCurta, foiPerdida, rotuloDaChamada, type ChamadaRecente } from "../services/chamadasRecentes";
import { useSession } from "../stores/workspace";
import { useArrastar } from "./useArrastar";
import { numeroDeSaida } from "../../electron/prefixoSaida";
import { JANELA_DESTACADA, destacar, podeDestacar, useDestacada } from "../services/janelaDestacada";

const TECLAS = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
];
const LARGURA = 320;
const ALTURA = 520;
// O tamanho do telefone é uma escala: o cartão inteiro (teclas, textos, botões) cresce ou encolhe junto.
const ESCALA_MIN = 0.8;
const ESCALA_MAX = 1.7;
const CHAVE_ESCALA = "workspace:telefone:escala";
const limitarEscala = (v: number) => Math.round(Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, v)) * 100) / 100;
const escalaSalva = () => {
  try { const v = Number(localStorage.getItem(CHAVE_ESCALA)); return v >= ESCALA_MIN && v <= ESCALA_MAX ? v : 1; } catch { return 1; }
};

/** Lista das últimas chamadas: toque numa linha para ligar de volta. */
function Recentes({ nomes, podeLigar, aoLigar }: { nomes: Map<string, string>; podeLigar: boolean; aoLigar: (numero: string) => void }) {
  const recentes = usePhone((s) => s.recentes);
  // Clique no número abre as opções da linha: copiar ou ligar de novo (nada é discado sem a pessoa escolher).
  const [aberta, setAberta] = useState<number | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const copiar = async (id: number, numero: string) => {
    let ok = false;
    try { ok = (await window.desktop?.copyText?.(numero)) === true; } catch { /* tenta pelo navegador */ }
    if (!ok) { try { await navigator.clipboard.writeText(numero); ok = true; } catch { /* sem área de transferência */ } }
    if (ok) { setCopiado(id); window.setTimeout(() => setCopiado((v) => (v === id ? null : v)), 1800); }
  };
  const icone = (c: ChamadaRecente) =>
    foiPerdida(c) ? <PhoneMissed size={16} aria-hidden="true" />
    : c.resultado === "falhou" ? <PhoneOff size={16} aria-hidden="true" />
    : c.direcao === "out" ? <PhoneOutgoing size={16} aria-hidden="true" /> : <PhoneIncoming size={16} aria-hidden="true" />;
  const situacao = (c: ChamadaRecente) =>
    c.resultado === "atendida" ? duracaoCurta(c.duracaoSeg)
    : foiPerdida(c) ? "Perdida"
    : c.resultado === "rejeitada" ? "Recusada"
    : c.resultado === "falhou" ? "Não completou" : "Sem resposta";
  if (!recentes.length) return <p className="telefone-vazio">Nenhuma chamada ainda. As suas ligações aparecem aqui.</p>;
  return (
    <ul className="telefone-recentes" aria-label="Chamadas recentes">
      {recentes.slice(0, 30).map((c) => {
        const quem = identificarChamador(c.numero, "", nomes);
        const nome = quem.titulo;
        return (
          <li key={c.id}>
            <button type="button" className={foiPerdida(c) ? "perdida" : undefined} disabled={!c.numero} aria-expanded={aberta === c.id} onClick={() => setAberta(aberta === c.id ? null : c.id)}
              aria-label={`${nome}. ${foiPerdida(c) ? "Chamada perdida" : c.direcao === "in" ? "Recebida" : "Feita"} ${rotuloDaChamada(c.inicio)}. Abrir opções`}>
              <span className="telefone-recente-icone">{icone(c)}</span>
              <span className="telefone-recente-texto">
                <strong>{nome}</strong>
                <small>{quem.sub ? `${quem.sub} · ` : ""}{rotuloDaChamada(c.inicio)}{situacao(c) ? ` · ${situacao(c)}` : ""}</small>
              </span>
            </button>
            {aberta === c.id ? (
              <div className="telefone-recente-acoes" role="group" aria-label={`Opções para ${c.numero}`}>
                <span className="telefone-recente-numero">{c.numero}</span>
                <button type="button" onClick={() => void copiar(c.id, c.numero)}>
                  <Copy size={15} aria-hidden="true" />{copiado === c.id ? "Copiado!" : "Copiar número"}
                </button>
                <button type="button" className="ligar" disabled={!podeLigar} title={podeLigar ? undefined : "O telefone não está conectado"} onClick={() => { setAberta(null); aoLigar(c.numero); }}>
                  <PhoneCall size={15} aria-hidden="true" />Ligar novamente
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const hora = (seg: number) => `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;

/** Cronômetro da chamada: conta a partir do atendimento. */
function Cronometro({ desde }: { desde: number | null }) {
  const [, tic] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tic((n) => n + 1), 1000); return () => window.clearInterval(t); }, []);
  return <time>{desde ? hora(Math.max(0, Math.round((Date.now() - desde) / 1000))) : "00:00"}</time>;
}

/** Avatar com as iniciais de quem está na linha; o anel ao redor "respira" com a voz de quem fala do outro lado. */
function AvatarChamada({ titulo, ativo }: { titulo: string; ativo: boolean }) {
  const remoto = useNiveis((s) => s.remoto);
  const ini = iniciais(titulo);
  const voz = ativo ? nivelParaAnel(remoto) : 0;
  return (
    <div className="telefone-avatar" style={{ "--voz": voz.toFixed(2) } as React.CSSProperties} aria-hidden="true">
      {ini ? <span>{ini}</span> : <Phone size={30} strokeWidth={1.8} />}
    </div>
  );
}

const FILAS: [string, string][] = [["Suporte", "100001"], ["Financeiro", "10002"], ["Comercial", "10003"]];

/** Controles de uma ligação em andamento. A sessão SIP fica no processo principal: trocar de tela não derruba a chamada. */
function EmChamada({ chamada, equipe }: { chamada: Chamada; equipe: Map<string, string> }) {
  const [teclado, setTeclado] = useState(false);
  const [transferir, setTransferir] = useState(false);
  const [destino, setDestino] = useState("");
  const [aviso, setAviso] = useState("");
  const d = window.desktop;
  const executar = async (p: Promise<{ ok: boolean; erro?: string }> | undefined) => {
    const r = await p;
    setAviso(r && !r.ok ? r.erro || "Não foi possível executar." : "");
    return r?.ok;
  };
  const quem = identificarChamador(chamada.numero, chamada.nome, equipe);
  const estado = chamada.transferindo && !chamada.avisoTransferencia ? "Transferindo…" : chamada.estado === "chamando" ? "Chamando…" : chamada.espera ? "Em espera" : chamada.estado === "tocando" ? "Tocando" : null;
  return (
    <div className="telefone-chamada">
      <div className="telefone-chamada-quem">
        <AvatarChamada titulo={quem.externo ? "" : quem.titulo} ativo={chamada.estado === "conversando" && !chamada.espera} />
        <strong>{quem.titulo}</strong>
        {quem.sub ? <small>{quem.sub}</small> : null}
        <span className="telefone-chamada-estado" aria-live="polite">{estado ?? <Cronometro desde={chamada.atendidaMs} />}</span>
      </div>
      <div className="telefone-chamada-acoes" role="group" aria-label="Controles da chamada">
        <button type="button" aria-pressed={chamada.mudo} title={chamada.mudo ? "Ligar o microfone" : "Silenciar o microfone"} onClick={() => void executar(d?.phoneMute?.(chamada.id, !chamada.mudo))}>
          {chamada.mudo ? <MicOff size={19} aria-hidden="true" /> : <Mic size={19} aria-hidden="true" />}<span>Mudo</span>
        </button>
        <button type="button" aria-pressed={chamada.espera} title={chamada.espera ? "Retomar" : "Colocar em espera"} disabled={chamada.estado !== "conversando"} onClick={() => void executar(d?.phoneHold?.(chamada.id, !chamada.espera))}>
          {chamada.espera ? <Play size={19} aria-hidden="true" /> : <Pause size={19} aria-hidden="true" />}<span>{chamada.espera ? "Retomar" : "Espera"}</span>
        </button>
        <button type="button" aria-pressed={teclado} title="Teclado para URA (DTMF)" disabled={chamada.estado !== "conversando"} onClick={() => { setTeclado((v) => !v); setTransferir(false); }}>
          <Grid3x3 size={19} aria-hidden="true" /><span>Teclado</span>
        </button>
        <button type="button" aria-pressed={transferir} title="Transferir a chamada" disabled={chamada.estado !== "conversando"} onClick={() => { setTransferir((v) => !v); setTeclado(false); }}>
          <PhoneForwarded size={19} aria-hidden="true" /><span>Transferir</span>
        </button>
      </div>
      {teclado ? (
        <div className="telefone-teclas telefone-teclas-compacto">
          {TECLAS.map(([t]) => <button type="button" key={t} aria-label={`Tecla ${t}`} onClick={() => void executar(d?.phoneDtmf?.(chamada.id, t))}><b>{t}</b></button>)}
        </div>
      ) : null}
      {transferir ? (
        <>
        <div className="telefone-filas" role="group" aria-label="Transferir para a fila">
          {FILAS.map(([nome, ramal]) => (
            <button type="button" key={ramal} onClick={async () => { if (await executar(d?.phoneTransfer?.(chamada.id, ramal))) { setDestino(""); setTransferir(false); } }}>{nome}</button>
          ))}
        </div>
        <form className="telefone-transferir" onSubmit={async (e) => { e.preventDefault(); if (destino.trim() && (await executar(d?.phoneTransfer?.(chamada.id, destino.trim())))) { setDestino(""); setTransferir(false); } }}>
          <input type="tel" inputMode="tel" autoComplete="off" autoFocus aria-label="Ramal de destino" placeholder="Ramal de destino" value={destino} onChange={(e) => setDestino(e.target.value.replace(/[^0-9+*#]/g, ""))} />
          <button type="submit" disabled={!destino.trim()}>Transferir</button>
        </form>
        </>
      ) : null}
      {aviso || chamada.avisoTransferencia ? <p className="telefone-aviso" role="alert">{aviso || chamada.avisoTransferencia}</p> : null}
      <button type="button" className="telefone-desligar" onClick={() => void executar(d?.phoneHangup?.(chamada.id))}>
        <PhoneOff size={19} aria-hidden="true" />Desligar
      </button>
    </div>
  );
}

const RESUMO_REGISTRO: Record<string, string> = {
  registrado: "Conectado", registrando: "Conectando…", recusado: "Ramal recusado", falhou: "Sem conexão", desconectado: "Desconectado",
};

/** Card de vidro com o discador do Workscape Phone: a ligação sai pelo seu ramal, dentro do Workspace. Arrasta pelo topo. */
export default function TelefoneFlutuante() {
  // Na janela própria do telefone o cartão ocupa a janela inteira, sempre aberto, e cresce junto com ela.
  const embutido = JANELA_DESTACADA === "telefone";
  const emOutraJanela = useDestacada("telefone");
  const abertoLoja = useTelefone((s) => s.aberto);
  const aberto = embutido || (abertoLoja && !emOutraJanela);
  const fechar = useTelefone((s) => s.fechar);
  const user = useSession((s) => s.user);
  const token = useSession((s) => s.token);
  const phone = usePhone((s) => s.snapshot);
  const temRamal = usePhone((s) => s.temRamal);
  const erroTelefone = usePhone((s) => s.erro);
  const [numero, setNumero] = useState("");
  const [aviso, setAviso] = useState("");
  const [ligando, setLigando] = useState(false);
  const [aba, setAba] = useState<"teclado" | "recentes">("teclado");
  const [escala, setEscala] = useState(escalaSalva);
  const perdidasNovas = usePerdidasNovas();
  const nomes = useNomesPorRamal();
  const campo = useRef<HTMLInputElement>(null);
  const alca = useRef<{ x: number; y: number; escala: number } | null>(null);
  const card = useArrastar({
    chave: "workspace:telefone:posicao",
    tamanho: { w: LARGURA * escala, h: ALTURA * escala },
    padrao: () => ({ x: window.innerWidth - LARGURA * escala - 32, y: Math.max(72, window.innerHeight - ALTURA * escala - 32) }),
  });
  const mudarEscala = (v: number) => {
    const nova = limitarEscala(v);
    setEscala(nova);
    try { localStorage.setItem(CHAVE_ESCALA, String(nova)); } catch { /* vale só nesta sessão */ }
  };
  const ativa = phone.chamadas.find((c) => c.estado !== "encerrada" && !(c.direcao === "in" && c.estado === "tocando"));
  const pelaCentral = phone.registro === "registrado";
  // O motivo de não estar conectado: erro da conexão, ou a mensagem do motor.
  const motivo = pelaCentral ? "" : erroTelefone || phone.mensagem || (phone.registro === "registrando" ? "Conectando ao seu ramal…" : "");

  // Ao abrir com perdidas novas (por exemplo, pelo aviso da chamada perdida), já mostra a lista de recentes.
  useEffect(() => { if (aberto) setAba(perdidasNovas > 0 ? "recentes" : "teclado"); }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (aberto && aba === "recentes") marcarVistas(); }, [aberto, aba, perdidasNovas]);
  // Crescer o telefone perto da borda da tela não pode deixá-lo para fora.
  const { definir, posicao } = card;
  useEffect(() => { definir(posicao); }, [escala]); // eslint-disable-line react-hooks/exhaustive-deps
  // Pedido para abrir o telefone enquanto ele está em outra janela: leva essa janela para a frente.
  useEffect(() => {
    if (!embutido && emOutraJanela && abertoLoja) { destacar("telefone"); fechar(); }
  }, [embutido, emOutraJanela, abertoLoja, fechar]);
  useEffect(() => {
    if (!embutido) return;
    const ajustar = () => setEscala(limitarEscala(window.innerWidth / LARGURA));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [embutido]);

  useEffect(() => {
    if (!aberto) { setNumero(""); setAviso(""); return; }
    setAviso("");
    if (aba === "teclado") campo.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto, fechar, aba]);

  if (!user || !aberto) return null;

  const digitar = (t: string) => { setAviso(""); setNumero((n) => (n + t).slice(0, 30)); campo.current?.focus(); };
  const ligar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!numero.trim() || ligando || !pelaCentral || !window.desktop?.phoneCall) return;
    setLigando(true);
    const r = await window.desktop.phoneCall(numero.trim().replace(/[^0-9+*#]/g, ""));
    setLigando(false);
    if (!r.ok) setAviso(r.erro || "Não foi possível ligar.");
    else setNumero("");
  };
  const religar = async (n: string) => {
    if (!pelaCentral || !window.desktop?.phoneCall) return;
    setAviso("");
    const r = await window.desktop.phoneCall(n.replace(/[^0-9+*#]/g, ""));
    if (!r.ok) setAviso(r.erro || "Não foi possível ligar.");
  };
  const alcaDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    alca.current = { x: e.clientX, y: e.clientY, escala };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const alcaMove = (e: PointerEvent<HTMLButtonElement>) => {
    const a = alca.current;
    if (!a) return;
    // Arrastar o canto na diagonal: a média do que cresceu na largura e na altura.
    mudarEscala(a.escala + ((e.clientX - a.x) / LARGURA + (e.clientY - a.y) / ALTURA) / 2);
  };
  const alcaTecla = (e: TeclaEvento<HTMLButtonElement>) => {
    const passo = e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.05 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.05 : 0;
    if (passo) { e.preventDefault(); mudarEscala(escala + passo); }
    else if (e.key === "Home") { e.preventDefault(); mudarEscala(1); }
  };
  const alternarNaoPerturbe = async () => {
    const erro = await definirNaoPerturbe(!phone.naoPerturbe);
    if (erro) setAviso(erro);
  };
  const reconectar = () => { if (token) void iniciarTelefone(token, () => {}, true); };

  return (
    <div
      className={`telefone-card${card.arrastando ? " arrastando" : ""}${embutido ? " embutido" : ""}`}
      role="dialog"
      aria-label="Workscape Phone"
      style={embutido ? undefined : { left: card.posicao.x, top: card.posicao.y, width: LARGURA * escala }}
    >
      <div className="telefone-escala" style={{ zoom: escala, width: embutido ? undefined : LARGURA }}>
      <header {...(embutido ? {} : card.vincular)} title={embutido ? undefined : "Arraste para mover"}>
        <span className="telefone-card-icone"><Phone size={15} aria-hidden="true" /></span>
        <div className="telefone-titulo">
          <strong>Workscape Phone</strong>
          {temRamal || erroTelefone ? (
            <small className={`telefone-sub telefone-sub-${phone.registro}`} title={motivo || undefined}>
              {phone.ramal ? `Ramal ${phone.ramal} · ` : ""}{RESUMO_REGISTRO[phone.registro] ?? ""}
            </small>
          ) : null}
        </div>
        <span className="espaco" />
        {temRamal ? (
          <button type="button" className="telefone-dnd" aria-pressed={phone.naoPerturbe} aria-label="Não perturbe" title={phone.naoPerturbe ? "Não perturbe ligado: clique para voltar a receber chamadas" : "Não perturbe: as chamadas recebidas não tocam"} onClick={() => void alternarNaoPerturbe()}>
            <BellOff size={16} aria-hidden="true" />
          </button>
        ) : null}
        {!embutido && podeDestacar() ? (
          <button type="button" aria-label="Destacar" title="Abrir o telefone em uma janela separada, que pode ficar em outro monitor" onClick={() => { destacar("telefone"); fechar(); }}><ExternalLink size={16} /></button>
        ) : null}
        {!embutido ? <button type="button" aria-label="Fechar" title="Fechar (Esc)" onClick={fechar}><X size={16} /></button> : null}
      </header>
      {phone.naoPerturbe && temRamal ? (
        <div className="telefone-dnd-aviso" role="status">
          <BellOff size={15} aria-hidden="true" />
          <span>Não perturbe ligado: ninguém toca aqui. As chamadas ficam em Recentes como perdidas.</span>
          <button type="button" onClick={() => void alternarNaoPerturbe()}>Desligar</button>
        </div>
      ) : null}
      {motivo ? (
        <div className="telefone-motivo" role="status">
          <p>{motivo}</p>
          {phone.registro !== "registrando" && token ? <button type="button" onClick={reconectar}>Tentar conectar de novo</button> : null}
        </div>
      ) : null}
      {ativa ? <EmChamada chamada={ativa} equipe={nomes} /> : (
        <>
          <div className="telefone-abas" role="tablist" aria-label="Telefone">
            <button type="button" role="tab" aria-selected={aba === "teclado"} onClick={() => setAba("teclado")}>Teclado</button>
            <button type="button" role="tab" aria-selected={aba === "recentes"} onClick={() => setAba("recentes")}>
              Recentes
              {perdidasNovas > 0 && aba !== "recentes" ? <span className="telefone-abas-contador" aria-label={`${perdidasNovas} perdidas`}>{perdidasNovas > 9 ? "9+" : perdidasNovas}</span> : null}
            </button>
          </div>
          {aba === "recentes" ? <Recentes nomes={nomes} podeLigar={pelaCentral} aoLigar={(n) => void religar(n)} /> : (
          <form onSubmit={ligar}>
            <p className="telefone-zero" role="note">
              <span className="telefone-zero-marca" aria-hidden="true">0</span>
              {(() => {
                const limpo = numero.replace(/[^0-9+*#]/g, "");
                const saida = numeroDeSaida(limpo);
                return saida !== limpo ? <>Vai discar <b>{saida}</b></> : <>Já vem com 0: números de fora saem com 0 na frente, não digite.</>;
              })()}
            </p>
            <div className="telefone-visor">
              <input
                ref={campo}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                aria-label="Número para ligar"
                placeholder="Digite ou cole o número"
                value={numero}
                onChange={(e) => { setAviso(""); setNumero(e.target.value); }}
              />
              <button type="button" aria-label="Apagar" title="Apagar" disabled={!numero} onClick={() => { setNumero((n) => n.slice(0, -1)); campo.current?.focus(); }}>
                <Delete size={18} />
              </button>
            </div>
            <div className="telefone-teclas">
              {TECLAS.map(([t, letras]) => (
                <button type="button" key={t} onClick={() => digitar(t)} aria-label={t}>
                  <b>{t}</b>
                  {letras ? <small>{letras}</small> : null}
                </button>
              ))}
            </div>
            <button type="submit" className="telefone-ligar" disabled={!numero.trim() || ligando || !pelaCentral}>
              <PhoneCall size={19} aria-hidden="true" />
              {ligando ? "Ligando…" : "Ligar"}
            </button>
          </form>
          )}
          {aviso ? <p className="telefone-aviso" role="alert">{aviso}</p> : null}
        </>
      )}
      </div>
      {embutido ? null : <button
        type="button"
        className="telefone-alca"
        title="Arraste para mudar o tamanho (setas do teclado ajustam; duplo clique volta ao normal)"
        aria-label={`Tamanho do telefone: ${Math.round(escala * 100)}%. Use as setas para mudar.`}
        onPointerDown={alcaDown}
        onPointerMove={alcaMove}
        onPointerUp={() => { alca.current = null; }}
        onPointerCancel={() => { alca.current = null; }}
        onKeyDown={alcaTecla}
        onDoubleClick={() => mudarEscala(1)}
      />}
    </div>
  );
}

/** Conteúdo da janela própria do telefone: acompanha a sessão do processo principal e mostra o mesmo cartão. */
export function TelefoneJanela() {
  useEffect(() => {
    let parar: (() => void) | undefined;
    let fechado = false;
    void observarTelefone().then((p) => { if (fechado) p(); else parar = p; });
    return () => { fechado = true; parar?.(); };
  }, []);
  return <TelefoneFlutuante />;
}
