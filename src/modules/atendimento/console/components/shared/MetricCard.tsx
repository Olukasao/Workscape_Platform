import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  trend?: {
    direction: 'up' | 'down'
    label: string
    tone?: 'positive' | 'negative' | 'neutral'
  }
  accent?: boolean
}

export function MetricCard({ label, value, icon, trend, accent }: MetricCardProps) {
  return (
    <div className={`metric-card${accent ? ' accent' : ''}`}>
      <div className="metric-card-head">
        <span className="metric-card-label">{label}</span>
        {icon && <span className="metric-card-icon">{icon}</span>}
      </div>
      <strong className="metric-card-value">{value}</strong>
      {trend && (
        <span className={`metric-card-trend ${trend.tone ?? (trend.direction === 'up' ? 'positive' : 'negative')}`}>
          {trend.direction === 'up' ? (
            <ArrowUp size={12} aria-hidden="true" />
          ) : (
            <ArrowDown size={12} aria-hidden="true" />
          )}
          {trend.label}
        </span>
      )}
    </div>
  )
}
