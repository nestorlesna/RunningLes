'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface ChartPoint {
  t: number // seconds from session start
  v: number // value
}

interface Props {
  data: ChartPoint[]
  color: string
  formatY: (v: number) => string
  formatX: (seconds: number) => string
  yUnit: string
  noDataMessage?: string
}

function fmtSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

// Reduce to at most maxPts evenly-spaced points
function downsample(data: ChartPoint[], maxPts = 600): ChartPoint[] {
  if (data.length <= maxPts) return data
  const step = Math.ceil(data.length / maxPts)
  return data.filter((_, i) => i % step === 0 || i === data.length - 1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, formatY, formatX }: any) {
  if (!active || !payload?.length) return null
  const { t, v } = payload[0].payload as ChartPoint
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-0.5">{fmtSeconds(t)}</p>
      <p className="text-white font-semibold">{formatY(v)}</p>
    </div>
  )
}

export function GpsChart({ data, color, formatY, formatX, yUnit, noDataMessage }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-36 text-gray-600 text-xs">
        {noDataMessage ?? 'Sin datos suficientes'}
      </div>
    )
  }

  const pts = downsample(data)

  // X axis tick: show ~5 evenly spaced labels
  const tMin = pts[0].t
  const tMax = pts[pts.length - 1].t
  const tickInterval = Math.ceil(pts.length / 5)

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={pts} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${yUnit}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

        <XAxis
          dataKey="t"
          type="number"
          domain={[tMin, tMax]}
          tickFormatter={(v) => formatX(v - tMin)}
          interval={tickInterval}
          tick={{ fill: '#475569', fontSize: 10 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
        />

        <YAxis
          dataKey="v"
          tickFormatter={formatY}
          tick={{ fill: '#475569', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />

        <Tooltip
          content={<CustomTooltip formatY={formatY} formatX={formatX} />}
          cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 2' }}
        />

        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#fill-${yUnit})`}
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: '#0f172a', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
