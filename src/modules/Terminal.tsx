import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Search, SquareTerminal, X, Pencil, Trash2, StickyNote, Plug, KeyRound, RefreshCw, FolderTree, Palette, Timer, Check } from "lucide-react";
import { clsx } from "clsx";
import { useSession, usePreferences } from "../stores/workspace";
import { TEMAS_TERMINAL, temaPorId, FONTE_MIN, FONTE_MAX } from "../services/terminalTemas";
import { Button } from "../components/ui/button";
import BotaoDestacar from "../components/BotaoDestacar";
import { api, errorMessage } from "../services/api";
import { mensagemLimpa, lerEnderecoRapido, portaPadrao, ANTI_IDLE_PADRAO, MODOS_ANTI_IDLE, type AntiIdle, type EquipamentoForm, type EquipamentoTerminal, type ProtocoloTerminal } from "../services/terminal";
import { abrirSessao, aplicarAparencia, ativarSessao, definirAntiIdle, fecharSessao, useSessoesTerminal, type Sessao } from "../services/terminalSessoes";

const vazio = (): EquipamentoForm => ({ nome: "", grupo: "", protocolo: "ssh", host: "", porta: 22, usuario: "", senha: "", guardarSenha: false, antiIdle: true, antiIdleSegundos: 60, antiIdleModo: "nulo" });

