'use server'

import { prisma } from '@/lib/prisma'
import {
  generateSession,
  calculateProgression,
  calcInitialTM,
  nextDayNumber,
  ALL_TRACKED_LIFTS,
  LIFT_ALIASES,
  type DayNumber,
  type TrainingGoal,
} from '@/lib/sbs-engine'
import { getSetting, setSetting } from './hevy'
import { estimateOneRM } from '@/lib/one-rm'
import { revalidatePath } from 'next/cache'

// ─── Auto-seed training maxes from existing PR / SetLog data ─────────

/**
 * Populate TrainingMax for any main lift that doesn't have one yet.
 * Priority: PersonalRecord (ONE_RM) → best estimated 1RM from recent sets.
 * Call this lazily whenever we need TMs and some are missing.
 */
export async function autoSeedTrainingMaxes(): Promise<{
  seeded: string[]
  missing: string[]
}> {
  const seeded: string[] = []
  const missing: string[] = []

  for (const liftName of ALL_TRACKED_LIFTS) {
    const exercise = await prisma.exercise.findFirst({ where: { name: liftName } })
    if (!exercise) { missing.push(liftName); continue }

    // Skip if already has a TM
    const existing = await prisma.trainingMax.findUnique({
      where: { exerciseId: exercise.id },
    })
    if (existing) continue

    // Build list of all exercise names to search (canonical + aliases)
    const aliases = LIFT_ALIASES[liftName] ?? []
    const allNames = [liftName, ...aliases]

    // Find all exercises matching any of the names
    const matchingExercises = await prisma.exercise.findMany({
      where: { name: { in: allNames } },
      select: { id: true, name: true },
    })
    const matchingIds = matchingExercises.map((e) => e.id)

    // Find the best ONE_RM PR across all matching exercises
    const bestPR = await prisma.personalRecord.findFirst({
      where: {
        exerciseId: { in: matchingIds },
        prType: 'ONE_RM',
        value: { gt: 0 },
      },
      orderBy: { value: 'desc' },
    })

    if (bestPR && bestPR.value > 0) {
      await prisma.trainingMax.create({
        data: {
          exerciseId: exercise.id,
          oneRmKg: Math.round(bestPR.value * 10) / 10,
          trainingMaxKg: calcInitialTM(bestPR.value),
          consecutiveMisses: 0,
        },
      })
      seeded.push(liftName)
      continue
    }

    // Fall back to best estimated 1RM from any set across matching exercises
    const bestSet = await prisma.setLog.findFirst({
      where: {
        exerciseId: { in: matchingIds },
        weightKg: { not: null, gt: 0 },
        reps: { not: null, gte: 1, lte: 12 },
      },
      orderBy: [{ weightKg: 'desc' }, { reps: 'asc' }],
    })

    if (bestSet?.weightKg && bestSet?.reps) {
      const est1RM = estimateOneRM(bestSet.weightKg, bestSet.reps)
      if (est1RM > 0) {
        await prisma.trainingMax.create({
          data: {
            exerciseId: exercise.id,
            oneRmKg: Math.round(est1RM * 10) / 10,
            trainingMaxKg: calcInitialTM(est1RM),
            consecutiveMisses: 0,
          },
        })
        seeded.push(liftName)
        continue
      }
    }

    missing.push(liftName)
  }

  return { seeded, missing }
}

// ─── Training goal ────────────────────────────────────────────────────

export async function getTrainingGoal(): Promise<TrainingGoal> {
  const val = await getSetting('sbs_training_goal')
  return val === 'hypertrophy' ? 'hypertrophy' : 'strength'
}

export async function setTrainingGoal(goal: TrainingGoal): Promise<void> {
  await setSetting('sbs_training_goal', goal)
  revalidatePath('/program/sbs')
}

/** Manual override for a single lift (used when auto-seed found nothing) */
export async function setTrainingMax(exerciseName: string, oneRmKg: number): Promise<void> {
  const exercise = await prisma.exercise.findFirst({ where: { name: exerciseName } })
  if (!exercise) throw new Error(`Exercise "${exerciseName}" not found`)

  await prisma.trainingMax.upsert({
    where: { exerciseId: exercise.id },
    create: {
      exerciseId: exercise.id,
      oneRmKg,
      trainingMaxKg: calcInitialTM(oneRmKg),
      consecutiveMisses: 0,
    },
    update: {
      oneRmKg,
      trainingMaxKg: calcInitialTM(oneRmKg),
      consecutiveMisses: 0,
    },
  })
  revalidatePath('/program/sbs')
}

// ─── Training max queries ─────────────────────────────────────────────

export async function getTrainingMaxes(): Promise<
  Array<{
    exerciseName: string
    oneRmKg: number
    trainingMaxKg: number
    exerciseId: string
    consecutiveMisses: number
  }>
