import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Trophy, TrendingUp, Timer } from 'lucide-react'
import { buildRepMaxTable } from '@/lib/one-rm'

export default async function ProgressPage() {
  const [prs, topExercises] = await Promise.all([
    prisma.personalRecord.findMany({
      include: { exercise: true },
      orderBy: { achievedAt: 'desc' },
    }),
    prisma.exercise.findMany({
      where: {
        sets: { some: {} },
        category: { in: ['COMPOUND', 'OLYMPIC'] },
      },
      include: {
        sets: {
          where: { weightKg: { not: null }, reps: { not: null } },
          orderBy: { completedAt: 'asc' },
          select: { weightKg: true, reps: true, completedAt: true },
        },
      },
      take: 12,
    }),
  ])

  const strengthPRs = prs.filter((p) => ['ONE_RM', 'THREE_RM', 'FIVE_RM', 'TEN_RM'].includes(p.prType))
  const wodPRs = prs.filter((p) => ['WOD_TIME', 'AMRAP_SCORE'].includes(p.prType))

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Progress</h1>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link href="/progress/lifts" className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-blue-500/30 transition-colors">
          <TrendingUp className="w-5 h-5 text-blue-400 mb-2" />
          <p className="font-semibold text-sm">Strength</p>
          <p className="text-xs text-[var(--muted-foreground)]">1RM & rep max graphs</p>
        </Link>
        <Link href="/progress/metcon" className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-orange-500/30 transition-colors">
          <Timer className="w-5 h-5 text-orange-400 mb-2" />
          <p className="font-semibold text-sm">MetCon</p>
          <p className="text-xs text-[var(--muted-foreground)]">WOD times & scores</p>
        </Link>
        <Link href="/progress/body" className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-green-500/30 transition-colors">
          <Trophy className="w-5 h-5 text-green-400 mb-2" />
          <p className="font-semibold text-sm">Body</p>
          <p className="text-xs text-[var(--muted-foreground)]">Weight & HR trends</p>
        </Link>
      </div>

      {/* Strength PRs */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          Strength Records
        </h2>
        {strengthPRs.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm py-2">No strength PRs yet. Start logging!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[var(--muted-foreground)] border-b border-[var(--border)]">
                  <th className="text-left py-2 pr-4 font-medium">Exercise</th>
                  <th className="text-right py-2 pr-4 font-medium">1RM (Est.)</th>
                  <th className="text-right py-2 pr-4 font-medium">3RM</th>
                  <th className="text-right py-2 pr-4 font-medium">5RM</th>
                  <th className="text-right py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  strengthPRs.reduce((acc, pr) => {
                    if (!acc[pr.exercise.name]) acc[pr.exercise.name] = {}
                    acc[pr.exercise.name][pr.prType] = pr
                    return acc
                  }, {} as Record<string, Record<string, typeof strengthPRs[0]>>)
                ).slice(0, 10).map(([exerciseName, records]) => (
                  <tr key={exerciseName} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{exerciseName}</td>
                    <td className="py-2.5 pr-4 text-right text-blue-400 font-semibold">
                      {records.ONE_RM ? `${records.ONE_RM.value}kg` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {records.THREE_RM ? `${records.THREE_RM.weightKg}kg` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {records.FIVE_RM ? `${records.FIVE_RM.weightKg}kg` : '—'}
                    </td>
                    <td className="py-2.5 text-right text-xs text-[var(--muted-foreground)]">
                      {(records.ONE_RM ?? records.THREE_RM ?? records.FIVE_RM)?.achievedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WOD PRs */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Timer className="w-4 h-4 text-orange-400" />
          MetCon Records
        </h2>
        {wodPRs.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm py-2">No MetCon records yet.</p>
        ) : (
          <div className="space-y-2">
            {wodPRs.slice(0, 8).map((pr) => (
              <div key={pr.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm font-medium">{pr.exercise.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-orange-400">
                    {pr.prType === 'WOD_TIME'
                      ? `${Math.floor(pr.value / 60)}:${String(pr.value % 60).padStart(2, '0')}`
                      : `${pr.value} reps`}
                  </span>
                  {pr.isRx && (
                    <span className="text-[10px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded font-bold">RX</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
