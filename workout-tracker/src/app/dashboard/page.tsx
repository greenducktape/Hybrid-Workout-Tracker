import { prisma } from '@/lib/prisma'
import { daysUntil, formatDuration, getTrainingPhase } from '@/lib/utils'
import { estimateOneRM } from '@/lib/one-rm'
import { calculateMuscleVolume } from '@/lib/volume'
import Link from 'next/link'
import { Dumbbell, TrendingUp, Trophy, Calendar, Plus, Zap, Target } from 'lucide-react'

export default async function DashboardPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [recentSessions, recentPRs, competition, totalSessions] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { completedAt: { not: null } },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        blocks: {
          include: { sets: { include: { exercise: true } }, metconResult: true },
        },
      },
    }),
    prisma.personalRecord.findMany({
      where: { achievedAt: { gte: sevenDaysAgo } },
      include: { exercise: true },
      orderBy: { achievedAt: 'desc' },
      take: 6,
    }),
    prisma.competition.findFirst({
      where: { date: { gte: new Date() } },
      orderBy: { date: 'asc' },
    }),
    prisma.workoutSession.count({ where: { completedAt: { not: null } } }),
  ])

  const currentPhase = getTrainingPhase(competition?.date ?? null)
  const daysToComp = competition ? daysUntil(competition.date) : null

  // Weekly volume
  const weeklySets = recentSessions
    .filter((s) => s.date >= sevenDaysAgo)
    .flatMap((s) => s.blocks.flatMap((b) => b.sets))
  const muscleVolume = calculateMuscleVolume(weeklySets).slice(0, 6)

  // Weekly stats
  const weeklySessionCount = recentSessions.filter((s) => s.date >= sevenDaysAgo).length
  const weeklyMinutes = recentSessions
    .filter((s) => s.date >= sevenDaysAgo)
    .reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)

  const phaseColors: Record<string, string> = {
    BASE: 'text-green-400',
    STRENGTH: 'text-blue-400',
    PEAK: 'text-orange-400',
    TAPER: 'text-yellow-400',
    OFFSEASON: 'text-[var(--muted-foreground)]',
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/log"
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Workout
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Workouts"
          value={totalSessions.toString()}
          icon={<Dumbbell className="w-4 h-4 text-blue-400" />}
        />
        <StatCard
          label="This Week"
          value={`${weeklySessionCount} sessions`}
          sub={weeklyMinutes > 0 ? formatDuration(weeklyMinutes) : undefined}
          icon={<Calendar className="w-4 h-4 text-green-400" />}
        />
        <StatCard
          label="Phase"
          value={currentPhase}
          valueClass={phaseColors[currentPhase]}
          icon={<Zap className="w-4 h-4 text-yellow-400" />}
        />
        <StatCard
          label="Next Competition"
          value={competition ? competition.name : 'None set'}
          sub={daysToComp !== null ? `${daysToComp} days out` : undefined}
          icon={<Target className="w-4 h-4 text-orange-400" />}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Weekly Volume */}
        <div className="lg:col-span-2 bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Weekly Volume (Hard Sets)</h2>
            <Link href="/progress" className="text-xs text-blue-400 hover:underline">See all</Link>
          </div>
          {muscleVolume.length === 0 ? (
            <p className="text-[var(--muted-foreground)] text-sm py-4">No workouts logged this week.</p>
          ) : (
            <div className="space-y-2.5">
              {muscleVolume.map((v) => (
                <div key={v.muscle}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--muted-foreground)]">{v.label}</span>
                    <span className="font-medium">{v.hardSets} sets</span>
                  </div>
                  <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (v.hardSets / 20) * 100)}%`,
                        backgroundColor: v.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Competition Countdown */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <h2 className="font-semibold text-sm">Competition</h2>
          </div>
          {competition ? (
            <div>
              <p className="font-bold text-lg">{competition.name}</p>
              <p className="text-[var(--muted-foreground)] text-xs mb-3">{competition.type}</p>
              <div className="text-center py-4 bg-[var(--muted)] rounded-lg">
                <div className="text-4xl font-black text-blue-400">{daysToComp}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1">days out</div>
              </div>
              <p className={`text-center mt-2 text-sm font-semibold ${phaseColors[currentPhase]}`}>
                {currentPhase} Phase
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-[var(--muted-foreground)] text-sm mb-3">No competition set</p>
              <Link
                href="/program/competition"
                className="text-blue-400 text-xs hover:underline"
              >
                Add competition goal →
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent PRs */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h2 className="font-semibold text-sm">Recent PRs (7 days)</h2>
            </div>
            <Link href="/progress" className="text-xs text-blue-400 hover:underline">All PRs</Link>
          </div>
          {recentPRs.length === 0 ? (
            <p className="text-[var(--muted-foreground)] text-sm py-4">No PRs this week. Time to hit one!</p>
          ) : (
            <div className="space-y-2">
              {recentPRs.map((pr) => (
                <div key={pr.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-sm font-medium">{pr.exercise.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{pr.prType.replace('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-400">
                      {pr.prType === 'WOD_TIME'
                        ? `${Math.floor(pr.value / 60)}:${String(pr.value % 60).padStart(2, '0')}`
                        : `${pr.value}${pr.prType === 'ONE_RM' || pr.prType.includes('RM') ? 'kg' : ''}`}
                    </span>
                    <span className="text-[10px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded font-bold">PR</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-blue-400" />
              <h2 className="font-semibold text-sm">Recent Sessions</h2>
            </div>
            <Link href="/log/history" className="text-xs text-blue-400 hover:underline">History</Link>
          </div>
          {recentSessions.length === 0 ? (
            <p className="text-[var(--muted-foreground)] text-sm py-4">
              No workouts yet.{' '}
              <Link href="/log" className="text-blue-400 hover:underline">Start your first!</Link>
            </p>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session) => {
                const mainLifts = session.blocks
                  .filter((b) => b.blockType === 'MAIN_LIFT')
                  .flatMap((b) => b.sets)
                  .map((s) => s.exercise.name)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .slice(0, 2)
                return (
                  <Link
                    key={session.id}
                    href={`/log/${session.id}`}
                    className="flex items-center justify-between py-1.5 hover:bg-[var(--muted)] -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {session.template ?? mainLifts.join(' + ') ?? 'Workout'}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {session.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {session.durationMinutes ? ` · ${session.durationMinutes}m` : ''}
                      </p>
                    </div>
                    {session.perceivedEffort && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        RPE {session.perceivedEffort}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon,
  valueClass,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
        {icon}
      </div>
      <p className={`text-lg font-bold leading-tight ${valueClass ?? ''}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{sub}</p>}
    </div>
  )
}
