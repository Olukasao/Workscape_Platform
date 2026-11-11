import { useState } from 'react'

interface HourlyBarChartProps {
  data: number[]
  color?: string
  emptyLabel?: string
}

export function HourlyBarChart({ data, color = 'var(--accent)', emptyLabel }: HourlyBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(1, ...data)
  const total = data.reduce((sum, value) => sum + value, 0)

  if (total === 0 && emptyLabel) {
    return <p className="chart-empty">{emptyLabel}</p>
  }

  return (
    <div className="hourly-bar-chart" role="img" aria-label="Distribuição por hora do dia">
      {data.map((value, hour) => (
        <div
          className="hourly-bar-col"
          key={hour}
          onMouseEnter={() => setHovered(hour)}
          onMouseLeave={() => setHovered((current) => (current === hour ? null : current))}
        >
          {hovered === hour && (
            <div className="hourly-bar-tooltip">
              <strong>{value}</strong>
              <span>{String(hour).padStart(2, '0')}h</span>
            </div>
          )}
          <div className="hourly-bar-track">
            <div
              className="hourly-bar-fill"
              style={{
                height: `${Math.max(2, (value / max) * 100)}%`,
                background: color,
                opacity: hovered === null || hovered === hour ? 1 : 0.45,
              }}
            />
          </div>
          {hour % 3 === 0 && <span className="hourly-bar-label">{hour}h</span>}
        </div>
      ))}
    </div>
  )
}
