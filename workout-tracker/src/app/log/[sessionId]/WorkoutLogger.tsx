'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBlock, logSet, saveMetConResult, completeSession } from '@/actions/workout'
import { recordSbsSessionResults } from '@/actions/sbs'
import { estimateOneRM } from '@/lib/one-rm'
import { cn, formatTime } from '@/lib/utils'
import {
  Plus, Check, Timer, Dumbbell, Zap, X, Search, Loader2,
  Target, TrendingUp, TrendingDown
} from 'lucide-react'

type Exercise = { id: string; name: string; category: string; type: string; movementPattern: string; primaryMuscles: string }
type SetLog = { id: string; setNumber: number; weightKg: number | null; reps: number | null; rpe: number | null; durationSeconds: number | null; isRx: boolean; isAmrap: boolean; amrapTarget: number | null; exercise: { id: string; name: string } }
type Block = { id: string; order: number; blockType: string; notes: string | null; sets: SetLog[]; metconResult: { wodName: string | null; wodType: string; completionSeconds: number | null; roundsCompleted: number | null; repsCompleted: number | null; isRx: boolean } | null }
type Session = { id: string; template: string | null; completedAt: Date | null; blocks: Block[] }

interface SbsTarget {
  amrapTargetReps: number
  weightKg: number
  repsTarget: number
  plannedExerciseId: string
  incrementKg: number
  /** TM ÷ 0.90 — the actual reference 1RM, independent of working-set weight */
  refOneRM: number
}

interface Props {
  session: Session
  exercises: Exercise[]
  /** exerciseId → last logged { weightKg, reps } for pre-fill */
  lastPerformances: Record<string, { weightKg: number; reps: number }>
  /** exerciseId → SBS targets (only present for SBS sessions) */
  sbsTargets?: Record<string, SbsTarget>
  sbsPlannedSessionId?: string
}

