import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  Bot,
  Bug,
  CalendarDays,
  Globe,
  LoaderCircle,
  MessageSquare,
  Phone,
  ScrollText,
  Sparkles,
  StickyNote,
  Wrench,
  X,
} from "lucide-react";
import { api } from "../services/api";
import { socket } from "../services/socket";
import { useChatData, unreadCount } from "../services/data";
import { useDashboard } from "../services/dashboard";
import { groupTotal } from "../services/dashboardModel";
import { useSession } from "../stores/workspace";
import { useTelefone } from "../stores/telefone";
import { usePerdidasNovas, usePhone } from "../stores/phone";
import { textoPerdidas } from "../services/chamadasRecentes";
import { useAccess, allowedIds } from "../services/access";
import { Button } from "../components/ui/button";
import HomeHighlightsCarousel from "../legacy/components/HomeHighlightsCarousel";
import HomeBanner from "../legacy/components/HomeBanner";
import AgendaTecnicosCard from "../legacy/components/AgendaTecnicosCard";
import MassivoAlertCard from "../legacy/components/MassivoAlertCard";
import AvaliacaoDestaqueCard from "../components/AvaliacaoDestaqueCard";
import CcnaCompetitionHighlightCard from "../legacy/components/CcnaCompetitionHighlightCard";
import { NOVIDADES_MOTIONS } from "../legacy/data/novidades";
import { normalizeHomeBannerContent } from "../legacy/utils/homeBanner";
import { assistenteResumo, useAssistenteInternet } from "../services/assistenteNet";
import Markdown from "./assistente/Markdown";
import {
  hasAvisosInternosUpdate,
  markAvisosInternosAsSeen,
} from "../legacy/utils/avisosInternos";

const RECADO_DE_CHAMADO = /\b(los|lobi)\b|offline|rompimento|rompeu|agendamento\s+de\s+cliente|cliente\s+(com|sem|em)\b|sem\s+(sinal|acesso|conex[aã]o|internet)|queda\s+de\s+(sinal|fibra|energia)|fibra\s+(rompida|cortada)|massivo|atendimento\s+de\s+cliente/i;

// Mesma organização da Home do Chat Interno (ChatPage.jsx do chat-interno).
const MASSIVOS_DASHBOARD = [
  { id: "mrt", key: "BACKBONE GPON ACESSANET | MRT", label: "MRT" },
  { id: "das", key: "BACKBONE GPON ACESSANET | DAS", label: "DAS" },
  { id: "srp", key: "BACKBONE GPON ACESSANET | SRP", label: "SRP" },
  { id: "pv", key: "BACKBONE GPON ACESSANET | PV", label: "PV" },
  { id: "lrj", key: "BACKBONE GPON ACESSANET | LRJ", label: "LRJ" },
];
function useHomeData() {
  const user = useSession((s) => s.user);
  const enabled = !!user;
  const banner = useQuery({
    queryKey: ["home", "banner"],
    enabled,
    staleTime: 5 * 60000,
    queryFn: async () => normalizeHomeBannerContent((await api.get("/banner-home")).data),
  });
  const agenda = useQuery({
    queryKey: ["home", "agenda-resumo"],
    enabled,
    refetchInterval: 3 * 60000,
    queryFn: async () => (await api.get("/agenda-tecnicos/resumo")).data,
  });
  // O que ainda vai tocar hoje na tela de Lembretes; sem eles a Home segue normal.
  const lembretes = useQuery({
    queryKey: ["home", "lembretes"],
    enabled,
    refetchInterval: 5 * 60000,
    retry: false,
    queryFn: async () => (await api.get("/lembretes/hoje")).data?.lembretes || [],
  });
  const avisos = useQuery({
    queryKey: ["home", "avisos"],
    enabled,
    refetchInterval: 60000,
    queryFn: async () => (await api.get("/avisos-internos")).data,
  });
  const query = useQueryClient();
  // O chat publica o resumo da agenda em tempo real; usa o mesmo socket.
  useEffect(() => {
    const update = (data) => query.setQueryData(["home", "agenda-resumo"], data);
    socket.on("agenda-tecnicos:resumo", update);
    return () => {
      socket.off("agenda-tecnicos:resumo", update);
    };
  }, [query]);
  return { user, banner, agenda, avisos, lembretes };
}

