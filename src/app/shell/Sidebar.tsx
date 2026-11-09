import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { clsx } from "clsx";
import logo from "../../assets/brand/logo-acessanet.png";
import type { User } from "../../stores/workspace";
import { Avatar, Kbd, StatusDot } from "../../components/ui/primitives";
import SituacaoUsuario from "../../components/SituacaoUsuario";

export type NavEntry = {
  path: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  badge?: number;
};

/**
 * Nome da empresa para mostrar embaixo do logo. Quando é só "AcessaNet" ele repete o próprio logo, então não aparece;
 * só entra se for outra empresa (nome diferente da marca).
 */
export function rotuloEmpresaSobLogo(nome?: string | null): string {
  const limpo = String(nome ?? "").trim();
  if (!limpo) return "";
  const semAcento = limpo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /^acessa[\s._-]*net$/.test(semAcento) ? "" : limpo;
}

function NavList({
  entries,
  active,
  label,
}: {
  entries: NavEntry[];
  active: (path: string) => boolean;
  label: string;
}) {
  const navigate = useNavigate();
  return (
    <nav aria-label={label}>
      {entries.map((i) => {
        const on = active(i.path);
        return (
          <button
            className={clsx("nav-item", on && "active")}
            data-tip={i.label}
            data-tour={`nav${i.path.replace(/\//g, "-")}`}
            aria-label={i.label}
            key={i.path}
            onClick={() => navigate(i.path)}
            aria-current={on ? "page" : undefined}
          >
            <span className="nav-trace" aria-hidden="true" />
            <i.icon size={18} strokeWidth={on ? 2 : 1.75} />
            <span className="nav-text">{i.label}</span>
            {i.badge ? (
              <b className="nav-badge">{i.badge > 99 ? "99+" : i.badge}</b>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export type NavGroup = { label: string; entries: NavEntry[] };

export function Sidebar({
  groups,
  system,
  active,
  status,
  collapsed,
  onToggle,
  onSearch,
  user,
  auto = false,
}: {
  groups: NavGroup[];
  system: NavEntry[];
  active: (path: string) => boolean;
  status: string;
  collapsed: boolean;
  onToggle: () => void;
  onSearch: () => void;
  user: User | null;
  /** Recolhimento automático: o botão passa a fixar/soltar a barra. */
  auto?: boolean;
}) {
  const navigate = useNavigate();
  const live = status === "Conectado";
  return (
    <aside className="sidebar" aria-label="Navegação principal">
      <button
        className="brand"
        onClick={() => navigate("/")}
        aria-label="Acessa Workspace início"
      >
        <span className="brand-logo">
          <img src={logo} alt="" width={877} height={327} />
        </span>
        {rotuloEmpresaSobLogo(user?.empresa_nome) ? (
          <span className="brand-sub">{rotuloEmpresaSobLogo(user?.empresa_nome)}</span>
        ) : null}
      </button>
      <button
        className="sidebar-search"
        onClick={onSearch}
        aria-label="Buscar módulos e ferramentas"
        data-tip="Buscar (Ctrl K)"
      >
        <Search size={15} />
        <span className="nav-text">Buscar</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      <div className="sidebar-scroll">
        {groups
          .filter((g) => g.entries.length > 0)
          .map((g) => (
            <section className="nav-group" key={g.label}>
              <span className="nav-label">{g.label}</span>
              <NavList entries={g.entries} active={active} label={g.label} />
            </section>
          ))}
      </div>
      <div className="sidebar-bottom">
        <span className="nav-label">Sistema</span>
        <NavList entries={system} active={active} label="Sistema" />
        <SituacaoUsuario />
        <div className="sidebar-status" data-live={live || undefined}>
          <StatusDot tone={live ? "live" : "warn"} pulse={!live} />
          <span className="nav-text">{status}</span>
          <button
            aria-label={
              auto
                ? collapsed ? "Fixar barra lateral aberta" : "Voltar a recolher a barra lateral sozinha"
                : collapsed ? "Expandir barra lateral" : "Recolher barra lateral"
            }
            aria-expanded={!collapsed}
            title={
              auto
                ? collapsed ? "Fixar aberta" : "Recolher sozinha"
                : collapsed ? "Expandir" : "Recolher"
            }
            onClick={onToggle}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </button>
        </div>
        <button
          className="user-summary"
          onClick={() => navigate("/profile")}
          aria-label={`Perfil de ${user?.nome || "usuário"}`}
          data-tip={user?.nome}
        >
          <Avatar name={user?.nome} src={user?.avatar} brand size="md" />
          <span className="nav-text">
            <strong>{user?.nome}</strong>
            <small>{user?.setor_nome || user?.perfil}</small>
          </span>
        </button>
      </div>
    </aside>
  );
}
