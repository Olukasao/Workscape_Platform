import type { ReactNode } from 'react'

interface PageShellProps {
  active: string
  title: string
  subtitle?: string
  headerExtra?: ReactNode
  children: ReactNode
}

/** Moldura das páginas do painel dentro do Workspace: a navegação fica nas abas do Atendimento, aqui só o título e o conteúdo. */
export function PageShell({ title, subtitle, headerExtra, children }: PageShellProps) {
  return (
    <div className="app-frame">
      <main className="app-shell">
        <header className="page-shell-header">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {headerExtra && <div className="page-shell-header-extra">{headerExtra}</div>}
        </header>
        <div className="page-shell-content">{children}</div>
      </main>
    </div>
  )
}
