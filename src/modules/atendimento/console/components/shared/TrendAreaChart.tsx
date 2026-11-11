import { useId, useState } from 'react'

export interface TrendSeries {
  label: string
  color: string
  data: number[]
  fill?: boolean
}

interface TrendAreaChartProps {
  series: TrendSeries[]
  height?: number
  emptyLabel?: string
}

const WIDTH = 720
const PADDING_X = 8
const PADDING_TOP = 12
const PADDING_BOTTOM = 24

export function TrendAreaChart({ series, height = 220, emptyLabel }: TrendAreaChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const gradientId = useId()

  const pointCount = series[0]?.data.length ?? 24
  const max = Math.max(1, ...series.flatMap((item) => item.data))
  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM
  const plotWidth = WIDTH - PADDING_X * 2
  const step = plotWidth / Math.max(1, pointCount - 1)

  const total = series.reduce((sum, item) => sum + item.data.reduce((a, b) => a + b, 0), 0)
  if (total === 0 && emptyLabel) {
    return <p className="chart-empty">{emptyLabel}</p>
  }

  function xAt(index: number) {
    return PADDING_X + index * step
  }

  function yAt(value: number) {
    return PADDING_TOP + plotHeight - (value / max) * plotHeight
  }

  function linePath(data: number[]) {
    return data.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(value)}`).join(' ')
  }

  function areaPath(data: number[]) {
    const line = linePath(data)
    const baseline = PADDING_TOP + plotHeight
    return `${line} L ${xAt(data.length - 1)} ${baseline} L ${xAt(0)} ${baseline} Z`
  }

  return (
    <div className="trend-area-chart">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" role="img" aria-label="Tendência por hora do dia">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0]?.color ?? 'var(--accent)'} stopOpacity="0.35" />
            <stop offset="100%" stopColor={series[0]?.color ?? 'var(--accent)'} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={PADDING_X}
            x2={WIDTH - PADDING_X}
            y1={PADDING_TOP + plotHeight * fraction}
            y2={PADDING_TOP + plotHeight * fraction}
            className="trend-grid-line"
          />
        ))}

        {series.map((item, seriesIndex) =>
          item.fill !== false && seriesIndex === 0 ? (
            <path key={`${item.label}-area`} d={areaPath(item.data)} fill={`url(#${gradientId})`} stroke="none" />
          ) : null,
        )}

        {series.map((item) => (
          <path
            key={item.label}
            d={linePath(item.data)}
            fill="none"
            stroke={item.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {hovered !== null && (
          <line
            x1={xAt(hovered)}
            x2={xAt(hovered)}
            y1={PADDING_TOP}
            y2={PADDING_TOP + plotHeight}
            className="trend-hover-line"
          />
        )}

        {series.map((item) =>
          hovered !== null ? (
            <circle
              key={`${item.label}-dot`}
              cx={xAt(hovered)}
              cy={yAt(item.data[hovered] ?? 0)}
              r={3.5}
              fill={item.color}
            />
          ) : null,
        )}

        {Array.from({ length: pointCount }, (_, index) => (
          <rect
            key={index}
            x={xAt(index) - step / 2}
            y={0}
            width={step}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered((current) => (current === index ? null : current))}
          />
        ))}
      </svg>

      {hovered !== null && (
        <div className="trend-tooltip" style={{ left: `${(xAt(hovered) / WIDTH) * 100}%` }}>
          <strong>{String(hovered).padStart(2, '0')}h</strong>
          {series.map((item) => (
            <span key={item.label}>
              <i style={{ background: item.color }} aria-hidden="true" />
              {item.label}: {item.data[hovered] ?? 0}
            </span>
          ))}
        </div>
      )}

      <div className="trend-x-axis">
        {Array.from({ length: pointCount }, (_, index) => index)
          .filter((index) => index % 3 === 0)
          .map((index) => (
            <span key={index} style={{ left: `${(xAt(index) / WIDTH) * 100}%` }}>
              {index}h
            </span>
          ))}
      </div>
    </div>
  )
}
