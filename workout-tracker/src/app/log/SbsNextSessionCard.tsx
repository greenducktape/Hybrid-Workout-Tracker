'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startSbsSession } from '@/actions/sbs'
import type { SbsOverview } from '@/actions/sbs'
import { Zap, Play, Target, Loader2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DayNumber } from '@/lib/sbs-engine'

interface Props {
  overview: SbsOverview
}

export function SbsNextSessionCard({ overview }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const nextDay = overview.days.find((d) => d.dayNumber === overview.nextDayNumber)
  if (!nextDay) return null

  // Don't show if no TMs and no Hevy data at all
  if (!overview.hasAnyTMs) return null

  function handleStart(dayNumber: DayNumber) {
    setError(null)
    startTransition(async () => {
      const result = await startSbsSession(dayNumber)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.push(`/log/${result.sessionId}`)
    })
  }

  return (
    <div className="bg-[var(--card)] border border-blue-500/25 rounded-xl overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-500/8 border-b border-blue-500/20">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" fill="currentColor" />
          <div>
            <p className="text-xs text-blue-400 font-medium">Recommended Next Session</p>
            <p className="font-bold text-sm">{nextDay.label}</p>
          </div>
        </div>
        <button
          onClick={() => handleStart(nextDay.dayNumber)}
          disabled={isPending}
          className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" fill="currentColor" />
          )}
          Start
        </button>
      </div>

      {/* Exercise prescription */}
      <div className="px-4 py-3 space-y-2">
        {nextDay.nextPrescription.map((ex) => (
          <div key={ex.exerciseName} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded',
                ex.isTracked
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
              )}>
                {ex.isTracked ? 'MAIN' : 'ACC'}
              </span>
              <span className={ex.tmAvailable ? '' : 'text-[var(--muted-foreground)]'}>
                {ex.exerciseName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {ex.tmAvailable ? (
                <>
                  <span className="text-[var(--muted-foreground)]">
                    {ex.sets}×{ex.repsTarget}
                  </span>
                  <span className="font-bold text-blue-400">{ex.weightKg}kg</span>
                  {ex.isTracked && (
                    <span className="flex items-center gap-0.5 text-orange-400">
                      <Target className="w-3 h-3" />
                      {ex.repsTarget}+
                    </span>
                  )}
                </>
              ) : (
                <span className="text-amber-400 text-xs">no data</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Last time this day was done */}
      {nextDay.lastSession && (
        <div className="px-4 pb-3 border-t border-[var(--border)] pt-2 mt-1">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">
            Last {nextDay.shortLabel}: {new Date(nextDay.lastSession.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          <div className="flex flex-wrap gap-2">
            {nextDay.lastSession.exercises
              .filter((e) => e.amrapActualReps !== null)
              .map((e) => (
                <span key={e.exerciseName} className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-0.5 rounded">
                  {e.progressionTriggered && (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  )}
                  {e.exerciseName.split(' ').pop()} {e.weightKg}kg × {e.amrapActualReps}
                </span>
              ))}
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
