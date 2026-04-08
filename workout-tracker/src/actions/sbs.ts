'use server'

import { prisma } from '@/lib/prisma'
import {
  calcPrescribedWeight,
  roundToPlate,
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

const PROGRESSION_DELTAS: Record<ProgressOutcome, number> = {
  below_by_2_or_more: -5,
  below_by_1: -2,
  hit_target: 0,
  beat_by_1: 0.5,
  beat_by_2: 1,
  beat_by_3: 1.5,
  beat_by_4: 2,
  beat_by_5_or_more: 3,
}

type ProgressOutcome =
  | 'below_by_2_or_more'
  | 'below_by_1'
  | 'hit_target'
  | 'beat_by_1'
  | 'beat_by_2'
  | 'beat_by_3'
  | 'beat_by_4'
  | 'beat_by_5_or_more'

export interface SbsProgramSettings {
  primarySets: number
  accessorySets: number
  deloadEvery7thWeek: boolean
  accessorySwaps: Record<string, string>
}

const DEFAULT_SBS_SETTINGS: SbsProgramSettings = {
  primarySets: 4,
  accessorySets: 3,
  deloadEvery7thWeek: false,
  accessorySwaps: {},
}
const SBS_ACCESSORY_SWAP_KEYS = ['day1_slot1', 'day1_slot2', 'day2_slot1', 'day3_slot1', 'day3_slot2'] as const

const SBS_DAY_LAYOUT: Record<DayNumber, Array<{ defaultExercise: string; blockType: 'MAIN_LIFT' | 'ACCESSORY'; tracked?: boolean }>> = {
  1: [
    { defaultExercise: 'Back Squat', blockType: 'MAIN_LIFT', tracked: true },
    { defaultExercise: 'Romanian Deadlift', blockType: 'ACCESSORY', tracked: true },
    { defaultExercise: 'Barbell Row', blockType: 'ACCESSORY', tracked: true },
  ],
  2: [
    { defaultExercise: 'Bench Press', blockType: 'MAIN_LIFT', tracked: true },
    { defaultExercise: 'Overhead Press', blockType: 'MAIN_LIFT', tracked: true },
    { defaultExercise: 'Barbell Row', blockType: 'ACCESSORY', tracked: true },
  ],
  3: [
    { defaultExercise: 'Deadlift', blockType: 'MAIN_LIFT', tracked: true },
    { defaultExercise: 'Overhead Press', blockType: 'ACCESSORY', tracked: true },
    { defaultExercise: 'Barbell Row', blockType: 'ACCESSORY', tracked: true },
  ],
}

export async function getSbsProgramSettings(): Promise<SbsProgramSettings> {
  const raw = await getSetting('sbs_program_settings')
  if (!raw) return DEFAULT_SBS_SETTINGS

  try {
    const parsed = JSON.parse(raw)
    return {
      primarySets: Number.isFinite(parsed.primarySets) ? Math.max(1, Math.round(parsed.primarySets)) : DEFAULT_SBS_SETTINGS.primarySets,
      accessorySets: Number.isFinite(parsed.accessorySets) ? Math.max(1, Math.round(parsed.accessorySets)) : DEFAULT_SBS_SETTINGS.accessorySets,
      deloadEvery7thWeek: Boolean(parsed.deloadEvery7thWeek),
      accessorySwaps: parsed.accessorySwaps && typeof parsed.accessorySwaps === 'object' ? parsed.accessorySwaps : {},
    }
  } catch {
    return DEFAULT_SBS_SETTINGS
  }
}

export async function setSbsProgramSettings(patch: Partial<SbsProgramSettings>): Promise<void> {
  const current = await getSbsProgramSettings()
  const incomingSwaps = patch.accessorySwaps ?? {}
  const sanitizedSwaps: Record<string, string> = { ...current.accessorySwaps }
  for (const key of SBS_ACCESSORY_SWAP_KEYS) {
    if (!(key in incomingSwaps)) continue
    const nextValue = incomingSwaps[key]?.trim()
    if (nextValue) sanitizedSwaps[key] = nextValue
    else delete sanitizedSwaps[key]
  }

  const next: SbsProgramSettings = {
    ...current,
    ...patch,
    primarySets: Math.max(1, Math.round(patch.primarySets ?? current.primarySets)),
    accessorySets: Math.max(1, Math.round(patch.accessorySets ?? current.accessorySets)),
    deloadEvery7thWeek: patch.deloadEvery7thWeek ?? current.deloadEvery7thWeek,
    accessorySwaps: sanitizedSwaps,
  }
  await setSetting('sbs_program_settings', JSON.stringify(next))
  revalidatePath('/program/sbs')
}

export async function getAccessoryExerciseOptions(): Promise<Array<{ id: string; name: string }>> {
  return prisma.exercise.findMany({
    where: { category: { not: 'METCON' } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
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

function getWeekNumberFromSessionNumber(sessionNumber: number): number {
  return Math.max(1, Math.ceil(sessionNumber / 3))
}

function getProgressOutcome(amrapTarget: number, amrapActual: number): ProgressOutcome {
  const diff = amrapActual - amrapTarget
  if (diff <= -2) return 'below_by_2_or_more'
  if (diff === -1) return 'below_by_1'
  if (diff === 0) return 'hit_target'
  if (diff === 1) return 'beat_by_1'
  if (diff === 2) return 'beat_by_2'
  if (diff === 3) return 'beat_by_3'
  if (diff === 4) return 'beat_by_4'
  return 'beat_by_5_or_more'
}

function getWeekProfile(weekNumber: number, includeDeload: boolean) {
  const week = Math.max(1, weekNumber)
  if (includeDeload) {
    const block = Math.floor((week - 1) / 7)
    const slot = (week - 1) % 7
    const mainBase = 70 + block * 2.5
    const accBase = 65 + block * 2.5
    const main = [
      { intensity: mainBase, reps: 10, repOut: 12 },
      { intensity: mainBase + 2.5, reps: 9, repOut: 11 },
      { intensity: mainBase + 5, reps: 8, repOut: 10 },
      { intensity: mainBase + 2.5, reps: 9, repOut: 11 },
      { intensity: mainBase + 5, reps: 8, repOut: 10 },
      { intensity: mainBase + 7.5, reps: 7, repOut: 9 },
      { intensity: 60, reps: 14, repOut: 18 },
    ][slot]
    const accessory = [
      { intensity: accBase, reps: 12, repOut: 15 },
      { intensity: accBase + 2.5, reps: 11, repOut: 13 },
      { intensity: accBase + 5, reps: 10, repOut: 12 },
      { intensity: accBase + 2.5, reps: 11, repOut: 13 },
      { intensity: accBase + 5, reps: 10, repOut: 12 },
      { intensity: accBase + 7.5, reps: 9, repOut: 11 },
      { intensity: 55, reps: 17, repOut: 21 },
    ][slot]
    return {
      main: slot === 6 ? main : { ...main, reps: main.reps - block, repOut: main.repOut - block },
      accessory: slot === 6 ? accessory : { ...accessory, reps: accessory.reps - block, repOut: accessory.repOut - block },
    }
  }

  const block = Math.floor((week - 1) / 6)
  const slot = (week - 1) % 6
  const main = [
    { intensity: 70, reps: 10, repOut: 12 },
    { intensity: 72.5, reps: 9, repOut: 11 },
    { intensity: 75, reps: 8, repOut: 10 },
    { intensity: 72.5, reps: 9, repOut: 11 },
    { intensity: 75, reps: 8, repOut: 10 },
    { intensity: 77.5, reps: 7, repOut: 9 },
  ][slot]
  const accessory = [
    { intensity: 65, reps: 12, repOut: 15 },
    { intensity: 67.5, reps: 11, repOut: 13 },
    { intensity: 70, reps: 10, repOut: 12 },
    { intensity: 67.5, reps: 11, repOut: 13 },
    { intensity: 70, reps: 10, repOut: 12 },
    { intensity: 72.5, reps: 9, repOut: 11 },
  ][slot]
  return {
    main: { intensity: main.intensity + block * 2.5, reps: main.reps - block, repOut: main.repOut - block },
    accessory: { intensity: accessory.intensity + block * 2.5, reps: accessory.reps - block, repOut: accessory.repOut - block },
  }
}

function generateDynamicSession(
  day: DayNumber,
  tmMap: Record<string, number>,
  weekNumber: number,
  settings: SbsProgramSettings,
) {
  const profile = getWeekProfile(weekNumber, settings.deloadEvery7thWeek)
  const exercises = SBS_DAY_LAYOUT[day].map((slot, index) => {
    const key = `day${day}_slot${index + 1}`
    const exerciseName = slot.blockType === 'ACCESSORY'
      ? settings.accessorySwaps[key] ?? slot.defaultExercise
      : slot.defaultExercise
    const isMain = slot.blockType === 'MAIN_LIFT'
    const sets = isMain ? settings.primarySets : settings.accessorySets
    const target = isMain ? profile.main : profile.accessory
    const tm = tmMap[exerciseName]
    const tmAvailable = tm != null && tm > 0
    const weightKg = tmAvailable ? calcPrescribedWeight(tm, target.intensity / 100) : 0
    return {
      exerciseName,
      blockType: slot.blockType,
      isTracked: slot.tracked ?? true,
      incrementKg: 2.5,
      amrapTargetReps: target.repOut,
      repsTarget: target.reps,
      tmAvailable,
      weightKg,
      sets: Array.from({ length: sets }, (_, setIdx) => ({
        setNumber: setIdx + 1,
        weightKg,
        repsTarget: target.reps,
        isAmrap: (slot.tracked ?? true) && setIdx === sets - 1,
      })),
    }
  })
  return { dayNumber: day, label: `Day ${day}`, exercises }
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

  const tms = await getTrainingMaxes()
  if (tms.length === 0) {
    return { error: 'No training history found. Log some workouts in Hevy first, then sync.' }
  }

  const day = dayNumber ?? (await getNextDay())
  const sessionNumber = await getNextSessionNumber()
  const weekNumber = getWeekNumberFromSessionNumber(sessionNumber)
  const settings = await getSbsProgramSettings()

  const tmMap: Record<string, number> = {}
  for (const tm of tms) {
    tmMap[tm.exerciseName] = tm.trainingMaxKg
  }

  const generated = generateDynamicSession(day, tmMap, weekNumber, settings)

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
          amrapTarget: s.isAmrap ? ex.amrapTargetReps : null,
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

    const outcome = getProgressOutcome(planned.amrapTargetReps, result.amrapActualReps)
    const delta = PROGRESSION_DELTAS[outcome]
    const newTM = roundToPlate(tm.trainingMaxKg * (1 + delta / 100))
    const progression = {
      progressed: delta > 0,
      deload: delta < 0,
      newTrainingMaxKg: newTM,
      consecutiveMisses: delta >= 0 ? 0 : tm.consecutiveMisses + 1,
      message: `${result.amrapActualReps}/${planned.amrapTargetReps} reps → ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`,
    }

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
  nextWeekNumber: number
  trainingGoal: TrainingGoal
  settings: SbsProgramSettings
  accessoryOptions: Array<{ id: string; name: string }>
  days: SbsDayStatus[]
}

export async function getSbsOverview(): Promise<SbsOverview> {
  // Auto-seed missing TMs on every overview load
  const { missing } = await autoSeedTrainingMaxes()

  const [tms, goal, nextDay, nextSessionNumber, settings, accessoryOptions] = await Promise.all([
    getTrainingMaxes(),
    getTrainingGoal(),
    getNextDay(),
    getNextSessionNumber(),
    getSbsProgramSettings(),
    getAccessoryExerciseOptions(),
  ])
  const nextWeekNumber = getWeekNumberFromSessionNumber(nextSessionNumber)

  const tmMap: Record<string, number> = {}
  for (const tm of tms) tmMap[tm.exerciseName] = tm.trainingMaxKg

  // Build status for each day
  const days: SbsDayStatus[] = []
  for (const dayNum of [1, 2, 3] as DayNumber[]) {
    const offset = dayNum >= nextDay ? dayNum - nextDay : 3 - (nextDay - dayNum)
    const weekForDay = getWeekNumberFromSessionNumber(nextSessionNumber + offset)
    const generated = generateDynamicSession(dayNum, tmMap, weekForDay, settings)

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
    nextWeekNumber,
    trainingGoal: goal,
    settings,
    accessoryOptions,
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