export function WorkoutLogger({ session: initialSession, exercises, lastPerformances, sbsTargets, sbsPlannedSessionId }: Props) {
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  const [isPending, startTransition] = useTransition()
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [pendingBlockType, setPendingBlockType] = useState<string | null>(null)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [restTimer, setRestTimer] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [newPRExercise, setNewPRExercise] = useState<string | null>(null)
  const [sbsProgressionResults, setSbsProgressionResults] = useState<Array<{
    exerciseName: string; message: string; progressed: boolean; deload: boolean
  }> | null>(null)
  const startTime = useRef(Date.now())
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Rest timer
  useEffect(() => {
    if (restTimer === null) return
    if (restTimer <= 0) {
      setRestTimer(null)
      return
    }
    const t = setTimeout(() => setRestTimer((r) => (r ?? 0) - 1), 1000)
    return () => clearTimeout(t)
  }, [restTimer])

  function openExercisePicker(blockType: string) {
    setPendingBlockType(blockType)
    setShowExercisePicker(true)
    setExerciseSearch('')
  }

  async function addBlock(exerciseId: string, exerciseName: string) {
    setShowExercisePicker(false)
    const blockType = pendingBlockType ?? 'ACCESSORY'
    const order = session.blocks.length + 1

    // Pre-fill with last logged weight/reps for this exercise
    const last = lastPerformances[exerciseId]

    startTransition(async () => {
      const block = await createBlock({ sessionId: session.id, order, blockType })
      const set = await logSet({
        blockId: block.id,
        exerciseId,
        setNumber: 1,
        weightKg: last?.weightKg,
        reps: last?.reps,
      })
      setSession((s) => ({
        ...s,
        blocks: [
          ...s.blocks,
          {
            id: block.id,
            order,
            blockType,
            notes: null,
            metconResult: null,
            sets: [{
              id: set.set.id,
              setNumber: 1,
              weightKg: last?.weightKg ?? null,
              reps: last?.reps ?? null,
              rpe: null,
              durationSeconds: null,
              isRx: true,
              isAmrap: false,
              amrapTarget: null,
              exercise: { id: exerciseId, name: exerciseName },
            }],
          },
        ],
      }))
    })
  }

  async function addSet(blockId: string, exerciseId: string, exerciseName: string) {
    if (!exerciseId) return
    const block = session.blocks.find((b) => b.id === blockId)
    if (!block) return
    const lastSet = block.sets[block.sets.length - 1]
    const setNumber = block.sets.length + 1

    startTransition(async () => {
      const result = await logSet({
        blockId,
        exerciseId,
        setNumber,
        weightKg: lastSet?.weightKg ?? undefined,
        reps: lastSet?.reps ?? undefined,
      })
      if (result.newPR) {
        setNewPRExercise(exerciseName)
        setTimeout(() => setNewPRExercise(null), 3000)
      }
      setSession((s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id !== blockId ? b : {
            ...b,
            sets: [...b.sets, {
              id: result.set.id,
              setNumber,
              weightKg: lastSet?.weightKg ?? null,
              reps: lastSet?.reps ?? null,
              rpe: null,
              durationSeconds: null,
              isRx: true,
              isAmrap: false,
              amrapTarget: null,
              exercise: { id: exerciseId, name: exerciseName },
            }],
          }
        ),
      }))
      setRestTimer(180) // 3 min default rest
    })
  }

  async function finishSession() {
    const durationMinutes = Math.floor(elapsed / 60)
    startTransition(async () => {
      await completeSession(session.id, { durationMinutes })

      // If this is an SBS session, record AMRAP results and calculate progression
      if (sbsTargets && sbsPlannedSessionId) {
        const amrapResults: Array<{ sbsPlannedExerciseId: string; amrapActualReps: number }> = []

        for (const block of session.blocks) {
          const exerciseId = block.sets[0]?.exercise.id
          if (!exerciseId) continue
          const target = sbsTargets[exerciseId]
          if (!target) continue

          // Find the AMRAP set (last set with reps logged)
          const amrapSet = [...block.sets].reverse().find((s) => s.isAmrap && s.reps !== null)
          if (!amrapSet?.reps) continue

          amrapResults.push({
            sbsPlannedExerciseId: target.plannedExerciseId,
            amrapActualReps: amrapSet.reps,
          })
        }

        if (amrapResults.length > 0) {
          const results = await recordSbsSessionResults(session.id, amrapResults)
          setSbsProgressionResults(results)
          return // show results panel before redirecting
        }
      }

      router.push('/log/history')
    })
  }

  const filteredExercises = exercises.filter((e) =>
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  )

  const blockTypeLabels: Record<string, string> = {
    MAIN_LIFT: 'Main Lift',
    ACCESSORY: 'Accessory',
    SUPERSET: 'Superset',
    METCON: 'MetCon',
  }

  const blockTypeColors: Record<string, string> = {
    MAIN_LIFT: 'text-blue-400 bg-blue-500/10',
    ACCESSORY: 'text-green-400 bg-green-500/10',
    SUPERSET: 'text-purple-400 bg-purple-500/10',
    METCON: 'text-orange-400 bg-orange-500/10',
  }

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--background)] border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base">{session.template ?? 'Workout'}</h1>
            <p className="text-xs text-[var(--muted-foreground)]">{formatTime(elapsed)} elapsed</p>
          </div>
          <div className="flex items-center gap-2">
            {restTimer !== null && (
              <div className="flex items-center gap-1 bg-orange-500/15 text-orange-400 px-2.5 py-1 rounded-lg text-sm font-mono">
                <Timer className="w-3.5 h-3.5" />
                {formatTime(restTimer)}
              </div>
            )}
            <button
              onClick={finishSession}
              disabled={isPending}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Finish
            </button>
          </div>
        </div>
      </div>

      {/* PR Toast */}
      {newPRExercise && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-green-500/15 border border-green-500/30 text-green-400 px-4 py-2.5 rounded-lg">
          <Zap className="w-4 h-4" fill="currentColor" />
          <span className="text-sm font-semibold">New PR on {newPRExercise}!</span>
        </div>
      )}

      {/* SBS Progression Results Panel */}
      {sbsProgressionResults && (
        <div className="mx-4 mt-3 bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="font-semibold text-sm">Session Complete — Progression Update</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Training maxes updated for next session</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {sbsProgressionResults.map((r) => (
              <div key={r.exerciseName} className="flex items-center gap-3 px-4 py-3">
                {r.progressed ? (
                  <TrendingUp className="w-4 h-4 text-green-400 shrink-0" />
                ) : r.deload ? (
                  <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
                ) : (
                  <Target className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.exerciseName}</p>
                  <p className={cn(
                    'text-xs',
                    r.progressed ? 'text-green-400' : r.deload ? 'text-red-400' : 'text-[var(--muted-foreground)]'
                  )}>{r.message}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-[var(--border)]">
            <button
              onClick={() => router.push('/log/history')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Back to History
            </button>
          </div>
        </div>
      )}

      {/* Blocks */}
      <div className="p-4 space-y-4">
        {session.blocks.map((block) => {
          const exerciseId = block.sets[0]?.exercise.id ?? ''
          const exerciseName = block.sets[0]?.exercise.name ?? ''
          const sbsTarget = sbsTargets?.[exerciseId]
          const intensityPercent = sbsTarget?.refOneRM
            ? Math.round((sbsTarget.weightKg / sbsTarget.refOneRM) * 1000) / 10
            : null
          const isWodMetcon = block.blockType === 'METCON' && !exerciseId

          return (
            <div key={block.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
              {/* Block header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', blockTypeColors[block.blockType])}>
                    {blockTypeLabels[block.blockType]}
                  </span>
                  <span className="font-medium text-sm">
                    {exerciseName || block.metconResult?.wodName || 'MetCon'}
                  </span>
                </div>
                {sbsTarget && (
                  <div className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                    <Target className="w-3 h-3" />
                    Target: {sbsTarget.weightKg}kg × {sbsTarget.repsTarget}+
                    {intensityPercent !== null && (
                      <span className="text-[10px] text-orange-300">(@ {intensityPercent}% 1RM)</span>
                    )}
                  </div>
                )}
              </div>

              {/* WOD-only MetCon block */}
              {isWodMetcon ? (
                <div className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
                  <p>WOD session ready. Use the <span className="text-[var(--foreground)] font-medium">Finish</span> button when done.</p>
                  {block.metconResult?.wodType && (
                    <p className="mt-1 text-xs">Type: {block.metconResult.wodType}</p>
                  )}
                </div>
              ) : (
              /* Sets table */
              <div className="px-4 py-2">
                {/* Header row */}
                <div className="grid grid-cols-[32px_1fr_1fr_80px_32px] gap-2 text-xs text-[var(--muted-foreground)] mb-1 px-1">
                  <span>Set</span>
                  <span>Weight (kg)</span>
                  <span>Reps</span>
                  <span title={sbsTarget ? 'Your reference 1RM based on Training Max (TM ÷ 0.9)' : 'Estimated 1RM from this set'}>
                    {sbsTarget ? 'Ref. 1RM' : 'Est. 1RM'}
                  </span>
                  <span />
                </div>

                {block.sets.map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    blockId={block.id}
                    exerciseId={exerciseId}
                    amrapTarget={set.isAmrap ? (set.amrapTarget ?? sbsTarget?.amrapTargetReps ?? null) : null}
                    sbsRefOneRM={sbsTarget?.refOneRM ?? null}
                    onUpdate={(updated) => {
                      setSession((s) => ({
                        ...s,
                        blocks: s.blocks.map((b) =>
                          b.id !== block.id ? b : {
                            ...b,
                            sets: b.sets.map((st) => st.id === set.id ? { ...st, ...updated } : st),
                          }
                        ),
                      }))
                    }}
                  />
                ))}
              </div>
              )}

              {/* Add set */}
              {!isWodMetcon && (
                <div className="px-4 pb-3">
                  <button
                    onClick={() => addSet(block.id, exerciseId, exerciseName)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium py-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Set
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Add blocks */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { type: 'MAIN_LIFT', label: 'Main Lift', icon: Dumbbell, color: 'blue' },
            { type: 'ACCESSORY', label: 'Accessory', icon: Plus, color: 'green' },
            { type: 'SUPERSET', label: 'Superset', icon: Zap, color: 'purple' },
            { type: 'METCON', label: 'MetCon', icon: Timer, color: 'orange' },
          ].map(({ type, label, icon: Icon, color }) => (
            <button
              key={type}
              onClick={() => openExercisePicker(type)}
              className={cn(
                'flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[var(--border)] text-sm font-medium transition-colors hover:border-opacity-80',
                `text-${color}-400 hover:bg-${color}-500/10`
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 px-0 lg:px-4">
          <div className="w-full lg:max-w-md bg-[var(--card)] rounded-t-2xl lg:rounded-2xl border border-[var(--border)] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-semibold">Select Exercise</h3>
              <button onClick={() => setShowExercisePicker(false)}>
                <X className="w-5 h-5 text-[var(--muted-foreground)]" />
              </button>
            </div>
            <div className="p-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 bg-[var(--muted)] rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
                <input
                  autoFocus
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  placeholder="Search exercises..."
                  className="bg-transparent text-sm flex-1 outline-none placeholder:text-[var(--muted-foreground)]"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredExercises.slice(0, 50).map((ex) => {
                const last = lastPerformances[ex.id]
                return (
                  <button
                    key={ex.id}
                    onClick={() => addBlock(ex.id, ex.name)}
                    className="w-full text-left px-4 py-3 hover:bg-[var(--muted)] transition-colors border-b border-[var(--border)] last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{ex.name}</p>
                      {last && (
                        <span className="text-xs text-blue-400 font-medium shrink-0">
                          {last.weightKg}kg × {last.reps}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {ex.category} · {ex.type}
                    </p>
                  </button>
                )
              })}
              {filteredExercises.length === 0 && (
                <p className="text-center py-8 text-[var(--muted-foreground)] text-sm">
                  No exercises found
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SetRow({
  set,
  blockId,
  exerciseId,
  amrapTarget,
  sbsRefOneRM,
  onUpdate,
}: {
  set: SetLog
  blockId: string
  exerciseId: string
  /** If set, this is the AMRAP set — show beat/miss indicator */
  amrapTarget: number | null
  /**
   * TM-derived reference 1RM (TM ÷ 0.90). When present, shown instead of the
   * per-set estimate, which is always artificially low at submaximal training loads.
   */
  sbsRefOneRM: number | null
  onUpdate: (data: Partial<SetLog>) => void
}) {
  const [weight, setWeight] = useState(set.weightKg?.toString() ?? '')
  const [reps, setReps] = useState(set.reps?.toString() ?? '')
  const [isPending, startTransition] = useTransition()

  const w = parseFloat(weight) || 0
  const r = parseInt(reps) || 0
  const est1RM = w > 0 && r > 0 ? estimateOneRM(w, r) : null

  const beat = amrapTarget !== null && r > 0 && r >= amrapTarget
  const missed = amrapTarget !== null && r > 0 && r < amrapTarget

  function handleBlur() {
    const wNum = parseFloat(weight) || undefined
    const rNum = parseInt(reps) || undefined
    if (wNum !== set.weightKg || rNum !== set.reps) {
      startTransition(async () => {
        await logSet({
          blockId,
          exerciseId,
          setNumber: set.setNumber,
          weightKg: wNum,
          reps: rNum,
          isAmrap: set.isAmrap,
          amrapTarget: set.amrapTarget ?? undefined,
        })
        onUpdate({ weightKg: wNum ?? null, reps: rNum ?? null })
      })
    }
  }

  return (
    <div className={cn(
      'grid grid-cols-[32px_1fr_1fr_80px_32px] gap-2 items-center py-1',
      amrapTarget !== null && 'bg-orange-500/5 -mx-1 px-1 rounded-lg'
    )}>
      {/* Set number / AMRAP badge */}
      <div className="flex justify-center">
        {amrapTarget !== null ? (
          <span className="text-[10px] font-bold text-orange-400 bg-orange-500/20 px-1 rounded leading-tight">
            AMRAP
          </span>
        ) : (
          <span className="text-xs text-[var(--muted-foreground)] text-center font-medium">
            {set.setNumber}
          </span>
        )}
      </div>

      {/* Weight */}
      <input
        type="number"
        inputMode="decimal"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={handleBlur}
        placeholder="0"
        className={cn(
          'bg-[var(--muted)] rounded-lg px-3 py-2 text-sm text-center font-medium outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          amrapTarget !== null && 'ring-1 ring-orange-500/30'
        )}
      />

      {/* Reps — shows beat/miss colour for AMRAP */}
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={handleBlur}
          placeholder={amrapTarget !== null ? `${amrapTarget}+` : '0'}
          className={cn(
            'w-full bg-[var(--muted)] rounded-lg px-3 py-2 text-sm text-center font-medium outline-none focus:ring-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            beat && 'ring-1 ring-green-500/50 text-green-400',
            missed && 'ring-1 ring-red-500/40 text-red-400',
            !beat && !missed && amrapTarget !== null && 'ring-1 ring-orange-500/30 focus:ring-orange-500'
          )}
        />
      </div>

      {/* 1RM column: beat/miss for AMRAP sets; ref 1RM for SBS; est for open gym */}
      <div className="text-center">
        {beat ? (
          <span className="text-xs text-green-400 font-bold">Beat!</span>
        ) : missed ? (
          <span className="text-xs text-red-400">{r}/{amrapTarget}</span>
        ) : sbsRefOneRM ? (
          // SBS session: always show TM-derived 1RM — per-set estimate is meaningless
          // at 65-80% TM training loads and just confuses athletes
          <span className="text-xs text-blue-400 font-medium">~{sbsRefOneRM}kg</span>
        ) : (
          <span className="text-xs text-[var(--muted-foreground)]">
            {est1RM ? `${est1RM}kg` : '—'}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="flex justify-center">
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--muted-foreground)]" />
        ) : (
          <Check className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
        )}
      </div>
    </div>
  )
}
