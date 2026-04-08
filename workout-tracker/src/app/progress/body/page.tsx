import { prisma } from '@/lib/prisma'
import { BodyMetricsChart } from './BodyMetricsChart'
import { LogBodyMetricForm } from './LogBodyMetricForm'

export default async function BodyMetricsPage() {
  const metrics = await prisma.bodyMetric.findMany({
    orderBy: { date: 'desc' },
    take: 90,
  })

  const chartData = [...metrics].reverse().map((m) => ({
    date: m.date.toISOString().split('T')[0],
    weight: m.bodyWeightKg,
    hr: m.heartRateResting,
    energy: m.energyLevel,
    sleep: m.sleepHours,
  }))

  const latest = metrics[0]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Body Metrics</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">Track body weight, heart rate, sleep & energy</p>
      </div>

      {/* Log new entry */}
      <LogBodyMetricForm />

      {/* Current stats */}
      {latest && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
          {latest.bodyWeightKg && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--muted-foreground)]">Body Weight</p>
              <p className="text-xl font-bold mt-1">{latest.bodyWeightKg}kg</p>
            </div>
          )}
          {latest.heartRateResting && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--muted-foreground)]">Resting HR</p>
              <p className="text-xl font-bold mt-1 text-red-400">{latest.heartRateResting} bpm</p>
            </div>
          )}
          {latest.sleepHours && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--muted-foreground)]">Sleep</p>
              <p className="text-xl font-bold mt-1 text-blue-400">{latest.sleepHours}h</p>
            </div>
          )}
          {latest.energyLevel && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-center">
              <p className="text-xs text-[var(--muted-foreground)]">Energy</p>
              <p className="text-xl font-bold mt-1 text-yellow-400">{latest.energyLevel}/10</p>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      {chartData.length > 0 ? (
        <BodyMetricsChart data={chartData} />
      ) : (
        <div className="text-center py-12">
          <p className="text-[var(--muted-foreground)]">No metrics logged yet. Use the form above!</p>
        </div>
      )}
    </div>
  )
}
