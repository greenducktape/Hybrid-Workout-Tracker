import { prisma } from '@/lib/prisma'
import { estimateOneRM, buildRepMaxTable } from '@/lib/one-rm'
import { LiftProgressChart } from './LiftProgressChart'
import { LiftProjectionChart } from './LiftProjectionChart'
import { projectLifts, buildCombinedChartData } from '@/lib/projection'
import { getTrainingMaxes } from '@/actions/sbs'
import { ALL_TRACKED_LIFTS, LIFT_ALIASES } from '@/lib/sbs-engine'

// Default increment per lift if not in the TM table
const DEFAULT_INCREMENTS: Record<string, number> = {
  'Back Squat': 5,
  'Deadlift': 5,
  'Bench Press': 2.5,
  'Overhead Press': 2.5,
  'Barbell Row': 2.5,
  'Romanian Deadlift': 2.5,
}

export default async function LiftProgressPage() {
  const [exercises, trainingMaxes] = await Promise.all([
    prisma.exercise.findMany({
      where: {
        sets: {
          some: { weightKg: { not: null }, reps: { not: null } },
        },
      },
      include: {
        sets: {
          where: { weightKg: { not: null }, reps: { not: null } },
          orderBy: { completedAt: 'asc' },
          select: {
            weightKg: true,
            reps: true,
            completedAt: true,
            block: { select: { session: { select: { date: true } } } },
          },
        },
        personalRecords: true,
      },
      orderBy: { name: 'asc' },
    }),
    getTrainingMaxes(),
  ])

  const tmByName = Object.fromEntries(trainingMaxes.map((t) => [t.exerciseName, t]))

  // Build chart data per exercise: daily best estimated 1RM
  const exerciseData = exercises.map((ex) => {
    const byDate: Record<string, number> = {}
    for (const s of ex.sets) {
      const date = s.block.session.date.toISOString().split('T')[0]
      const est = estimateOneRM(s.weightKg!, s.reps!)
      if (est > 0 && (!byDate[date] || est > byDate[date])) {
        byDate[date] = est
      }
    }

    const chartData = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, oneRM]) => ({ date, oneRM: Math.round(oneRM * 10) / 10 }))

    const repMaxes = buildRepMaxTable(ex.sets as any)
    const currentPR = ex.personalRecords.find((p) => p.prType === 'ONE_RM')

    return { id: ex.id, name: ex.name, chartData, repMaxes, currentPR: currentPR?.value ?? null }
  }).filter((e) => e.chartData.length > 0)

  // ─── Projection data for SBS-tracked lifts ────────────────────────
  // Map alias names back to canonical names for lookup
  const aliasToCanonical: Record<string, string> = {}
  for (const [canonical, aliases] of Object.entries(LIFT_ALIASES)) {
    for (const alias of aliases) aliasToCanonical[alias] = canonical
  }

  // Only project lifts we have a TM for
  const projectionInputs = trainingMaxes.map((tm) => ({
    exerciseName: tm.exerciseName,
    currentTMKg: tm.trainingMaxKg,
    currentOneRmKg: tm.oneRmKg,
    incrementKg: DEFAULT_INCREMENTS[tm.exerciseName] ?? 2.5,
  }))

  const projectionsByLift = projectionInputs.length > 0
    ? projectLifts(projectionInputs, 20)
    : {}

  // Build combined (historical + projection) chart data per lift
  const today = new Date().toISOString().split('T')[0]

  const projectionCharts = projectionInputs.map((input) => {
    const projection = projectionsByLift[input.exerciseName] ?? []

    // Find historical data from either canonical name or Hevy aliases
    const canonicalName = input.exerciseName
    const aliasNames = LIFT_ALIASES[canonicalName] ?? []
    const allNames = [canonicalName, ...aliasNames]

    const matchingExercise = exerciseData.find((e) => allNames.includes(e.name))
    const historicalData = matchingExercise?.chartData ?? []

    const combined = buildCombinedChartData(historicalData, projection, today)
    const tm = tmByName[input.exerciseName]

    return {
      exerciseName: canonicalName,
      combined,
      currentOneRM: input.currentOneRmKg,
      trainingMaxKg: tm?.trainingMaxKg ?? 0,
      in20weeks: projection[20]?.realistic ?? 0,
    }
  }).filter((p) => p.combined.length > 0)

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Strength Progress</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">Historical 1RM · Projected trajectory</p>
      </div>

      {/* ─── Projection charts (SBS tracked lifts) ─── */}
      {projectionCharts.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-base mb-3">20-Week Projection</h2>
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            {projectionCharts.map((p) => (
              <div key={p.exerciseName} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold">{p.exerciseName}</h3>
                  <div className="text-right">
                    <p className="text-xs text-[var(--muted-foreground)]">Now · ~{p.currentOneRM}kg</p>
                    <p className="text-xs text-green-400 font-medium">→ ~{p.in20weeks}kg in 20 wks</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mb-3">
                  TM {p.trainingMaxKg}kg · Solid = actual · Dashed = projected
                </p>
                <LiftProjectionChart data={p.combined} currentOneRM={p.currentOneRM} />
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500 inline-block" /> Actual</span>
                  <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500 inline-block opacity-60 border-dashed border-t border-blue-500" /> Realistic (65%)</span>
                  <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-green-400 inline-block" /> Optimistic (90%)</span>
                  <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-orange-400 inline-block" /> Pessimistic (40%)</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--muted-foreground)] px-1">
            Assumes ~1 session/week per lift. Beat rates: optimistic 90%, realistic 65%, pessimistic 40% of AMRAP sets beaten.
          </p>
        </div>
      )}

      {/* ─── All exercises (historical only) ─── */}
      <h2 className="font-semibold text-base mb-3">All Lifts — Historical</h2>
      {exerciseData.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--muted-foreground)]">No strength data yet. Log some workouts!</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {exerciseData.map((ex) => (
            <div key={ex.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{ex.name}</h3>
                  {ex.currentPR && (
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      Best Est. 1RM: <span className="text-blue-400 font-semibold">{ex.currentPR}kg</span>
                    </p>
                  )}
                </div>
              </div>
              <LiftProgressChart data={ex.chartData} />
              {ex.repMaxes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <div className="flex gap-2 flex-wrap">
                    {ex.repMaxes.map((rm) => (
                      <div key={rm.reps} className="text-center bg-[var(--muted)] rounded-lg px-3 py-1.5">
                        <p className="text-xs text-[var(--muted-foreground)]">{rm.label}</p>
                        <p className="text-sm font-bold">{rm.weight}kg</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
