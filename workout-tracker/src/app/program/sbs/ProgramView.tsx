'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startSbsSession, setSbsProgramSettings, setTrainingMax, setTrainingGoal } from '@/actions/sbs'
import type { SbsOverview } from '@/actions/sbs'
import type { DayNumber, TrainingGoal } from '@/lib/sbs-engine'
import {
  Play, TrendingUp, TrendingDown, Target, Loader2, ChevronDown, ChevronUp,
  Dumbbell, AlertCircle, Check, ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  overview: SbsOverview
}

const ACCESSORY_SWAP_KEYS = ['day1_slot1', 'day1_slot2', 'day2_slot1', 'day3_slot1', 'day3_slot2'] as const

export function ProgramView({ overview }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [startingDay, setStartingDay] = useState<DayNumber | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [goal, setGoalState] = useState<TrainingGoal>(overview.trainingGoal)
  const [goalPending, startGoalTransition] = useTransition()
  const [settings, setSettings] = useState(overview.settings)
  const [settingsPending, startSettingsTransition] = useTransition()

  function handleGoalChange(newGoal: TrainingGoal) {
    setGoalState(newGoal)
    startGoalTransition(async () => {
      await setTrainingGoal(newGoal)
    })
  }

  function handleStart(dayNumber: DayNumber) {
    setStartingDay(dayNumber)
    setError(null)
    startTransition(async () => {
      const result = await startSbsSession(dayNumber)
      if ('error' in result) {
        setError(result.error)
        setStartingDay(null)
        return
      }
      router.push(`/log/${result.sessionId}`)
    })
  }

  function updateSettings(patch: Partial<typeof settings>) {
    const nextAccessorySwaps = {
      ...settings.accessorySwaps,
      ...(patch.accessorySwaps ?? {}),
    }
    for (const [key, value] of Object.entries(nextAccessorySwaps)) {
      if (!value) delete nextAccessorySwaps[key]
    }
    const next = { ...settings, ...patch, accessorySwaps: nextAccessorySwaps }
    setSettings(next)
    startSettingsTransition(async () => {
      await setSbsProgramSettings({ ...patch, accessorySwaps: patch.accessorySwaps ?? {} })
    })
  }

  return (
    <div className="space-y-4">
      {/* Missing lifts warning */}
      {overview.missingLifts.length > 0 && (
        <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-400 mb-1">No history found for:</p>
            <p className="text-[var(--muted-foreground)]">{overview.missingLifts.join(', ')}</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Log a few sets for these lifts and they&apos;ll auto-populate next time.
            </p>
          </div>
        </div>
      )}

      {/* Training goal toggle */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Training Goal</p>
          {goalPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--muted-foreground)]" />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'strength', label: 'Strength', desc: '3–5 reps · 80–85% TM' },
            { value: 'hypertrophy', label: 'Hypertrophy', desc: '8–12 reps · 65–72% TM' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleGoalChange(opt.value)}
              className={cn(
                'text-left p-3 rounded-lg border transition-colors',
                goal === opt.value
                  ? 'border-blue-500/40 bg-blue-500/10'
                  : 'border-[var(--border)] hover:border-[var(--muted-foreground)]/30'
              )}
            >
              <p className={cn('text-sm font-semibold', goal === opt.value ? 'text-blue-400' : '')}>
                {opt.label}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Program Settings (Week {overview.nextWeekNumber})</p>
          {settingsPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--muted-foreground)]" />}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-[var(--muted-foreground)]">Primary sets
            <input type="number" min={1} max={8} value={settings.primarySets}
              onChange={(e) => updateSettings({ primarySets: Number(e.target.value) || 4 })}
              className="mt-1 w-full bg-[var(--muted)] rounded-lg px-2 py-1 text-sm" />
          </label>
          <label className="text-xs text-[var(--muted-foreground)]">Accessory sets
            <input type="number" min={1} max={8} value={settings.accessorySets}
              onChange={(e) => updateSettings({ accessorySets: Number(e.target.value) || 3 })}
              className="mt-1 w-full bg-[var(--muted)] rounded-lg px-2 py-1 text-sm" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.deloadEvery7thWeek}
            onChange={(e) => updateSettings({ deloadEvery7thWeek: e.target.checked })}
          />
          Deload every 7th week
        </label>
        <div className="space-y-2">
          <p className="text-xs text-[var(--muted-foreground)]">Accessory swaps</p>
          {ACCESSORY_SWAP_KEYS.map((slotKey) => (
            <label key={slotKey} className="flex items-center justify-between gap-2 text-xs">
              <span className="uppercase">{slotKey.replace('_', ' ')}</span>
              <select
                value={settings.accessorySwaps[slotKey] ?? ''}
                onChange={(e) => updateSettings({ accessorySwaps: { [slotKey]: e.target.value } })}
                className="bg-[var(--muted)] rounded px-2 py-1 text-xs max-w-56"
              >
                <option value="">Default</option>
                {overview.accessoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.name}>{opt.name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      {/* 3-day grid */}
      <div className="space-y-3">
        {overview.days.map((day) => {
          const isNext = day.dayNumber === overview.nextDayNumber
          return (
            <DayCard
              key={day.dayNumber}
              day={day}
              isNext={isNext}
              isLoading={isPending && startingDay === day.dayNumber}
              onStart={() => handleStart(day.dayNumber)}
            />
          )
        })}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Training maxes */}
      <TrainingMaxesCard tms={overview.trainingMaxes} />
    </div>
  )
}

// ─── Day Card ─────────────────────────────────────────────────────────

function DayCard({
  day,
  isNext,
  isLoading,
  onStart,
}: {
  day: SbsOverview['days'][0]
  isNext: boolean
  isLoading: boolean
  onStart: () => void
}) {
  const [expanded, setExpanded] = useState(isNext)

  return (
    <div className={cn(
      'bg-[var(--card)] border rounded-xl overflow-hidden transition-colors',
      isNext ? 'border-blue-500/30' : 'border-[var(--border)]'
    )}>
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 cursor-pointer',
          isNext && 'bg-blue-500/5'
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black',
            isNext ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
          )}>
            {day.dayNumber}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{day.label}</p>
              {isNext && (
                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">
                  NEXT UP
                </span>
              )}
            </div>
            {day.lastSession ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                Last: {new Date(day.lastSession.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">Not done yet</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onStart() }}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" fill="currentColor" />}
              Start
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" /> : <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--border)]">
          {/* Next prescription */}
          <div className="px-4 py-3">
            <p className="text-xs text-[var(--muted-foreground)] font-medium mb-2 uppercase tracking-wider">
              Next Session Prescription
            </p>
            <div className="space-y-2">
              {day.nextPrescription.map((ex) => (
                <div key={ex.exerciseName} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded font-semibold',
                      ex.isTracked
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                    )}>
                      {ex.isTracked ? 'MAIN' : 'ACC'}
                    </span>
                    <span className="text-sm">{ex.exerciseName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {ex.tmAvailable ? (
                      <>
                        <span className="text-[var(--muted-foreground)]">{ex.sets}×{ex.repsTarget}</span>
                        <span className="font-bold text-blue-400">{ex.weightKg}kg</span>
                        {ex.isTracked && (
                          <span className="flex items-center gap-0.5 text-orange-400 font-medium">
                            <Target className="w-3 h-3" />
                            beat {ex.repsTarget}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-amber-400">no data yet</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Last session results */}
          {day.lastSession && (
            <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--muted)]/30">
              <p className="text-xs text-[var(--muted-foreground)] font-medium mb-2 uppercase tracking-wider">
                Last Session #{day.lastSession.sessionNumber}
              </p>
              <div className="space-y-1">
                {day.lastSession.exercises.map((ex) => (
                  <div key={ex.exerciseName} className="flex items-center gap-2 text-xs">
                    {ex.progressionTriggered === true && <TrendingUp className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                    {ex.progressionTriggered === false && ex.amrapActualReps !== null && <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    {ex.amrapActualReps === null && <ArrowRight className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />}
                    <span className="text-[var(--muted-foreground)]">{ex.exerciseName}</span>
                    <span className="font-medium">{ex.weightKg}kg × {ex.amrapActualReps ?? '—'}</span>
                    {ex.progressionTriggered === true && (
                      <span className="text-green-400 font-semibold">↑ progressed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Training Maxes ───────────────────────────────────────────────────

function TrainingMaxesCard({
  tms,
}: {
  tms: SbsOverview['trainingMaxes']
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<string | null>(null)

  function handleEdit(name: string, currentOneRm: number) {
    setEditing(name)
    setValue(currentOneRm.toString())
    setSaved(null)
  }

  function handleSave(name: string) {
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) return
    startTransition(async () => {
      await setTrainingMax(name, num)
      setEditing(null)
      setSaved(name)
      setTimeout(() => setSaved(null), 2000)
    })
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <p className="font-semibold text-sm flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-blue-400" />
          Training Maxes
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Auto-detected from your Hevy history. Tap to override.</p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {tms.map((tm) => (
          <div key={tm.exerciseName} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{tm.exerciseName}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                1RM ~{tm.oneRmKg}kg
                {tm.consecutiveMisses > 0 && (
                  <span className="text-amber-400 ml-2">{tm.consecutiveMisses} miss{tm.consecutiveMisses > 1 ? 'es' : ''}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editing === tm.exerciseName ? (
                <>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave(tm.exerciseName)}
                    className="w-20 bg-[var(--muted)] rounded-lg px-2 py-1 text-sm text-center font-medium outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield]"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSave(tm.exerciseName)}
                    disabled={isPending}
                    className="text-xs text-green-400 hover:text-green-300 font-medium"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-xs text-[var(--muted-foreground)]">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {saved === tm.exerciseName && <Check className="w-3.5 h-3.5 text-green-400" />}
                  <span className="font-bold text-blue-400">{tm.trainingMaxKg}kg TM</span>
                  <button
                    onClick={() => handleEdit(tm.exerciseName, tm.oneRmKg)}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline transition-colors"
                  >
                    edit
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