> {
  const rows = await prisma.trainingMax.findMany({
    where: { exercise: { name: { in: ALL_TRACKED_LIFTS } } },
    include: { exercise: { select: { name: true } } },
    orderBy: { exercise: { name: 'asc' } },
  })
  return rows.map((r) => ({
    exerciseName: r.exercise.name,
    oneRmKg: r.oneRmKg,
    trainingMaxKg: r.trainingMaxKg,
    exerciseId: r.exerciseId,
    consecutiveMisses: r.consecutiveMisses,
  }))
}

// ─── Day sequencing ───────────────────────────────────────────────────

async function getNextDay(): Promise<DayNumber> {
  const last = await prisma.sbsPlannedSession.findFirst({
    where: { completedAt: { not: null } },
    orderBy: { sessionNumber: 'desc' },
    select: { dayLabel: true },
  })
  const lastNum = last ? parseInt(last.dayLabel.replace('Day ', '')) : null
  return nextDayNumber(lastNum)
}

async function getNextSessionNumber(): Promise<number> {
  const last = await prisma.sbsPlannedSession.findFirst({
    orderBy: { sessionNumber: 'desc' },
    select: { sessionNumber: true },
  })
  return (last?.sessionNumber ?? 0) + 1
}

// ─── Session start ────────────────────────────────────────────────────

/**
 * Create a WorkoutSession + SbsPlannedSession pre-populated with targets.
 * Auto-seeds training maxes from PRs if not already done.
 * @param dayNumber  Force a specific day (1/2/3), or omit to auto-pick next
 */
export async function startSbsSession(
  dayNumber?: DayNumber,
): Promise<{ sessionId: string; dayLabel: string } | { error: string }> {
  // Auto-seed any missing TMs from PR/SetLog data
  await autoSeedTrainingMaxes()

  const [tms, goal] = await Promise.all([getTrainingMaxes(), getTrainingGoal()])
  if (tms.length === 0) {
    return { error: 'No training history found. Log some workouts in Hevy first, then sync.' }
  }

  const day = dayNumber ?? (await getNextDay())
  const sessionNumber = await getNextSessionNumber()

  const tmMap: Record<string, number> = {}
  for (const tm of tms) {
    tmMap[tm.exerciseName] = tm.trainingMaxKg
  }

  const generated = generateSession(day, tmMap, goal)

  const now = new Date()
  const workoutSession = await prisma.workoutSession.create({
    data: {
      date: now,
      dayOfWeek: now.getDay(),
      phase: 'BASE',
      template: generated.label,
    },
  })

  const planned = await prisma.sbsPlannedSession.create({
    data: {
      dayLabel: `Day ${day}`,
      sessionNumber,
      workoutSessionId: workoutSession.id,
    },
  })

  let blockOrder = 0
  for (const ex of generated.exercises) {
    const exercise = await prisma.exercise.findFirst({ where: { name: ex.exerciseName } })
    if (!exercise) continue

    const block = await prisma.workoutBlock.create({
      data: {
        sessionId: workoutSession.id,
        order: blockOrder++,
        blockType: ex.blockType,
      },
    })

    await prisma.sbsPlannedExercise.create({
      data: {
        plannedSessionId: planned.id,
        exerciseId: exercise.id,
        order: block.order,
        blockType: ex.blockType,
        sets: ex.sets.length,
        repsTarget: ex.repsTarget,
        weightKg: ex.weightKg,
        amrapTargetReps: ex.amrapTargetReps,
        incrementKg: ex.incrementKg,
      },
    })

    for (const s of ex.sets) {
      await prisma.setLog.create({
        data: {
          blockId: block.id,
          exerciseId: exercise.id,
          setNumber: s.setNumber,
          weightKg: s.weightKg > 0 ? s.weightKg : null,
          reps: s.repsTarget,
          isAmrap: s.isAmrap,
          amrapTarget: s.isAmrap ? s.repsTarget : null,
          completedAt: now,
        },
      })
    }
  }

  revalidatePath('/program/sbs')
  revalidatePath('/log')

  return { sessionId: workoutSession.id, dayLabel: generated.label }
}

// ─── Post-session progression ─────────────────────────────────────────

export interface AmrapResultInput {
  sbsPlannedExerciseId: string
  amrapActualReps: number
}