/** Terminal SSH/Telnet dentro do Workspace: lista de equipamentos à esquerda e sessões em abas. */
export default function Terminal({ active }: { active: boolean }) {
  const usuario = useSession((s) => s.user);
  const dono = String(usuario?.id ?? "");
  // A lista é central (mantida no Admin > Terminal): todos conectam; só administradores criam, editam e apagam.
  const admin = usuario?.perfil === "admin";
  const [obs, setObs] = useState<{ eq: EquipamentoTerminal; texto: string } | null>(null);
  const { sessoes, ativa } = useSessoesTerminal();
  const [central, setCentral] = useState<EquipamentoTerminal[]>([]);
  const [locais, setLocais] = useState<EquipamentoTerminal[]>([]);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const token = useSession((s) => s.token);
  const [busca, setBusca] = useState("");
  const [rapido, setRapido] = useState("");
  const [erro, setErro] = useState("");
  const [edicao, setEdicao] = useState<EquipamentoForm | null>(null);
  const { terminalTema, terminalFonte, setTerminalTema, setTerminalFonte } = usePreferences();
  const [menu, setMenu] = useState<null | "tema" | "antiidle">(null);
  useEffect(() => { aplicarAparencia(terminalTema, terminalFonte); }, [terminalTema, terminalFonte]);
  const [pedirSenha, setPedirSenha] = useState<{ titulo: string; confirmar: (senha?: string) => void } | null>(null);

  const carregar = async () => {
    try { setCentral((await api.get<{ equipamentos: EquipamentoTerminal[] }>("/terminal/equipamentos")).data.equipamentos); } catch (e) { setErro(errorMessage(e)); }
    // Equipamentos salvos só neste computador (como era antes da lista central): continuam aparecendo e conectando.
    try { setLocais(await window.desktop!.terminalListar(dono)); } catch { setLocais([]); }
  };
  // Os locais que já existem na lista central (mesmo nome, endereço e porta) somem da lista: já foram enviados.
  const equipamentos = useMemo(() => {
    const chave = (e: EquipamentoTerminal) => `${e.nome}|${e.host}|${e.porta}`.toLowerCase();
    const jaNaCentral = new Set(central.map(chave));
    return [...central, ...locais.filter((e) => !jaNaCentral.has(chave(e))).map((e) => ({ ...e, local: true }))];
  }, [central, locais]);
  const soLocais = equipamentos.filter((e) => e.local);
  const enviarLocais = async () => {
    setEnviando(true); setAviso("");
    try {
      const r = await window.desktop!.terminalImportarLocais({ dono, token: token || undefined });
      setAviso(`Enviado para a lista de todos: ${r.novos} novo(s), ${r.atualizados} atualizado(s), ${r.ignorados} ignorado(s) (de ${r.total} encontrados).`);
      await carregar();
    } catch (e) { setAviso(`Não foi possível enviar: ${mensagemLimpa(e)}`); }
    finally { setEnviando(false); }
  };
  useEffect(() => { if (dono && window.desktop) void carregar(); }, [dono]);
  // A lista central muda por outros administradores: recarrega a cada 20 s e ao voltar para a janela.
  const recarregar = useRef(carregar);
  recarregar.current = carregar;
  useEffect(() => {
    if (!dono || !window.desktop) return;
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void recarregar.current(); }, 20_000);
    const aoVoltar = () => void recarregar.current();
    window.addEventListener("focus", aoVoltar);
    return () => { window.clearInterval(t); window.removeEventListener("focus", aoVoltar); };
  }, [dono]);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = equipamentos.filter((e) => !q || `${e.nome} ${e.host} ${e.grupo} ${e.observacao ?? ""}`.toLowerCase().includes(q));
    const mapa = new Map<string, EquipamentoTerminal[]>();
    for (const e of filtrados) mapa.set(e.grupo || "Sem pasta", [...(mapa.get(e.grupo || "Sem pasta") ?? []), e]);
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [equipamentos, busca]);

  const conectar = (e: EquipamentoTerminal) => {
    const abrir = (senha?: string) => void abrirSessao(dono, e.nome, `${e.usuario ? e.usuario + "@" : ""}${e.host}:${e.porta}`, { equipamentoId: e.id }, senha, undefined, { ativo: e.antiIdle, segundos: e.antiIdleSegundos, modo: e.antiIdleModo });
    if (e.protocolo === "ssh" && !e.temSenha) setPedirSenha({ titulo: `Senha de ${e.usuario || "acesso"} em ${e.nome}`, confirmar: abrir });
    else abrir();
  };
  const conectarRapido = () => {
    const r = lerEnderecoRapido(rapido);
    if (!r) { setErro("Endereço inválido. Exemplos: 10.0.0.1, admin@10.0.0.1:2222, telnet://10.0.0.1"); return; }
    setErro("");
    const abrir = (senha?: string) => {
      void abrirSessao(dono, r.host, `${r.usuario ? r.usuario + "@" : ""}${r.host}:${r.porta}`, { rapido: r }, senha, undefined, ANTI_IDLE_PADRAO);
      setRapido("");
    };
    if (r.protocolo === "ssh") setPedirSenha({ titulo: `Senha de ${r.usuario || "acesso"} em ${r.host}`, confirmar: abrir });
    else abrir();
  };
  const reconectar = (s: Sessao) => {
    const e = s.origem.equipamentoId ? equipamentos.find((i) => i.id === s.origem.equipamentoId) : undefined;
    const refazer = (senha?: string) => void abrirSessao(dono, s.titulo, s.detalhe, s.origem, senha, s.id, s.antiIdle);
    const ssh = e ? e.protocolo === "ssh" && !e.temSenha : s.origem.rapido?.protocolo === "ssh";
    if (ssh) setPedirSenha({ titulo: `Senha para reconectar em ${s.titulo}`, confirmar: refazer });
    else refazer();
  };
  const salvar = async () => {
    if (!edicao) return;
    try {
      setErro("");
      // temSenha é só de leitura (vem do servidor); o esquema estrito do salvar recusa chaves desconhecidas.
      const { temSenha: _temSenha, ...dados } = edicao as EquipamentoForm & { temSenha?: boolean };
      const { id, ...corpo } = dados;
      const envio = { ...corpo, senha: edicao.senha || undefined };
      if (id) await api.put(`/admin/terminal/${encodeURIComponent(id)}`, envio); else await api.post("/admin/terminal", envio);
      setEdicao(null);
      await carregar();
    } catch (e) { setErro(errorMessage(e)); }
  };
  const excluir = async (e: EquipamentoTerminal) => {
    const texto = e.local
      ? `Excluir "${e.nome}" só deste computador? A lista de todos e os outros computadores não são afetados.`
      : `Excluir "${e.nome}" da lista de TODOS? A senha guardada também será apagada.`;
    if (!window.confirm(texto)) return;
    try {
      if (e.local) await window.desktop!.terminalExcluir({ dono, id: e.id });
      else await api.delete(`/admin/terminal/${encodeURIComponent(e.id)}`);
      await carregar();
    } catch (x) { setErro(errorMessage(x)); }
  };
  const salvarObs = async () => {
    if (!obs) return;
    try {
      await api.put(`/terminal/equipamentos/${encodeURIComponent(obs.eq.id)}/observacao`, { texto: obs.texto });
      setObs(null);
      await carregar();
    } catch (x) { setErro(errorMessage(x)); }
  };

  if (!window.desktop) return <div className="term-vazio"><SquareTerminal size={28} /><p>O terminal só funciona no aplicativo do Workspace para Windows.</p></div>;
  const atual = sessoes.find((s) => s.id === ativa);

  return (
    <div className="term" style={{ "--term-fundo": temaPorId(terminalTema).tema.background, "--term-texto": temaPorId(terminalTema).tema.foreground } as React.CSSProperties}>
      <aside className="term-lista">
        <div className="term-lista-topo">
          <label className="term-busca"><Search size={15} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar equipamento" aria-label="Buscar equipamento" /></label>
          {admin ? <Button size="sm" onClick={() => setEdicao(vazio())} title="Adicionar equipamento"><Plus size={15} />Novo</Button> : null}
        </div>
        {soLocais.length ? (
          <div className="term-aviso-local" role="status">
            <b>{soLocais.length} equipamento(s) salvos só neste computador.</b>
            {admin ? <><span> Eles continuam funcionando aqui. Envie para a lista de todos:</span> <Button size="sm" disabled={enviando} onClick={() => void enviarLocais()}>{enviando ? "Enviando…" : "Enviar para todos"}</Button></> : <span> Eles continuam funcionando aqui; peça a um administrador para incluí-los na lista de todos.</span>}
          </div>
        ) : null}
        {aviso ? <p className="muted term-dica" role="status">{aviso}</p> : null}
        <div className="term-lista-corpo">
          {!equipamentos.length ? <p className="muted term-dica">{admin ? "Nenhum equipamento na lista. Use “Novo”, importe em Administração > Terminal ou use a conexão rápida." : "Nenhum equipamento na lista. Fale com o administrador ou use a conexão rápida."}</p> : null}
          {grupos.map(([grupo, itens]) => (
            <div key={grupo} className="term-grupo">
              <div className="term-grupo-nome"><FolderTree size={13} />{grupo}</div>
              {itens.map((e) => (
                <div key={e.id} className="term-equip">
                  <button type="button" className="term-equip-abrir" onDoubleClick={() => conectar(e)} onClick={() => conectar(e)} title={`Conectar em ${e.host}:${e.porta}`}>
                    <Plug size={14} /><span><b>{e.nome}</b><small>{e.protocolo.toUpperCase()} · {e.host}{e.local ? " · só neste PC" : ""}</small>{e.observacao ? <small className="term-obs">{e.observacao}</small> : null}</span>
                  </button>
                  {!e.local ? <button type="button" aria-label={`Observação de ${e.nome}`} title={e.observacao ? "Editar observação" : "Adicionar observação"} onClick={() => setObs({ eq: e, texto: e.observacao ?? "" })}><StickyNote size={13} /></button> : null}
                  {admin && !e.local ? <button type="button" aria-label={`Editar ${e.nome}`} title="Editar" onClick={() => setEdicao({ ...e, senha: "", guardarSenha: e.temSenha })}><Pencil size={13} /></button> : null}
                  {admin ? <button type="button" aria-label={`Excluir ${e.nome}`} title={e.local ? "Excluir só deste computador" : "Excluir da lista de todos"} onClick={() => void excluir(e)}><Trash2 size={13} /></button> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <section className="term-principal">
        <div className="term-barra">
          <div className="term-abas" role="tablist">
            {sessoes.map((s) => (
              <div key={s.id} role="tab" aria-selected={s.id === ativa} className={clsx("term-aba", s.id === ativa && "ativa")} onClick={() => ativarSessao(s.id)} title={s.detalhe}>
                <i className={clsx("term-ponto", s.estado)} aria-hidden="true" />
                <span>{s.titulo}</span>
                <button type="button" aria-label={`Fechar ${s.titulo}`} onClick={(e) => { e.stopPropagation(); fecharSessao(s.id); }}><X size={13} /></button>
              </div>
            ))}
          </div>
          <div className="term-ferramentas">
            <BotaoDestacar kind="terminal" />
            <button type="button" className={clsx("term-ico", atual?.antiIdle.ativo && "ligado")} disabled={!atual} aria-label="Anti-idle" title={atual ? (atual.antiIdle.ativo ? `Anti-idle ligado (a cada ${atual.antiIdle.segundos} s)` : "Anti-idle desligado") : "Abra uma sessão para usar o anti-idle"} onClick={() => setMenu(menu === "antiidle" ? null : "antiidle")}><Timer size={16} /></button>
            <button type="button" className="term-ico" aria-label="Temas e letra" title="Temas e tamanho da letra" onClick={() => setMenu(menu === "tema" ? null : "tema")}><Palette size={16} /></button>
          </div>
          <form className="term-rapido" onSubmit={(e) => { e.preventDefault(); conectarRapido(); }}>
            <input value={rapido} onChange={(e) => setRapido(e.target.value)} placeholder="Conexão rápida: usuario@10.0.0.1:22" aria-label="Conexão rápida" />
            <Button type="submit" size="sm" disabled={!rapido.trim()}>Conectar</Button>
          </form>
        </div>
        {erro && !edicao ? <p className="term-erro" role="alert">{erro}</p> : null}
        <TelaSessoes sessoes={sessoes} ativa={ativa} visivel={active} fundo={temaPorId(terminalTema).tema.background} />
        {!atual ? (
          <div className="term-vazio"><SquareTerminal size={32} /><p>Escolha um equipamento na lista ou digite um endereço na conexão rápida.</p></div>
        ) : atual.estado === "fechado" || atual.estado === "erro" ? (
          <div className="term-reconectar"><Button size="sm" onClick={() => reconectar(atual)}><RefreshCw size={14} />Reconectar</Button></div>
        ) : null}
      </section>
      {menu === "tema" ? (
        <div className="term-menu" role="dialog" aria-label="Temas e letra">
          <strong>Tema</strong>
          <div className="term-temas">
            {TEMAS_TERMINAL.map((t) => (
              <button key={t.id} type="button" className="term-tema" aria-pressed={terminalTema === t.id} onClick={() => setTerminalTema(t.id)}>
                <i style={{ background: t.tema.background, color: t.tema.foreground }}>Aa</i>
                <span>{t.nome}</span>
                {terminalTema === t.id ? <Check size={14} /> : null}
              </button>
            ))}
          </div>
          <strong>Tamanho da letra</strong>
          <div className="term-fonte">
            <button type="button" aria-label="Diminuir letra" disabled={terminalFonte <= FONTE_MIN} onClick={() => setTerminalFonte(terminalFonte - 1)}><Minus size={14} /></button>
            <span>{terminalFonte} px</span>
            <button type="button" aria-label="Aumentar letra" disabled={terminalFonte >= FONTE_MAX} onClick={() => setTerminalFonte(terminalFonte + 1)}><Plus size={14} /></button>
          </div>
          <small className="muted">Vale para todas as abas e fica guardado neste computador.</small>
        </div>
      ) : null}
      {menu === "antiidle" && atual ? (
        <div className="term-menu" role="dialog" aria-label="Anti-idle">
          <strong>Anti-idle (anti-AFK)</strong>
          <small className="muted">Evita que o equipamento derrube a sessão por inatividade: se você ficar sem digitar, o Workspace envia um sinal discreto.</small>
          <label className="term-check"><input type="checkbox" checked={atual.antiIdle.ativo} onChange={(e) => void definirAntiIdle(atual.id, { ...atual.antiIdle, ativo: e.target.checked })} />Ligado nesta sessão</label>
          <label>Enviar depois de
            <select value={atual.antiIdle.segundos} onChange={(e) => void definirAntiIdle(atual.id, { ...atual.antiIdle, segundos: Number(e.target.value) })}>
              {[15, 30, 60, 120, 180, 300, 600].map((n) => <option key={n} value={n}>{n < 60 ? `${n} segundos` : `${n / 60} min`}</option>)}
            </select>
          </label>
          <label>O que enviar
            <select value={atual.antiIdle.modo} onChange={(e) => void definirAntiIdle(atual.id, { ...atual.antiIdle, modo: e.target.value as AntiIdle["modo"] })}>
              {MODOS_ANTI_IDLE.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </label>
          <small className="muted">{MODOS_ANTI_IDLE.find((m) => m.id === atual.antiIdle.modo)?.dica}</small>
        </div>
      ) : null}
      {edicao ? (
        <div className="term-modal" role="dialog" aria-modal="true" aria-label="Equipamento">
          <form className="term-form" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
            <h3>{edicao.id ? "Editar equipamento" : "Novo equipamento"}</h3>
            <label>Nome<input required value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} placeholder="OLT Centro" autoFocus /></label>
            <label>Pasta (opcional)<input value={edicao.grupo} onChange={(e) => setEdicao({ ...edicao, grupo: e.target.value })} placeholder="OLTs" /></label>
            <div className="term-form-linha">
              <label>Protocolo
                <select value={edicao.protocolo} onChange={(e) => { const protocolo = e.target.value as ProtocoloTerminal; setEdicao({ ...edicao, protocolo, porta: portaPadrao(protocolo), guardarSenha: protocolo === "ssh" && edicao.guardarSenha }); }}>
                  <option value="ssh">SSH</option>
                  <option value="telnet">Telnet</option>
                </select>
              </label>
              <label>Porta<input type="number" min={1} max={65535} required value={edicao.porta} onChange={(e) => setEdicao({ ...edicao, porta: Number(e.target.value) })} /></label>
            </div>
            <label>Endereço (IP ou nome)<input required value={edicao.host} onChange={(e) => setEdicao({ ...edicao, host: e.target.value })} placeholder="10.0.0.1" /></label>
            <label>Usuário<input value={edicao.usuario} onChange={(e) => setEdicao({ ...edicao, usuario: e.target.value })} autoComplete="off" /></label>
            {edicao.protocolo === "ssh" ? (
              <>
                <label className="term-check"><input type="checkbox" checked={edicao.guardarSenha} onChange={(e) => setEdicao({ ...edicao, guardarSenha: e.target.checked })} />Guardar a senha neste computador (cifrada pelo Windows)</label>
                {edicao.guardarSenha ? <label>Senha<input type="password" value={edicao.senha ?? ""} onChange={(e) => setEdicao({ ...edicao, senha: e.target.value })} placeholder={edicao.id ? "Deixe em branco para manter a atual" : ""} autoComplete="new-password" /></label> : <small className="muted">Sem guardar, a senha é pedida a cada conexão.</small>}
              </>
            ) : <small className="muted">No Telnet a senha é digitada no próprio terminal e nunca é guardada.</small>}
            <fieldset className="term-antiidle">
              <label className="term-check"><input type="checkbox" checked={edicao.antiIdle} onChange={(e) => setEdicao({ ...edicao, antiIdle: e.target.checked })} />Anti-idle: não deixar a sessão cair por inatividade</label>
              {edicao.antiIdle ? (
                <div className="term-form-linha">
                  <label>Depois de (segundos)<input type="number" min={10} max={3600} value={edicao.antiIdleSegundos} onChange={(e) => setEdicao({ ...edicao, antiIdleSegundos: Math.min(3600, Math.max(10, Number(e.target.value) || 60)) })} /></label>
                  <label>Enviar
                    <select value={edicao.antiIdleModo} onChange={(e) => setEdicao({ ...edicao, antiIdleModo: e.target.value as AntiIdle["modo"] })}>
                      {MODOS_ANTI_IDLE.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  </label>
                </div>
              ) : null}
            </fieldset>
            {erro ? <p className="term-erro" role="alert">{erro}</p> : null}
            <div className="term-form-acoes">
              {edicao.id ? <Button type="button" variant="ghost" size="sm" onClick={() => void window.desktop!.terminalEsquecerChave({ host: edicao.host, porta: edicao.porta }).then(() => setErro("Chave do servidor esquecida; a próxima conexão guarda a nova."))} title="Use depois de trocar o equipamento">Esquecer chave do servidor</Button> : <span />}
              <span>
                <Button type="button" variant="outline" onClick={() => { setEdicao(null); setErro(""); }}>Cancelar</Button>{" "}
                <Button type="submit">Salvar</Button>
              </span>
            </div>
          </form>
        </div>
      ) : null}
      {obs ? (
        <div className="term-modal" role="dialog" aria-modal="true" aria-label="Observação">
          <form className="term-form" onSubmit={(e) => { e.preventDefault(); void salvarObs(); }}>
            <h3><StickyNote size={16} /> Observação · {obs.eq.nome}</h3>
            <label>Só você vê esta anotação (um nome, um lembrete)<input value={obs.texto} maxLength={300} onChange={(e) => setObs({ ...obs, texto: e.target.value })} placeholder="Ex.: OLT do Centro" autoFocus /></label>
            <div className="term-form-acoes"><span /><span><Button type="button" variant="outline" onClick={() => setObs(null)}>Cancelar</Button>{" "}<Button type="submit">Salvar</Button></span></div>
          </form>
        </div>
      ) : null}
      {pedirSenha ? <PedidoSenha titulo={pedirSenha.titulo} onCancelar={() => setPedirSenha(null)} onConfirmar={(s) => { const f = pedirSenha.confirmar; setPedirSenha(null); f(s || undefined); }} /> : null}
    </div>
  );
}

function PedidoSenha({ titulo, onCancelar, onConfirmar }: { titulo: string; onCancelar: () => void; onConfirmar: (senha: string) => void }) {
  const [senha, setSenha] = useState("");
  return (
    <div className="term-modal" role="dialog" aria-modal="true" aria-label="Senha">
      <form className="term-form" onSubmit={(e) => { e.preventDefault(); onConfirmar(senha); }}>
        <h3><KeyRound size={16} /> {titulo}</h3>
        <label>Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus autoComplete="off" /></label>
        <div className="term-form-acoes"><span /><span><Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>{" "}<Button type="submit">Conectar</Button></span></div>
      </form>
    </div>
  );
}

/** Mantém o elemento do xterm de cada sessão dentro da área e ajusta o tamanho ao espaço disponível. */
function TelaSessoes({ sessoes, ativa, visivel, fundo }: { sessoes: Sessao[]; ativa: string | null; visivel: boolean; fundo?: string }) {
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const raiz = area.current;
    if (!raiz) return;
    for (const s of sessoes) {
      if (s.el.parentElement !== raiz) raiz.appendChild(s.el);
      s.el.style.display = s.id === ativa && visivel ? "block" : "none";
    }
    const atual = sessoes.find((s) => s.id === ativa);
    const ajustar = () => { if (atual && visivel) { try { atual.fit.fit(); } catch { /* sem tamanho ainda */ } } };
    ajustar();
    if (atual && visivel) atual.term.focus();
    const obs = new ResizeObserver(ajustar);
    obs.observe(raiz);
    return () => obs.disconnect();
  }, [sessoes, ativa, visivel]);
  return <div className="term-area" ref={area} hidden={!sessoes.length} style={fundo ? { background: fundo } : undefined} />;
}
