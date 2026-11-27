import type { ComponentType, ReactNode } from "react";
import { clsx } from "clsx";

export type Tone = "neutral" | "info" | "ok" | "warn" | "crit" | "live";

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>;

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx("badge", `tone-${tone}`, className)}>
      {dot ? <i className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function StatusDot({
  tone = "neutral",
  pulse = false,
}: {
  tone?: Tone;
  pulse?: boolean;
}) {
  return (
    <span
      className={clsx("status-dot", `tone-${tone}`, pulse && "is-pulsing")}
      aria-hidden="true"
    />
  );
}

export function initials(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

const hues = ["blue", "cyan", "green", "amber", "indigo"] as const;
function hueOf(name?: string | null) {
  let h = 0;
  for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return hues[h % hues.length];
}

export function Avatar({
  name,
  size = "md",
  brand = false,
  src,
  children,
}: {
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  brand?: boolean;
  /** Foto do usuário (data URL ou endereço); sem ela, mostra as iniciais. */
  src?: string | null;
  children?: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "avatar",
        `avatar--${size}`,
        brand ? "avatar--brand" : `avatar--${hueOf(name)}`,
      )}
      aria-hidden="true"
    >
      {children ?? (src ? <img className="avatar-img" src={src} alt="" /> : initials(name))}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
  icon: Icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  icon?: IconType;
}) {
  return (
    <header className="page-heading">
      <div className="page-heading-main">
        {Icon ? (
          <span className="page-heading-icon" aria-hidden="true">
            <Icon size={20} strokeWidth={1.8} />
          </span>
        ) : null}
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {meta || actions ? (
        <div className="page-heading-side">
          {meta}
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function Panel({
  title,
  icon: Icon,
  actions,
  children,
  className,
  label,
  flush = false,
}: {
  title?: ReactNode;
  icon?: IconType;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  label?: string;
  flush?: boolean;
}) {
  return (
    <section
      className={clsx("panel", flush && "panel--flush", className)}
      aria-label={label}
    >
      {title ? (
        <div className="panel-heading">
          <div className="panel-title">
            {Icon ? <Icon size={16} strokeWidth={1.9} /> : null}
            <h2>{title}</h2>
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  compact = false,
  tone = "neutral",
}: {
  icon?: IconType;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  tone?: Tone;
}) {
  return (
    <div className={clsx("empty", compact && "compact")}>
      {Icon ? (
        <span className={clsx("empty-icon", `tone-${tone}`)} aria-hidden="true">
          <Icon size={compact ? 18 : 22} strokeWidth={1.8} />
        </span>
      ) : null}
      {compact ? <h3>{title}</h3> : <h2>{title}</h2>}
      {children ? <p>{children}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Skeleton({
  className,
  lines,
}: {
  className?: string;
  lines?: number;
}) {
  if (lines)
    return (
      <div className={clsx("skeleton-stack", className)} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="skeleton skeleton-line" />
        ))}
      </div>
    );
  return <div className={clsx("skeleton", className)} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="page page-espera" aria-busy="true" aria-label="Carregando">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
      <div className="skeleton h-64" />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Marca de fibra: as três trilhas do logo AcessaNet terminando em nós. */
export function FiberMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      className={clsx("fiber-mark", animated && "is-animated", className)}
      viewBox="0 0 120 40"
      fill="none"
      aria-hidden="true"
    >
      <path d="M2 8H100" className="fiber-line fiber-blue" />
      <circle cx="106" cy="8" r="5" className="fiber-node fiber-blue" />
      <path d="M14 20H88" className="fiber-line fiber-green" />
      <circle cx="94" cy="20" r="5" className="fiber-node fiber-green" />
      <path d="M26 32H76" className="fiber-line fiber-yellow" />
      <circle cx="82" cy="32" r="5" className="fiber-node fiber-yellow" />
    </svg>
  );
}