export async function recordSbsSessionResults(
  workoutSessionId: string,
  results: AmrapResultInput[],
): Promise<Array<{ exerciseName: string; message: string; progressed: boolean; deload: boolean }>> {
  const output: Array<{ exerciseName: string; message: string; progressed: boolean; deload: boolean }> = []

  for (const result of results) {
    const planned = await prisma.sbsPlannedExercise.findUnique({
      where: { id: result.sbsPlannedExerciseId },
      include: { exercise: { select: { name: true } } },
    })
    if (!planned) continue

    await prisma.sbsPlannedExercise.update({
      where: { id: result.sbsPlannedExerciseId },
      data: { amrapActualReps: result.amrapActualReps },
    })

    const tm = await prisma.trainingMax.findUnique({
      where: { exerciseId: planned.exerciseId },
    })
    if (!tm) continue

    const progression = calculateProgression({
      currentTM: tm.trainingMaxKg,
      incrementKg: planned.incrementKg,
      amrapTarget: planned.amrapTargetReps,
      amrapActual: result.amrapActualReps,
      consecutiveMisses: tm.consecutiveMisses,
    })

    await prisma.trainingMax.update({
      where: { exerciseId: planned.exerciseId },
      data: {
        trainingMaxKg: progression.newTrainingMaxKg,
        consecutiveMisses: progression.consecutiveMisses,
      },
    })

    await prisma.sbsPlannedExercise.update({
      where: { id: result.sbsPlannedExerciseId },
      data: { progressionTriggered: progression.progressed },
    })

    output.push({
      exerciseName: planned.exercise.name,
      message: progression.message,
      progressed: progression.progressed,
      deload: progression.deload,
    })
  }

  await prisma.sbsPlannedSession.updateMany({
    where: { workoutSessionId },
    data: { completedAt: new Date() },
  })

  revalidatePath('/program/sbs')
  revalidatePath('/log')
  revalidatePath('/dashboard')

  return output
}

// ─── Overview queries ─────────────────────────────────────────────────

export interface SbsDayStatus {
  dayNumber: DayNumber
  label: string
  shortLabel: string
  /** The generated prescription for the next time this day runs */
  nextPrescription: Array<{
    exerciseName: string
    weightKg: number
    repsTarget: number
    sets: number
    isTracked: boolean
    tmAvailable: boolean
  }>
  /** Last completed session for this day type */
  lastSession: {
    sessionNumber: number
    completedAt: string
    exercises: Array<{
      exerciseName: string
      weightKg: number
      amrapActualReps: number | null
      progressionTriggered: boolean | null
    }>
  } | null
}

export interface SbsOverview {
  hasAnyTMs: boolean
  missingLifts: string[]
  trainingMaxes: Array<{
    exerciseName: string
    oneRmKg: number
    trainingMaxKg: number
    consecutiveMisses: number
  }>
  nextDayNumber: DayNumber
  trainingGoal: TrainingGoal
  days: SbsDayStatus[]
}

export async function getSbsOverview(): Promise<SbsOverview> {
  // Auto-seed missing TMs on every overview load
  const { missing } = await autoSeedTrainingMaxes()

  const [tms, goal, nextDay] = await Promise.all([
    getTrainingMaxes(),
    getTrainingGoal(),
    getNextDay(),
  ])

  const tmMap: Record<string, number> = {}
  for (const tm of tms) tmMap[tm.exerciseName] = tm.trainingMaxKg

  // Build status for each day
  const days: SbsDayStatus[] = []
  for (const dayNum of [1, 2, 3] as DayNumber[]) {
    const generated = generateSession(dayNum, tmMap, goal)

    // Last completed session for this day type
    const lastCompleted = await prisma.sbsPlannedSession.findFirst({
      where: {
        dayLabel: `Day ${dayNum}`,
        completedAt: { not: null },
      },
      orderBy: { sessionNumber: 'desc' },
      include: {
        exercises: {
          include: { exercise: { select: { name: true } } },
          orderBy: { order: 'asc' },
        },
      },
    })

    days.push({
      dayNumber: dayNum,
      label: generated.label,
      shortLabel: `Day ${dayNum}`,
      nextPrescription: generated.exercises.map((ex) => ({
        exerciseName: ex.exerciseName,
        weightKg: ex.weightKg,
        repsTarget: ex.repsTarget,
        sets: ex.sets.length,
        isTracked: ex.isTracked,
        tmAvailable: ex.tmAvailable,
      })),
      lastSession: lastCompleted
        ? {
            sessionNumber: lastCompleted.sessionNumber,
            completedAt: lastCompleted.completedAt!.toISOString(),
            exercises: lastCompleted.exercises.map((e) => ({
              exerciseName: e.exercise.name,
              weightKg: e.weightKg,
              amrapActualReps: e.amrapActualReps,
              progressionTriggered: e.progressionTriggered,
            })),
          }
        : null,
    })
  }

  return {
    hasAnyTMs: tms.length > 0,
    missingLifts: missing,
    trainingMaxes: tms,
    nextDayNumber: nextDay,
    trainingGoal: goal,
    days,
  }
}

/** Get the SBS session linked to a workout (for the logger) */
export async function getSbsSessionForWorkout(workoutSessionId: string) {
  return prisma.sbsPlannedSession.findUnique({
    where: { workoutSessionId },
    include: {
      exercises: {
        include: { exercise: { select: { id: true, name: true } } },
        orderBy: { order: 'asc' },
      },
    },
  })
}
