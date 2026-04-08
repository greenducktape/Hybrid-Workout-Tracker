'use client'

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'

interface DataPoint {
  date: string
  weight: number | null
  hr: number | null
  energy: number | null
  sleep: number | null
}

export function BodyMetricsChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="space-y-4">
      {/* Weight chart */}
      {data.some((d) => d.weight) && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Body Weight (kg)</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(v) => {
                    const d = new Date(v)
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
                  domain={['dataMin - 2', 'dataMax + 2']}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v}kg`, 'Weight']}
                />
                <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* HR & Sleep chart */}
      {(data.some((d) => d.hr) || data.some((d) => d.sleep)) && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Recovery Metrics</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(v) => {
                    const d = new Date(v)
                    return `${d.getMonth() + 1}/${d.getDate()}`
                  }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="hr"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="sleep"
                  orientation="right"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 12]}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Line yAxisId="hr" type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls name="Resting HR (bpm)" />
                <Bar yAxisId="sleep" dataKey="sleep" fill="#3b82f640" name="Sleep (h)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