function FeedbackModal({ user, onClose }) {
  const [form, setForm] = useState({
    nome: user?.nome || "",
    tipo: "bug",
    setor: user?.setor_nome || "",
    prioridade: "media",
    pagina: "/",
    descricao: "",
  });
  const [state, setState] = useState({ busy: false, error: "", ok: "" });
  const set = (k, v) => {
    setState((s) => ({ ...s, error: "", ok: "" }));
    setForm((f) => ({ ...f, [k]: v }));
  };
  const submit = async (e) => {
    e.preventDefault();
    const nome = form.nome.trim(),
      descricao = form.descricao.trim();
    if (!nome || !form.tipo || !descricao) {
      setState({ busy: false, error: "Preencha nome, tipo e descrição para enviar.", ok: "" });
      return;
    }
    setState({ busy: true, error: "", ok: "" });
    try {
      await api.post("/feedbacks", {
        nome,
        tipo: form.tipo,
        setor: form.setor.trim(),
        prioridade: form.prioridade,
        pagina: form.pagina.trim(),
        descricao,
      });
      setState({ busy: false, error: "", ok: "Feedback enviado com sucesso." });
      setTimeout(onClose, 900);
    } catch {
      setState({ busy: false, error: "Não foi possível enviar o feedback. Tente novamente.", ok: "" });
    }
  };
  return (
    <div className="modal-backdrop" onClick={() => !state.busy && onClose()}>
      <form
        className="confirm-dialog home-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Relatar bug ou sugestão"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="home-dialog-head">
          <div>
            <h2>Relatar bug ou sugestão</h2>
            <p>Envie problemas encontrados ou ideias para melhorar o sistema.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="home-form-grid">
          <label className="field">
            <span>Nome</span>
            <input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </label>
          <label className="field">
            <span>Tipo</span>
            <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
              <option value="bug">Bug / Erro</option>
              <option value="sugestao">Sugestão de melhoria</option>
            </select>
          </label>
          <label className="field">
            <span>Setor</span>
            <input value={form.setor} onChange={(e) => set("setor", e.target.value)} />
          </label>
          <label className="field">
            <span>Prioridade</span>
            <select value={form.prioridade} onChange={(e) => set("prioridade", e.target.value)}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label className="field is-wide">
            <span>Página</span>
            <input value={form.pagina} placeholder="/chat" onChange={(e) => set("pagina", e.target.value)} />
          </label>
          <label className="field is-wide">
            <span>Descrição</span>
            <textarea
              rows={5}
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="O que aconteceu ou o que poderia melhorar?"
            />
          </label>
        </div>
        {state.error ? <p className="inline-error" role="alert">{state.error}</p> : null}
        {state.ok ? <p className="inline-success" role="status">{state.ok}</p> : null}
        <div className="confirm-actions">
          <Button type="button" variant="outline" disabled={state.busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={state.busy}>
            {state.busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
            {state.busy ? "Enviando…" : "Enviar feedback"}
          </Button>
        </div>
      </form>
    </div>
  );
}


// A tela já diz "Bom dia, Nome": tira da resposta da IA a saudação e a frase "Segue o resumo…".
const semSaudacao = (texto) => {
  let t = String(texto || "").trim();
  for (let i = 0; i < 3; i++) {
    const antes = t;
    t = t
      .replace(/^\s*[^\p{L}\n]*(bom dia|boa tarde|boa noite|ol[aá]|oi)\b[^.!?\n]*[.!?]*[ \t]*\n?/iu, "")
      .replace(/^\s*segue\s+(o|um)\s+resumo[^.!?:\n]*[.!?:]*[ \t]*\n?/iu, "")
      .trim();
    if (t === antes) break;
  }
  return t || String(texto || "").trim();
};

export default function Home() {
  const navigate = useNavigate(),
    query = useQueryClient();
  const { user, banner, agenda, avisos, lembretes } = useHomeData();
  const { conversations, groups } = useChatData();
  const { snapshot, connected } = useDashboard();
  const [feedback, setFeedback] = useState(false);
  const access = useAccess();
  const unread =
    unreadCount(conversations.data || []) + unreadCount(groups.data || []);
  const avisosAtualizadoEm = avisos.data?.atualizado_em || null;
  const avisosPendentes = hasAvisosInternosUpdate(user || {}, avisosAtualizadoEm);
  const massivos = MASSIVOS_DASHBOARD.map((m) => ({
    ...m,
    total: groupTotal(snapshot?.groups || null, m.key) || 0,
  })).filter((m) => m.total > 0);
  const massivosCount = massivos.reduce((sum, m) => sum + m.total, 0);
  // Filas de suporte (mesma fonte do Painel NOC): dá pra IA olhar o volume de
  // chamados em aberto, não só mensagens e avisos.
  const filaSuporte = {
    suporteTecnico: groupTotal(snapshot?.groups || null, "SUPORTE TÉCNICO"),
    n1: groupTotal(snapshot?.groups || null, "SUPORTE N1"),
    n2: groupTotal(snapshot?.groups || null, "SUPORTE N2"),
    n3: groupTotal(snapshot?.groups || null, "SUPORTE N3"),
  };

  const horaAtual = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()),
  );
  const saudacao = horaAtual < 12 ? "Bom dia" : horaAtual < 18 ? "Boa tarde" : "Boa noite";

  // Resumo do dia/semana pela IA da internet: usa o que já está carregado na Home, mais o histórico real
  // das filas de suporte, registrado a cada resumo (ver backend /api/ia/resumo-diario). Sem CPF, telefone
  // nem endereço. Aparece sozinho uma vez a cada login (e some só ao fechar o card).
  const token = useSession((s) => s.token);
  const interno = useAssistenteInternet();
  // O último resumo do dia fica guardado neste computador: ao abrir o app (ou depois de uma atualização) ele aparece na hora,
  // com a hora de quando foi feito. Só é refeito se tiver mais de 15 minutos.
  const chaveResumo = `workspace:resumo-dia:${user?.id ?? "anon"}`;
  const diaDeHoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const guardado = (() => {
    try {
      const g = JSON.parse(localStorage.getItem(chaveResumo) || "null");
      return g?.texto && g.dia === diaDeHoje ? g : null;
    } catch { return null; }
  })();
  const resumoFresco = !!guardado && Date.now() - (guardado.hora || 0) < 15 * 60 * 1000;
  const [resumoIa, setResumoIa] = useState(() => (guardado?.texto ? { carregando: false, texto: guardado.texto, erro: "", hora: guardado.hora || null } : { carregando: false, texto: "", erro: "", hora: null }));
  const lembretesHoje = lembretes.data || [];
  // Recados que são só chamados de clientes (LOS, LOBI, offline, rompimento, agendamento de cliente) já estão nas filas:
  // ficam fora do Resumo de hoje, que leva só os avisos sobre a equipe e a operação (técnico sem veículo, em dupla, folga...).
  const recadosAgenda = (agenda.data?.observacoes || []).filter((o) => o?.descricao && !RECADO_DE_CHAMADO.test(o.descricao));
  const gerarResumoIa = async () => {
    // Com um resumo antigo na tela, ele continua visível enquanto o novo é feito.
    setResumoIa((r) => ({ carregando: true, texto: r.texto || "", erro: "", hora: r.texto ? r.hora : null }));
    const linhas = [
      `Mensagens não lidas no chat: ${unread}`,
      avisosPendentes ? "Há aviso interno novo, ainda não visto." : "Nenhum aviso interno novo.",
      massivosCount > 0
        ? `Alertas de massivo em aberto: ${massivos.map((m) => `${m.label} (${m.total})`).join(", ")}`
        : "Nenhum alerta de massivo em aberto agora.",
      agenda.data ? `Agenda de técnicos (dados resumidos): ${JSON.stringify(agenda.data, (k, v) => (/endere|telef|fone|celular|cpf|cnpj|mail|latitude|longitude|localiza|observacoes/i.test(k) ? undefined : v)).slice(0, 1200)}` : null,
      // Recados da coordenação na agenda (bloco "Outro"), ex.: "Alan irá atuar entre 08 e 16:48". Vão à parte para não serem cortados.
      recadosAgenda.length ? `Recados da agenda de técnicos hoje:\n${recadosAgenda.slice(0, 12).map((o) => `- ${o.tecnico}${o.hora ? ` (${o.hora})` : ""}: ${o.descricao}${o.finalizado ? " (encerrado)" : ""}`).join("\n")}` : null,
      lembretesHoje.length
        ? `Lembretes que ainda vão tocar hoje:\n${lembretesHoje.slice(0, 8).map((l) => `- ${l.hora} ${l.texto}`).join("\n")}`
        : null,
      `Filas de suporte agora: Suporte Técnico ${filaSuporte.suporteTecnico ?? "sem dado"}, N1 ${filaSuporte.n1 ?? "sem dado"}, N2 ${filaSuporte.n2 ?? "sem dado"}, N3 ${filaSuporte.n3 ?? "sem dado"}.`,
    ].filter(Boolean);
    // Registra o número de hoje (não trava o resumo se falhar).
    api.post("/ia/resumo-diario/registrar", {
      suporteTecnico: filaSuporte.suporteTecnico, n1: filaSuporte.n1, n2: filaSuporte.n2, n3: filaSuporte.n3,
    }).catch(() => {});
    const pedido = `Resumo pedido: como está hoje.\n${linhas.join("\n")}`;
    try {
      const texto = await assistenteResumo(pedido);
      const hora = Date.now();
      setResumoIa({ carregando: false, texto, erro: "", hora });
      try { localStorage.setItem(chaveResumo, JSON.stringify({ texto, hora, dia: diaDeHoje })); } catch { /* vale só nesta tela */ }
    } catch (erro) {
      // Se já havia um resumo na tela, ele fica; o erro só aparece quando não há nada para mostrar.
      setResumoIa((r) => (r.texto ? { ...r, carregando: false } : { carregando: false, texto: "", erro: erro?.message || "Não foi possível gerar o resumo agora.", hora: null }));
    }
  };

  // Ao entrar: gera o resumo de hoje sozinho, uma vez por login. Espera o painel NOC chegar (até 2,5 s) para
  // o resumo ter as filas de suporte, e não repete se a pessoa voltar para a Home depois.
  const gerarRef = useRef(gerarResumoIa);
  gerarRef.current = gerarResumoIa;
  const autoRodou = useRef(false);
  const [esperouPainel, setEsperouPainel] = useState(false);
  useEffect(() => {
    if (!interno.data?.configurada || autoRodou.current || resumoFresco) return undefined;
    const t = setTimeout(() => setEsperouPainel(true), 2500);
    return () => clearTimeout(t);
  }, [interno.data?.configurada, resumoFresco]);
  useEffect(() => {
    if (autoRodou.current || resumoFresco || !interno.data?.configurada || !token) return;
    if (!snapshot && !esperouPainel) return;
    autoRodou.current = true;
    void gerarRef.current();
  }, [interno.data?.configurada, snapshot, esperouPainel, token, resumoFresco]);

  const dataExtensa = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })
    .format(new Date())
    .replace(/^./, (c) => c.toUpperCase());
  const horaDoResumo = resumoIa.hora
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(resumoIa.hora))
    : "";
  const allowed = allowedIds(access.data);
  const agendaLiberada = allowed.has("agenda") || allowed.has("agenda-tecnicos") || user?.perfil === "admin";
  const totaisAgenda = agenda.data?.totais;
  const abrirAvisos = () => {
    markAvisosInternosAsSeen(user || {}, avisosAtualizadoEm);
    query.invalidateQueries({ queryKey: ["home", "avisos"] });
    navigate("/avisos-internos");
  };
  const abrirTelefone = useTelefone((s) => s.abrir);
  const perdidas = usePerdidasNovas();
  const naoPerturbe = usePhone((s) => s.snapshot.naoPerturbe);
  // Atalhos das ferramentas mais usadas; o ponto pisca quando há algo esperando.
  const portas = [
    {
      id: "chat", icone: MessageSquare, nome: "Chat interno", caminho: "/chat", contador: unread > 0 ? (unread > 99 ? "99+" : String(unread)) : "",
      estado: unread > 0 ? `${unread > 99 ? "99+" : unread} ${unread === 1 ? "mensagem não lida" : "mensagens não lidas"}` : "Nenhuma mensagem nova",
      led: unread > 0 ? "alerta" : "ligado",
    },
    agendaLiberada && {
      id: "agenda", icone: CalendarDays, nome: "Agenda técnica", caminho: "/agenda", contador: totaisAgenda?.total ? String(totaisAgenda.total) : "",
      estado: totaisAgenda?.total
        ? `${totaisAgenda.total} ${totaisAgenda.total === 1 ? "ordem" : "ordens"} hoje${totaisAgenda.execucao ? `, ${totaisAgenda.execucao} em execução` : ""}`
        : "Ordens dos técnicos de hoje",
      led: totaisAgenda?.execucao ? "alerta" : "ligado",
    },
    {
      id: "navegador", icone: Globe, nome: "Navegador", contador: "", caminho: "/navegador",
      estado: "SGP, OLT, Zabbix e Grafana", led: "ligado",
    },
    {
      id: "ia", icone: Bot, nome: "Inteligência Artificial", contador: "", caminho: "/assistente",
      estado: interno.data?.configurada ? "Pergunte o que precisar" : "Desligada no momento",
      led: interno.data?.configurada ? "ligado" : "desligado",
    },
    {
      id: "telefone", icone: Phone, nome: "Workscape Phone", acao: abrirTelefone,
      contador: perdidas > 0 ? (perdidas > 99 ? "99+" : String(perdidas)) : "",
      estado: naoPerturbe ? "Não perturbe ligado" : perdidas > 0 ? textoPerdidas(perdidas) : "Digite o número e ligue", led: naoPerturbe || perdidas > 0 ? "alerta" : "ligado",
    },
    {
      id: "lembretes", icone: AlarmClock, nome: "Lembretes", caminho: "/lembretes",
      estado: lembretesHoje.length ? `${lembretesHoje.length} ${lembretesHoje.length === 1 ? "alarme" : "alarmes"} ainda hoje` : "Alarmes criados com IA",
      led: lembretesHoje.length ? "alerta" : "ligado",
    },
    {
      id: "notas", icone: StickyNote, nome: "Notas", caminho: "/notas-rapidas",
      estado: "Suas anotações e as compartilhadas", led: "ligado",
    },
    {
      id: "ferramentas", icone: Wrench, nome: "Ferramentas", contador: "", caminho: "/tools",
      estado: "Calculadoras, diagnósticos e mais", led: "ligado",
    },
  ].filter(Boolean);
  const agora = [
    {
      id: "massivos", rotulo: "Massivos", abrir: () => navigate("/dashboard"),
      valor: massivosCount > 0 ? String(massivosCount) : connected ? "Nenhum" : "Sem conexão",
      detalhe: massivos.map((m) => `${m.label} ${m.total}`).join(", "),
      tom: massivosCount > 0 ? "critico" : "calmo",
    },
    lembretesHoje.length > 0 && {
      id: "lembretes", rotulo: "Lembretes de hoje", abrir: () => navigate("/lembretes"),
      valor: String(lembretesHoje.length),
      detalhe: `${lembretesHoje[0].hora} ${lembretesHoje[0].texto}`.slice(0, 48),
      tom: "atencao",
    },
    typeof filaSuporte.suporteTecnico === "number" && {
      id: "fila", rotulo: "Fila de suporte técnico", abrir: () => navigate("/dashboard"),
      valor: String(filaSuporte.suporteTecnico),
      detalhe: [["N1", filaSuporte.n1], ["N2", filaSuporte.n2], ["N3", filaSuporte.n3]]
        .filter(([, v]) => typeof v === "number").map(([k, v]) => `${k} ${v}`).join(", "),
      tom: "calmo",
    },
    {
      id: "avisos", rotulo: "Avisos internos", abrir: abrirAvisos,
      valor: avisosPendentes ? "Aviso novo" : "Em dia", detalhe: "",
      tom: avisosPendentes ? "atencao" : "calmo",
    },
  ].filter(Boolean);

  const inicioSlide = (
    <div className="inicio-slide">
        <header className="inicio-topo">
          <p className="inicio-data">{dataExtensa}</p>
          <h1>{saudacao}, {user?.nome?.split(" ")[0] || "equipe"}</h1>
        </header>

        <div className="inicio-dia">
          <section className="inicio-recado" aria-label="Resumo de hoje" data-tour="home-resumo" aria-live="polite">
            {interno.data?.configurada ? (
              <>
                <p className="inicio-recado-cabeca">
                  <Sparkles size={14} aria-hidden="true" />
                  <span>Resumo de hoje</span>
                  {resumoIa.carregando && resumoIa.texto ? <time>atualizando…</time> : resumoIa.hora ? <time>atualizado às {horaDoResumo}</time> : null}
                </p>
                {!resumoIa.texto && (resumoIa.carregando || !resumoIa.erro) ? (
                  <div className="inicio-recado-lendo" role="status">
                    <span style={{ width: "94%" }} />
                    <span style={{ width: "81%" }} />
                    <span style={{ width: "62%" }} />
                    <small>Lendo filas, agenda e avisos…</small>
                  </div>
                ) : null}
                {resumoIa.erro ? (
                  <p className="inicio-recado-erro">
                    {resumoIa.erro}{" "}
                    <button type="button" onClick={() => gerarResumoIa()}>Tentar de novo</button>
                  </p>
                ) : null}
                {resumoIa.texto ? <Markdown texto={semSaudacao(resumoIa.texto)} /> : null}
              </>
            ) : (
              <p className="inicio-recado-quieto">Seu dia na operação, reunido em um só lugar.</p>
            )}
          </section>

          <aside className="inicio-agora" aria-label="Agora">
            <h2>Agora</h2>
            <ul>
              {agora.map((a) => (
                <li key={a.id}>
                  <button type="button" className={`inicio-agora-linha is-${a.tom}`} onClick={a.abrir}>
                    <span className="inicio-agora-rotulo">{a.rotulo}</span>
                    <strong>{a.valor}</strong>
                    {a.detalhe ? <small>{a.detalhe}</small> : null}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <nav className="atalhos" aria-label="Atalhos">
          <ul style={{ "--portas": portas.length }}>
            {portas.map((p) => (
              <li key={p.id}>
                <button type="button" className="atalho" onClick={() => (p.acao ? p.acao() : navigate(p.caminho))}>
                  <span className="atalho-icone"><p.icone size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                  <span className="atalho-texto">
                    <strong>{p.nome}</strong>
                    <small>{p.estado}</small>
                  </span>
                  {p.contador ? <span className="atalho-contador">{p.contador}</span> : null}
                  {p.led === "alerta" ? <span className="atalho-ponto" aria-hidden="true" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>
    </div>
  );

  return (
    <div className="page home-page intranet-home">
      <div className="home-carousel">
        <HomeHighlightsCarousel
          motions={NOVIDADES_MOTIONS}
          inicio={inicioSlide}
          renderAgenda={(ativa) => <AgendaTecnicosCard resumo={agenda.data || null} active={ativa} />}
        >
          <HomeBanner key="banner" content={banner.data || normalizeHomeBannerContent()} />
          <div key="destaques" className="chat-home-secondary-grid">
            <AvaliacaoDestaqueCard />
            <CcnaCompetitionHighlightCard onOpen={() => navigate("/competicao-ccna")} />
            <MassivoAlertCard
              conectado={connected}
              massivos={massivos}
              massivosCount={massivosCount}
              onOpen={() => navigate("/dashboard")}
            />
          </div>
        </HomeHighlightsCarousel>
      </div>

      <div className="home-actions-bottom">
        <Button variant="ghost" size="sm" onClick={() => setFeedback(true)}>
          <Bug size={15} />
          Relatar bug ou sugestão
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/changelog")}>
          <ScrollText size={15} />
          Changelog
        </Button>
      </div>

      {feedback ? <FeedbackModal user={user} onClose={() => setFeedback(false)} /> : null}
    </div>
  );
}
