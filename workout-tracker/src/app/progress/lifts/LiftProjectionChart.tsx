'use client'

import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from 'recharts'

interface DataPoint {
  date: string
  label: string
  historical?: number
  realistic?: number
  optimistic?: number
  pessimistic?: number
  isPast: boolean
}

interface Props {
  data: DataPoint[]
  currentOneRM: number
}

export function LiftProjectionChart({ data, currentOneRM }: Props) {
  if (data.length === 0) return null

  // Find the "Now" index to draw a reference line
  const nowDate = data.find((d) => d.label === 'Now')?.date

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickFormatter={(v) => {
              const d = new Date(v + 'T00:00:00')
              return `${d.getMonth() + 1}/${d.getDate()}`
            }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}kg`}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--foreground)',
            }}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                historical: 'Actual 1RM',
                realistic: 'Projected (realistic)',
                optimistic: 'Optimistic',
                pessimistic: 'Pessimistic',
              }
              return [`${value}kg`, labels[name as string] ?? name]
            }}
            labelFormatter={(label) => {
              try {
                return new Date(label + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              } catch {
                return label
              }
            }}
          />

          {/* Today reference line */}
          {nowDate && (
            <ReferenceLine
              x={nowDate}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: 'Today', position: 'insideTopRight', fontSize: 9, fill: 'var(--muted-foreground)' }}
            />
          )}

          {/* Optimistic–pessimistic band (future only) */}
          <Area
            type="monotone"
            dataKey="optimistic"
            fill="#3b82f620"
            stroke="transparent"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="pessimistic"
            fill="var(--background)"
            stroke="transparent"
            connectNulls
          />

          {/* Historical line — solid */}
          <Line
            type="monotone"
            dataKey="historical"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={false}
            connectNulls
            activeDot={{ r: 4, fill: '#3b82f6' }}
          />

          {/* Realistic projection — dashed */}
          <Line
            type="monotone"
            dataKey="realistic"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
            activeDot={{ r: 3, fill: '#3b82f6' }}
          />

          {/* Optimistic projection — faint */}
          <Line
            type="monotone"
            dataKey="optimistic"
            stroke="#22c55e"
            strokeWidth={1}
            strokeDasharray="3 4"
            dot={false}
            connectNulls
          />

          {/* Pessimistic projection — faint */}
          <Line
            type="monotone"
            dataKey="pessimistic"
            stroke="#f97316"
            strokeWidth={1}
            strokeDasharray="3 4"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
