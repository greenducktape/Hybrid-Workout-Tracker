import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Calendar, Trophy, Zap } from 'lucide-react'
import { getTrainingPhase, daysUntil } from '@/lib/utils'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function ProgramPage() {
  const [competition, recentSessions] = await Promise.all([
    prisma.competition.findFirst({
      where: { date: { gte: new Date() } },
      orderBy: { date: 'asc' },
    }),
    prisma.workoutSession.findMany({
      where: { completedAt: { not: null } },
      orderBy: { date: 'desc' },
      take: 14,
      select: { date: true, template: true, dayOfWeek: true },
    }),
  ])

  const currentPhase = getTrainingPhase(competition?.date ?? null)

  // Build last 4 weeks calendar
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weeks: Date[][] = []
  const startOfCurrentWeek = new Date(today)
  startOfCurrentWeek.setDate(today.getDate() - today.getDay())

  for (let w = 3; w >= 0; w--) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(startOfCurrentWeek)
      date.setDate(startOfCurrentWeek.getDate() - w * 7 + d)
      week.push(date)
    }
    weeks.push(week)
  }

  const sessionDates = new Set(
    recentSessions.map((s) => s.date.toISOString().split('T')[0])
  )

  const phaseDescriptions: Record<string, string> = {
    BASE: 'Focus on volume and building aerobic capacity. Higher rep ranges, varied movement patterns.',
    STRENGTH: 'Increase intensity on main lifts. 3-5 rep ranges, focus on compound movements.',
    PEAK: 'PR attempts and competition-specific movements. High intensity, lower volume.',
    TAPER: 'Reduce volume 40-60%. Keep intensity. Fresh for competition.',
    OFFSEASON: 'Active recovery. Work on weaknesses, skill development.',
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Program</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/program/competition"
            className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <Trophy className="w-4 h-4" />
            Competition
          </Link>
        </div>
      </div>

      {/* Beat the Logbook CTA */}
      <Link
        href="/program/sbs"
        className="flex items-center gap-4 bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-xl p-4 mb-4 transition-colors group"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-blue-400" fill="currentColor" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Beat the Logbook</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Science-based auto-progression — knows exactly what weight and reps to do next
          </p>
        </div>
        <span className="text-xs text-blue-400 font-medium group-hover:translate-x-0.5 transition-transform">
          Open →
        </span>
      </Link>

      {/* Phase indicator */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Current Phase</p>
            <p className="text-2xl font-black mt-0.5">{currentPhase}</p>
          </div>
          {competition && (
            <div className="text-right">
              <p className="text-xs text-[var(--muted-foreground)]">Next Competition</p>
              <p className="font-bold text-sm">{competition.name}</p>
              <p className="text-orange-400 text-sm font-semibold">{daysUntil(competition.date)} days out</p>
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">{phaseDescriptions[currentPhase]}</p>
      </div>

      {/* Training calendar - last 4 weeks */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          Training Calendar (Last 4 Weeks)
        </h2>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs text-[var(--muted-foreground)] font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const dateStr = day.toISOString().split('T')[0]
                const isToday = dateStr === today.toISOString().split('T')[0]
                const hasSession = sessionDates.has(dateStr)
                const isFuture = day > today

                return (
                  <div
                    key={dateStr}
                    className={`
                      h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors
                      ${isToday ? 'ring-2 ring-blue-500 bg-blue-500/15 text-blue-400' : ''}
                      ${hasSession && !isToday ? 'bg-green-500/20 text-green-400' : ''}
                      ${!hasSession && !isToday && !isFuture ? 'bg-[var(--muted)] text-[var(--muted-foreground)]' : ''}
                      ${isFuture ? 'text-[var(--border)]' : ''}
                    `}
                  >
                    {day.getDate()}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-[var(--muted-foreground)]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500/20" />
            Completed
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded ring-2 ring-blue-500" />
            Today
          </div>
        </div>
      </div>

      {/* Recommended weekly structure */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
        <h2 className="font-semibold text-sm mb-3">Recommended Weekly Structure</h2>
        <div className="space-y-2">
          {[
            { day: 'Monday', session: 'Squat Day', detail: 'Back Squat + Leg accessories + MetCon' },
            { day: 'Tuesday', session: 'Press Day', detail: 'Bench Press + Upper push accessories' },
            { day: 'Wednesday', session: 'CrossFit', detail: 'Olympic lifting + Gymnastics + MetCon' },
            { day: 'Thursday', session: 'Rest / Active Recovery', detail: 'Mobility, light cardio' },
            { day: 'Friday', session: 'Deadlift Day', detail: 'Deadlift + Posterior chain + MetCon' },
            { day: 'Saturday', session: 'Pull Day', detail: 'Weighted pull-ups + Row variations + MetCon' },
            { day: 'Sunday', session: 'Rest', detail: '' },
          ].map(({ day, session, detail }) => (
            <div key={day} className="flex items-start gap-3">
              <span className="text-xs text-[var(--muted-foreground)] w-20 shrink-0 pt-0.5">{day}</span>
              <div>
                <p className="text-sm font-medium">{session}</p>
                {detail && <p className="text-xs text-[var(--muted-foreground)]">{detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
