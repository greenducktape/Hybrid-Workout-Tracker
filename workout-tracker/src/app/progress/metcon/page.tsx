import { prisma } from '@/lib/prisma'
import { formatTime } from '@/lib/utils'
import { Timer, TrendingDown } from 'lucide-react'

export default async function MetConProgressPage() {
  const metconResults = await prisma.metConResult.findMany({
    where: {
      OR: [
        { completionSeconds: { not: null } },
        { roundsCompleted: { not: null } },
      ],
    },
    include: {
      block: {
        include: { session: { select: { date: true } } },
      },
    },
    orderBy: { block: { session: { date: 'desc' } } },
  })

  // Group by WOD name
  const wodGroups: Record<string, typeof metconResults> = {}
  for (const r of metconResults) {
    const key = r.wodName ?? `${r.wodType} WOD`
    if (!wodGroups[key]) wodGroups[key] = []
    wodGroups[key].push(r)
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">MetCon Progress</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">WOD times, AMRAP scores, and benchmarks</p>
      </div>

      {Object.keys(wodGroups).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--muted-foreground)]">No MetCon data yet. Add a MetCon block to your workout!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(wodGroups).map(([wodName, results]) => {
            const sorted = [...results].sort(
              (a, b) => a.block.session.date.getTime() - b.block.session.date.getTime()
            )
            const best = results.reduce((b, r) => {
              if (!b) return r
              if (r.completionSeconds && b.completionSeconds) {
                return r.completionSeconds < b.completionSeconds ? r : b
              }
              if (r.roundsCompleted && b.roundsCompleted) {
                const rTotal = (r.roundsCompleted ?? 0) * 100 + (r.repsCompleted ?? 0)
                const bTotal = (b.roundsCompleted ?? 0) * 100 + (b.repsCompleted ?? 0)
                return rTotal > bTotal ? r : b
              }
              return b
            }, null as typeof results[0] | null)

            return (
              <div key={wodName} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{wodName}</h3>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {results[0].wodType} · {results.length} attempt{results.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  {best && (
                    <div className="text-right">
                      <p className="text-xs text-[var(--muted-foreground)]">Best</p>
                      <p className="font-bold text-orange-400">
                        {best.completionSeconds
                          ? formatTime(best.completionSeconds)
                          : `${best.roundsCompleted}+${best.repsCompleted ?? 0}`}
                      </p>
                      {best.isRx && (
                        <span className="text-[10px] bg-green-500/15 text-green-400 px-1 py-0.5 rounded">RX</span>
                      )}
                    </div>
                  )}
                </div>

                {/* History list */}
                <div className="space-y-1.5">
                  {sorted.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-[var(--muted-foreground)] text-xs">
                        {r.block.session.date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: '2-digit',
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {r.completionSeconds
                            ? formatTime(r.completionSeconds)
                            : `${r.roundsCompleted}+${r.repsCompleted ?? 0}`}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          r.isRx ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                        }`}>
                          {r.isRx ? 'RX' : 'Scaled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
