import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  subtitle?: string
  headerRight?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({ title, subtitle, headerRight, children, className }: SectionCardProps) {
  return (
    <section className={`section-card${className ? ` ${className}` : ''}`}>
      <header className="section-card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {headerRight && <div className="section-card-head-right">{headerRight}</div>}
      </header>
      <div className="section-card-body">{children}</div>
    </section>
  )
}
