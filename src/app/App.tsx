import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Home as HomeIcon,
  ChartNoAxesCombined,
  MessageSquare,
  CalendarDays,
  Wrench,
  Globe,
  RadioTower,
  Bell,
  UserRound,
  Settings2,
  WifiOff,
  ArrowLeft,
  RefreshCw,
  CloudOff,
  LayoutDashboard,
  ClipboardCheck,
  ClipboardList,
  ShieldCheck,
  ScrollText,
  AlarmClock,
  Megaphone,
  GraduationCap,
  Bot,
} from "lucide-react";
import {
  useSession,
  useServers,
  usePreferences,
  useNotices,
} from "../stores/workspace";
import { api } from "../services/api";
import { initializeSocket, connectSocket, disconnectSocket, syncSocketUser } from "../services/socket";
import { useRealtime } from "../services/realtime";
import { useChatData, unreadCount } from "../services/data";
import LegacyThemeBridge from "../components/LegacyThemeBridge";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Button } from "../components/ui/button";
import Login from "../modules/Login";
import Settings from "../modules/Settings";
import { useApplicationZoom } from "../services/useApplicationZoom";
import { useAparencia } from "../services/aparencia";
import { useRenovarSessao } from "../services/sessaoRenovacao";
import Home from "../modules/Home";
const Resumo = lazy(() => import("../modules/Resumo"));
const Contratacoes = lazy(() => import("../modules/Contratacoes"));
const Changelog = lazy(() => import("../modules/Changelog"));
const Lembretes = lazy(() => import("../modules/Lembretes"));
const SuporteRemoto = lazy(() => import("../modules/SuporteRemoto"));
const Marketing = lazy(() => import("../modules/Marketing"));
const Cursos = lazy(() => import("../modules/cursos/Cursos"));
const Chamados = lazy(() => import("../modules/Chamados"));
import ContratacoesFlutuante from "../components/ContratacoesFlutuante";
import AssistenteFlutuante from "../components/AssistenteFlutuante";
import AvisoChamadosAtrasados from "../components/AvisoChamadosAtrasados";
import RemotoMotor from "../components/RemotoMotor";
import AtalhosTeclado from "../components/AtalhosTeclado";
import TelefoneFlutuante, { TelefoneJanela } from "../components/TelefoneFlutuante";
import TelefoneMotor from "../components/TelefoneMotor";
import NovidadeTelefone from "../components/NovidadeTelefone";
import ChamadaRecebida from "../components/ChamadaRecebida";
import AlarmeLembretes from "../components/AlarmeLembretes";
import TourGuiado from "../components/TourGuiado";
import ConviteTourIA from "../components/ConviteTourIA";
import UpdateBanner from "../components/UpdateBanner";
import CelebracaoVenda from "../components/CelebracaoVenda";
import EfeitosSonorosRemotos from "../components/EfeitosSonorosRemotos";
import { useContratacoes, useContratacoesFeed } from "../services/contratacoes";
const Agenda = lazy(() => import("../modules/Agenda"));
const Profile = lazy(() => import("../modules/Profile"));
const Notifications = lazy(() => import("../modules/Notifications"));
import { useAccess, allowedIds } from "../services/access";
import { useDashboardConnection } from "../services/dashboard";
import { useIncidentesFiltrados } from "../services/redeOlt";
import { useSobreposicao } from "../services/sobreposicao";
import { JANELA_DESTACADA, MINIAPPS, useDestacada, useSincronizacaoAgenda, useSincronizacaoGeral, usePresencaChat, destacar, reintegrar, trazerDeVolta, fixarSobre, type JanelaKind } from "../services/janelaDestacada";
import ModuleLinkBoundary from "../components/ModuleLinkBoundary";
import { Titlebar } from "./shell/Titlebar";
import { Headset, SquareTerminal, ExternalLink, PanelTopOpen, PanelTopClose, Pin, PinOff, Maximize2, Minimize2 } from "lucide-react";
import { Sidebar, type NavEntry, type NavGroup } from "./shell/Sidebar";
import { Topbar } from "./shell/Topbar";
import { CommandPalette } from "./shell/CommandPalette";
import { findTool } from "../modules/toolCatalog";
import {
  EmptyState,
  FiberMark,
  PageSkeleton,
} from "../components/ui/primitives";
import FundoUsuario from "../components/FundoUsuario";
const Dashboard = lazy(() => import("../modules/Dashboard"));
const Chat = lazy(() => import("../modules/Chat"));
const Navegador = lazy(() => import("../modules/Navegador"));
const RedeOlt = lazy(() => import("../modules/RedeOlt"));
import InternalNoticeManager from "../legacy/components/InternalNoticeManager";
const TerminalSsh = lazy(() => import("../modules/Terminal"));
const Workspaces = lazy(() => import("../modules/Workspaces"));
const Assistente = lazy(() => import("../modules/Assistente"));
const Tools = lazy(() => import("../modules/Tools"));
const query = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});
/** Avisos internos obrigatórios: valem em qualquer tela do Workspace, mesmo sem ter aberto o Chat. */
function AvisosInternos() {
  const token = useSession((s) => s.token);
  const clear = useSession((s) => s.clear);
  return token ? <InternalNoticeManager token={token} onUnauthorized={clear} /> : null;
}
/** Transição curta ao trocar de módulo, sem remontar componentes. */
function useRouteTransition(path: string) {
  useEffect(() => {
    // O contêiner de rotas é compartilhado: cada página abre no topo.
    document.querySelector(".route-container")?.scrollTo({ top: 0 });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = document.querySelector<HTMLElement>(
      ".module-area > :not([hidden])",
    );
    el?.animate?.(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }, [path]);
}
function Shell() {
  useRenovarSessao();
  useDashboardConnection();
  useContratacoesFeed();
  const contratacoesPendentes = useContratacoes((s) => s.pendentes);
  const user = useSession((s) => s.user),
    loc = useLocation(),
    navigate = useNavigate(),
    { collapsed, toggleSidebar, autoHideSidebar, sidebarPinned, toggleSidebarPinned } = usePreferences();
  // Recolhimento automático: a barra vira um trilho de ícones e abre por cima do conteúdo
  // quando o mouse encosta na borda esquerda da tela (ou fica um instante sobre o trilho).
  const [sidebarHover, setSidebarHover] = useState(false);
  const hoverTimer = useRef<number | undefined>(undefined);
  const suprimir = useRef(false); // depois de escolher um item, só reabre depois que o mouse sair
  const hoverSidebar = (on: boolean, atraso: number) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setSidebarHover(on), atraso);
  };
  const fecharSidebar = () => {
    window.clearTimeout(hoverTimer.current);
    setSidebarHover(false);
  };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    // Janela sem foco (ex.: mouse foi para outro programa) ou Esc: recolhe.
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fecharSidebar();
    window.addEventListener("blur", fecharSidebar);
    window.addEventListener("keydown", esc);
    document.documentElement.addEventListener("mouseleave", fecharSidebar);
    return () => {
      window.removeEventListener("blur", fecharSidebar);
      window.removeEventListener("keydown", esc);
      document.documentElement.removeEventListener("mouseleave", fecharSidebar);
    };
  }, []);
  const autoRail = autoHideSidebar && !sidebarPinned;
  const sidebarCollapsed = autoHideSidebar ? !sidebarPinned && !sidebarHover : collapsed;
  // Transição suave só na primeira montagem logo após o login.
  const [chegada] = useState(() => {
    try {
      const v = sessionStorage.getItem("workspace:chegada") === "1";
      sessionStorage.removeItem("workspace:chegada");
      return v;
    } catch { return false; }
  });
  const status = useRealtime(),
    access = useAccess();
  const [online, setOnline] = useState(navigator.onLine),
    [chatVisited, setChatVisited] = useState(false),
    [agendaVisited, setAgendaVisited] = useState(false),
    [navegadorVisited, setNavegadorVisited] = useState(false),
    [palette, setPalette] = useState(false);
  const { conversations, groups } = useChatData();
  const unread =
    unreadCount(conversations.data || []) + unreadCount(groups.data || []);
  const path = loc.pathname;
  // Uma página nativa do Electron fica acima do React. Esta proteção no nível
  // da rota garante que ela seja escondida mesmo se o módulo que a abriu falhar.
  useEffect(() => {
    if (path !== "/agenda" && path !== "/navegador")
      void window.desktop?.browserHide?.();
  }, [path]);
  const { q: rede, visiveis: redeVisiveis } = useIncidentesFiltrados();
  const agendaDestacada = useDestacada("agenda"),
    chatDestacado = useDestacada("chat"),
    navegadorDestacado = useDestacada("navegador"),
    redeDestacada = useDestacada("rede"),
    dashboardDestacado = useDestacada("dashboard"),
    resumoDestacado = useDestacada("resumo"),
    terminalDestacado = useDestacada("terminal");
  useSincronizacaoAgenda(query);
  useSincronizacaoGeral(query);
  // Link para uma OS ou conversa enquanto o módulo está em outra janela: leva a janela para frente.
  useEffect(() => {
    if (agendaDestacada && path === "/agenda" && loc.search) destacar("agenda", loc.search);
    if (chatDestacado && path === "/chat" && loc.search) destacar("chat", loc.search);
  }, [agendaDestacada, chatDestacado, path, loc.search]);
  useEffect(() => { useSobreposicao.getState().setPaleta(palette); }, [palette]);
  const isChat = path === "/chat";
  useRouteTransition(path);
  useEffect(() => {
    if (isChat) setChatVisited(true);
    if (path === "/agenda") setAgendaVisited(true);
    if (path === "/navegador") setNavegadorVisited(true);
  }, [isChat, path]);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        const prefs = usePreferences.getState();
        if (prefs.autoHideSidebar) prefs.toggleSidebarPinned();
        else toggleSidebar();
      }
      if (e.key === "Escape")
        document.dispatchEvent(new CustomEvent("workspace:escape"));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [toggleSidebar]);
  const allowed = allowedIds(access.data);
  const agendaAllowed =
    allowed.has("agenda") ||
    allowed.has("agenda-tecnicos") ||
    user?.perfil === "admin";
  const navGroups: NavGroup[] = [
    {
      label: "Visão geral",
      entries: [
        { path: "/", label: "Início", icon: HomeIcon },
        { path: "/resumo", label: "Resumo", icon: LayoutDashboard },
        { path: "/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
        { path: "/assistente", label: "Inteligência Artificial", icon: Bot },
        { path: "/lembretes", label: "Lembretes", icon: AlarmClock },
      ],
    },
    {
      label: "Comunicação",
      entries: [
        { path: "/chat", label: "Chat Interno", icon: MessageSquare, badge: unread },
      ],
    },
    {
      label: "Operação",
      entries: [
        ...(agendaAllowed
          ? [{ path: "/agenda", label: "Agenda de Técnicos", icon: CalendarDays }]
          : []),
        { path: "/contratacoes", label: "Contratações", icon: ClipboardCheck, badge: contratacoesPendentes },
        { path: "/chamados", label: "Chamados", icon: ClipboardList },
        ...(rede.data && !rede.data.negado
          ? [{ path: "/rede", label: "Rede (OLT)", icon: RadioTower, badge: redeVisiveis.length }]
          : []),
        { path: "/tools", label: "Ferramentas", icon: Wrench },
        ...(window.desktop ? [{ path: "/terminal", label: "Terminal", icon: SquareTerminal }] : []),
        { path: "/navegador", label: "Navegador", icon: Globe },
        ...(window.desktop ? [{ path: "/suporte", label: "Suporte T.I.", icon: Headset }] : []),
      ],
    },
    {
      label: "Conteúdo",
      entries: [
        { path: "/cursos", label: "Cursos", icon: GraduationCap },
        { path: "/marketing", label: "Marketing", icon: Megaphone },
      ],
    },
    {
      label: "Espaço de trabalho",
      entries: [
        ...(user?.perfil === "admin"
          ? [{ path: "/admin", label: "Administração", icon: ShieldCheck }]
          : []),
        { path: "/changelog", label: "Changelog", icon: ScrollText },
      ],
    },
  ];
  const entries: NavEntry[] = navGroups.flatMap((g) => g.entries);
  const system: NavEntry[] = [
    { path: "/profile", label: "Perfil", icon: UserRound },
    { path: "/settings", label: "Configurações", icon: Settings2 },
  ];
  const tool = findTool(path);
  // As telas internas de Cursos (/cursos/...) mantêm o item do menu marcado.
  const itemPath = path.startsWith("/cursos") ? "/cursos" : path;
  // Notificações ficam no sino da barra superior, mas a tela continua com título próprio.
  const current = [...entries, ...system, { path: "/notifications", label: "Notificações", icon: Bell }].find((i) => i.path === itemPath);
  const isActive = (p: string) => p === itemPath || (p === "/tools" && !current);
  return (
    <>
      <ModuleLinkBoundary />
      <ContratacoesFlutuante />
      <AssistenteFlutuante />
      <TelefoneMotor />
      <NovidadeTelefone />
      <AtalhosTeclado />
      <RemotoMotor />
      <AvisoChamadosAtrasados ativo={agendaAllowed} />
      <ChamadaRecebida />
      <TelefoneFlutuante />
      <AlarmeLembretes />
      <ConviteTourIA />
      <AvisosInternos />
      <TourGuiado />
      <div
        className={`workspace ${sidebarCollapsed ? "collapsed" : ""} ${autoRail ? "auto-recolher" : ""} ${chegada ? "is-chegada" : ""}`}
      >
        {autoRail && (
          <div
            className="sidebar-borda"
            aria-hidden="true"
            onMouseEnter={() => { if (!suprimir.current) hoverSidebar(true, 0); }}
          />
        )}
        <div
          className="sidebar-slot"
          onMouseEnter={() => { if (autoRail && !suprimir.current) hoverSidebar(true, 500); }}
          onMouseLeave={() => {
            suprimir.current = false;
            if (autoRail) hoverSidebar(false, 150);
          }}
          onClickCapture={(e) => {
            // Escolheu um destino: recolhe na hora para não cobrir o conteúdo.
            if (autoRail && (e.target as HTMLElement).closest(".nav-item, .brand, .user-summary, .sidebar-search")) {
              suprimir.current = true;
              fecharSidebar();
            }
          }}
          onFocusCapture={(e) => { if (autoRail && !suprimir.current && (e.target as HTMLElement).matches(":focus-visible")) hoverSidebar(true, 0); }}
          onBlurCapture={(e) => {
            if (autoRail && !e.currentTarget.contains(e.relatedTarget as Node | null)) hoverSidebar(false, 150);
          }}
        >
          <Sidebar
            groups={navGroups}
            system={system}
            active={isActive}
            status={status}
            collapsed={autoHideSidebar ? !sidebarPinned : collapsed}
            onToggle={autoHideSidebar ? toggleSidebarPinned : toggleSidebar}
            onSearch={() => setPalette(true)}
            user={user}
            auto={autoHideSidebar}
          />
        </div>
        <main className="main">
          <FundoUsuario userId={user?.id} />
          <Topbar
            section={current?.label || "Ferramentas"}
            sectionIcon={current?.icon || Wrench}
            page={!current && tool ? tool.title : undefined}
            onSectionClick={() => navigate("/tools")}
            status={status}
            onSearch={() => setPalette(true)}
            user={user}
          />
          {!online && (
            <div className="offline-banner" role="status">
              <WifiOff size={15} />
              Sem conexão com a rede. Reconectaremos automaticamente.
            </div>
          )}
          <div className="module-area">
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                {chatVisited || isChat ? (
                  <div className="chat-container" hidden={!isChat}>
                    {chatDestacado ? <JanelaEmOutraTela kind="chat" /> : <Chat active={isChat} />}
                  </div>
                ) : null}
                <div
                  className="route-container"
                  hidden={isChat || path === "/agenda" || path === "/navegador"}
                >
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/resumo" element={resumoDestacado ? <JanelaEmOutraTela kind="resumo" /> : <Resumo />} />
                    <Route path="/marketing" element={<Marketing />} />
                    <Route path="/cursos/*" element={<Cursos />} />
                    <Route path="/chamados" element={<Chamados />} />
                    <Route path="/contratacoes" element={<Contratacoes />} />
                    <Route path="/workspaces" element={<Workspaces />} />
                    <Route path="/assistente" element={<Assistente />} />
                    <Route path="/terminal" element={terminalDestacado ? <JanelaEmOutraTela kind="terminal" /> : <TerminalSsh active />} />
                    <Route path="/rede" element={redeDestacada ? <JanelaEmOutraTela kind="rede" /> : <RedeOlt />} />
                    <Route path="/dashboard" element={dashboardDestacado ? <JanelaEmOutraTela kind="dashboard" /> : <Dashboard />} />
                    <Route
                      path="/monitoramento-total"
                      element={<Navigate to="/dashboard" replace />}
                    />
                    <Route
                      path="/noc/monitoramento-total"
                      element={<Navigate to="/dashboard" replace />}
                    />
                    <Route
                      path="/agenda-tecnicos"
                      element={<Navigate to="/agenda" replace />}
                    />
                    <Route
                      path="/agenda-tecnicos-instalacao"
                      element={<Navigate to="/" replace />}
                    />
                    <Route
                      path="/noc/teste-conectividade-sites"
                      element={
                        <Navigate to="/teste-conectividade-sites" replace />
                      }
                    />
                    <Route path="/agenda" element={null} />
                    <Route path="/navegador" element={null} />
                    <Route
                      path="/instalacao"
                      element={<Navigate to="/" replace />}
                    />
                    <Route path="/disparo" element={<Navigate to="/chat?aba=disparo" replace />} />
                    <Route path="/changelog" element={<Changelog />} />
                    <Route path="/lembretes" element={<Lembretes />} />
                    <Route path="/suporte" element={<SuporteRemoto />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route
                      path="/login"
                      element={<Navigate to="/" replace />}
                    />
                    <Route path="/wiki/:categoriaId" element={<Tools />} />
                    <Route path="/admin/usuarios/:id/mensagens" element={<Tools />} />
                    <Route
                      path="/wiki/curso/:cursoId/aula/:lessonSlug"
                      element={<Tools />}
                    />
                    <Route path="/wiki/curso/:cursoId" element={<Tools />} />
                    <Route path="*" element={<Tools />} />
                  </Routes>
                </div>
                {(navegadorVisited || path === "/navegador") && (
                  <div
                    className="persistent-module"
                    hidden={path !== "/navegador"}
                  >
                    {navegadorDestacado ? (
                      <JanelaEmOutraTela kind="navegador" />
                    ) : (
                      <Navegador active={path === "/navegador"} paused={palette} />
                    )}
                  </div>
                )}
                {(agendaVisited || path === "/agenda") && (
                  <div
                    className="persistent-module"
                    hidden={path !== "/agenda"}
                  >
                    {agendaDestacada ? (
                      <JanelaEmOutraTela kind="agenda" />
                    ) : agendaAllowed ? (
                      <Agenda service="agenda" />
                    ) : (
                      <div className="page">
                        <EmptyState
                          icon={CalendarDays}
                          tone="warn"
                          title="Agenda indisponível para sua conta"
                        >
                          Acesso à agenda não liberado pelo servidor.
                        </EmptyState>
                      </div>
                    )}
                  </div>
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        entries={[...entries, ...system]}
      />
    </>
  );
}
function SessionGate() {
  const { ready, load } = useServers(),
    { user, token, setSession, clear, entrando } = useSession(),
    loc = useLocation();
  const [booting, setBooting] = useState(true),
    [failure, setFailure] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
        initializeSocket(useServers.getState().config.chat);
        const saved = window.desktop ? await window.desktop.getSession() : null;
        const current = useSession.getState().token || saved?.token;
        if (current) {
          sessionStorage.setItem("token", current);
          useSession.setState({ token: current });
          const { data } = await api.get("/me");
          if (!cancelled) setSession(current, data);
        }
      } catch (e) {
        const status = isAxiosError(e) ? e.response?.status : undefined;
        if (status === 401 || status === 403 || status === 404) clear();
        else if (!cancelled) {
          useSession.setState({ token: null, user: null });
          setFailure(
            useServers.getState().ready
              ? "Não foi possível validar sua sessão. Ela foi preservada para reconectar."
              : "Não foi possível carregar a configuração local.",
          );
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, setSession, clear]);
  useEffect(() => {
    if (!failure) return;
    const retry = () => location.reload();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [failure]);
  useAparencia();
  const theme = usePreferences((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme =
      theme === "light" ? "claro" : "escuro";
    document.documentElement.dataset.anTheme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("chatTema", theme === "light" ? "claro" : "escuro");
  }, [theme]);
  useEffect(() => {
    const logout = () => {
      clear();
      query.clear();
    };
    window.addEventListener("workspace:logout", logout);
    return () => window.removeEventListener("workspace:logout", logout);
  }, [clear]);
  useEffect(() => {
    if (!token) {
      query.clear();
      useNotices.getState().clear();
      void window.desktop?.unread(0);
    }
  }, [token]);
  if (booting)
    return (
      <div className="startup" role="status">
        <FiberMark animated />
        <span>Preparando seu workspace…</span>
      </div>
    );
  if (failure)
    return (
      <>
        <Titlebar />
        <div className="standalone-state">
          <EmptyState
            icon={CloudOff}
            tone="warn"
            title={failure}
            action={
              <Button onClick={() => location.reload()}>
                <RefreshCw size={15} />
                Tentar novamente
              </Button>
            }
          >
            Reconectaremos automaticamente quando a rede voltar.
          </EmptyState>
        </div>
      </>
    );
  return (
    <>
      <Titlebar />
      <UpdateBanner />
      <CelebracaoVenda />
      <EfeitosSonorosRemotos />
      {user && token && !entrando ? (
        <Shell />
      ) : loc.pathname === "/settings" ? (
        <div className="setup-page">
          <Button
            variant="ghost"
            size="sm"
            className="setup-back"
            onClick={() => (location.hash = "/login")}
          >
            <ArrowLeft size={15} />
            Voltar ao acesso
          </Button>
          <Settings />
        </div>
      ) : (
        <Login />
      )}
    </>
  );
}
/** Mostrado na janela principal enquanto o módulo está aberto em janela própria. */
function JanelaEmOutraTela({ kind }: { kind: JanelaKind }) {
  return (
    <div className="agenda-destacada-aviso">
      <div className="panel">
        <ExternalLink size={28} />
        <h2>{MINIAPPS[kind].artigo} está em outra janela</h2>
        <p>Você pode continuar usando o Workspace normalmente.{kind === "agenda" ? " Tudo o que for alterado lá aparece aqui quando voltar." : ""}</p>
        <div className="acoes">
          <Button onClick={() => destacar(kind)}>
            <ExternalLink size={15} /> Mostrar janela
          </Button>
          <Button variant="outline" onClick={() => trazerDeVolta(kind)}>
            <PanelTopOpen size={15} /> Trazer de volta
          </Button>
        </div>
      </div>
    </div>
  );
}
/** O Painel NOC e o Resumo recebem os números pela ligação com o dashboard; cada janela abre a sua. */
function LigacaoDashboard() {
  useDashboardConnection();
  return null;
}
/** Janela destacada: só o módulo escolhido, com a sessão do Workspace lida do armazenamento seguro. */
function JanelaDestacada({ kind }: { kind: JanelaKind }) {
  const { load } = useServers(),
    { user, token, setSession } = useSession(),
    navigate = useNavigate();
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const iniciarCompacta = new URLSearchParams(location.hash.split("?")[1] || "").get("compacto") === "1";
  const [compacto, setCompacto] = useState(() => {
    if (iniciarCompacta) return true;
    try { return kind === "agenda" && localStorage.getItem("workspace:agenda-compacta") === "1"; } catch { return false; }
  });
  const alternar = () =>
    setCompacto((v) => {
      if (kind === "agenda") try { localStorage.setItem("workspace:agenda-compacta", v ? "0" : "1"); } catch { /* sem armazenamento */ }
      void window.desktop?.detachedCompact?.({ kind, compacto: !v });
      return !v;
    });
  useSincronizacaoAgenda(query);
  useSincronizacaoGeral(query);
  // Janela pequena: aplica sozinha o visual compacto, para o conteúdo continuar útil em qualquer tamanho.
  const [apertada, setApertada] = useState(() => innerWidth < 760 || innerHeight < 480);
  useEffect(() => {
    const medir = () => setApertada(innerWidth < 760 || innerHeight < 480);
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  const [fixada, setFixada] = useState(() => new URLSearchParams(location.hash.split("?")[1] || "").get("porcima") === "1");
  usePresencaChat(kind === "chat" && estado === "ok");
  useApplicationZoom();
  useAparencia();
  const theme = usePreferences((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme === "light" ? "claro" : "escuro";
    document.documentElement.dataset.anTheme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        await load();
        const salva = await window.desktop?.getSession();
        if (!salva?.token) throw new Error("sem sessão");
        sessionStorage.setItem("token", salva.token);
        useSession.setState({ token: salva.token });
        // O chat precisa da conexão em tempo real própria desta janela.
        if (kind === "chat") initializeSocket(useServers.getState().config.chat);
        const { data } = await api.get("/me");
        if (!cancelado) {
          setSession(salva.token, data);
          setEstado("ok");
        }
      } catch {
        if (!cancelado) setEstado("erro");
      }
    })();
    return () => { cancelado = true; };
  }, [load, setSession, kind]);
  useEffect(() => {
    if (kind !== "chat" || estado !== "ok" || !user || !token) return;
    const s = connectSocket(token);
    const entrar = () => syncSocketUser(user);
    s.on("connect", entrar);
    if (s.connected) entrar();
    return () => {
      s.off("connect", entrar);
      disconnectSocket();
    };
  }, [kind, estado, user, token]);
  useEffect(
    () => window.desktop?.onDetachedDeeplink((search) => navigate(`/${kind}${search.startsWith("?") ? search : `?${search}`}`)),
    [navigate, kind],
  );
  useEffect(() => {
    document.title = `${MINIAPPS[kind].titulo} · Acessa Workspace`;
  }, [kind]);
  if (estado !== "ok" || !user || !token)
    return (
      <div className="agenda-janela-estado" role="status">
        {estado === "erro" ? (
          <EmptyState icon={CloudOff} tone="warn" title="Não foi possível abrir esta janela">
            Entre no Workspace e use “Destacar” de novo.
            <div style={{ marginTop: 12 }}>
              <Button onClick={() => reintegrar(kind)}>Fechar</Button>
            </div>
          </EmptyState>
        ) : (
          <span>Abrindo…</span>
        )}
      </div>
    );
  return (
    <div className={`janela-destacada${compacto ? " janela-compacta" : ""}${apertada ? " janela-apertada" : ""}`}>
      {(kind === "dashboard" || kind === "resumo") && <LigacaoDashboard />}
      {(kind === "chat" || kind === "rede" || kind === "dashboard" || kind === "resumo" || kind === "terminal" || kind === "telefone") && (
        <div className="janela-barra">
          <strong>{MINIAPPS[kind].titulo}</strong>
          <div className="janela-barra-acoes">
            {kind !== "terminal" && kind !== "telefone" && (
              <Button variant={compacto ? "soft" : "outline"} size="sm" aria-pressed={compacto} onClick={alternar} title="Menos textos e espaços, para ocupar pouco da tela">
                {compacto ? <Maximize2 size={15} /> : <Minimize2 size={15} />} <span className="rotulo">{compacto ? "Normal" : "Compacto"}</span>
              </Button>
            )}
            <Button
              variant={fixada ? "soft" : "outline"}
              size="sm"
              aria-pressed={fixada}
              onClick={() => { fixarSobre(kind, !fixada); setFixada(!fixada); }}
              title="Mantém esta janela sempre por cima das outras"
            >
              {fixada ? <PinOff size={15} /> : <Pin size={15} />} <span className="rotulo">{fixada ? "Soltar" : "Fixar por cima"}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => reintegrar(kind)} title="Fecha esta janela e devolve ao Workspace">
              <PanelTopClose size={15} /> <span className="rotulo">Reintegrar</span>
            </Button>
          </div>
        </div>
      )}
      <div className="janela-corpo">
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              {kind === "agenda" && (
                <Route path="/agenda" element={<div className="agenda-janela"><Agenda service="agenda" detached compact={compacto} onToggleCompact={alternar} /></div>} />
              )}
              {kind === "chat" && (
                <Route path="/chat" element={<div className="chat-container"><Chat active /></div>} />
              )}
              {kind === "navegador" && (
                <Route path="/navegador" element={<Navegador active paused={false} />} />
              )}
              {kind === "rede" && <Route path="/rede" element={<RedeOlt />} />}
              {kind === "dashboard" && <Route path="/dashboard" element={<Dashboard />} />}
              {kind === "resumo" && <Route path="/resumo" element={<Resumo />} />}
              {kind === "terminal" && <Route path="/terminal" element={<TerminalSsh active />} />}
              {kind === "telefone" && <Route path="/telefone" element={<TelefoneJanela />} />}
              <Route path="*" element={<Navigate to={`/${kind}?janela=1`} replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
export default function App() {
  if (JANELA_DESTACADA)
    return (
      <QueryClientProvider client={query}>
        <HashRouter>
          <ErrorBoundary>
            <LegacyThemeBridge>
              <JanelaDestacada kind={JANELA_DESTACADA} />
            </LegacyThemeBridge>
          </ErrorBoundary>
        </HashRouter>
      </QueryClientProvider>
    );
  return <MainApp />;
}
function MainApp() {
  useApplicationZoom();
  return (
    <QueryClientProvider client={query}>
      <HashRouter>
        <ErrorBoundary>
          <LegacyThemeBridge>
            <SessionGate />
          </LegacyThemeBridge>
        </ErrorBoundary>
      </HashRouter>
    </QueryClientProvider>
  );
}
