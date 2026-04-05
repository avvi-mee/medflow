'use client'

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  fillColor?: string
}

export default function Sparkline({
  values,
  width = 80,
  height = 28,
  color = '#3b82f6',
  fillColor,
}: SparklineProps) {
  if (!values || values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const padX = 2
  const padY = 2
  const w = width  - padX * 2
  const h = height - padY * 2

  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * w
    const y = padY + h - ((v - min) / range) * h
    return [x, y] as [number, number]
  })

  // Build smooth SVG path using simple line segments
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')

  // Fill area under line
  const fillPath = fillColor
    ? `${linePath} L${points[points.length - 1][0].toFixed(1)},${(padY + h).toFixed(1)} L${padX},${(padY + h).toFixed(1)} Z`
    : null

  const last = points[points.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      {fillPath && (
        <path d={fillPath} fill={fillColor} opacity="0.15" />
      )}
      <path d={linePath} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot at last value */}
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  )
}
