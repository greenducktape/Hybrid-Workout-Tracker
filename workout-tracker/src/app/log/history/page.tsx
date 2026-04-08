import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { formatDuration } from '@/lib/utils'
import { Dumbbell, Clock, Zap } from 'lucide-react'

export default async function HistoryPage() {
  const sessions = await prisma.workoutSession.findMany({
    where: { completedAt: { not: null } },
    orderBy: { date: 'desc' },
    take: 50,
    include: {
      blocks: {
        include: {
          sets: { include: { exercise: true }, take: 1 },
          metconResult: { select: { wodName: true, wodType: true } },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Workout History</h1>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--muted-foreground)] mb-4">No completed workouts yet.</p>
          <Link href="/log" className="text-blue-400 hover:underline text-sm">
            Log your first workout →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const mainLifts = session.blocks
              .filter((b) => b.blockType === 'MAIN_LIFT')
              .flatMap((b) => b.sets)
              .map((s) => s.exercise.name)
              .filter((v, i, a) => a.indexOf(v) === i)
              .slice(0, 2)

            const metcons = session.blocks
              .filter((b) => b.blockType === 'METCON' && b.metconResult)
              .map((b) => b.metconResult!.wodName ?? b.metconResult!.wodType)

            return (
              <Link
                key={session.id}
                href={`/log/${session.id}`}
                className="flex items-center justify-between p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:border-blue-500/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0">
                    <Dumbbell className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {session.template ?? mainLifts.join(' + ') ?? 'Workout'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {session.date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      {metcons.length > 0 && (
                        <span className="text-xs text-orange-400">+ {metcons[0]}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                  {session.durationMinutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {session.durationMinutes}m
                    </div>
                  )}
                  {session.perceivedEffort && (
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      RPE {session.perceivedEffort}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
