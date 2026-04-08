/**
 * "Beat the Logbook" algorithmic progression engine.
 *
 * Principles (inspired by Stronger By Science / Barbell Medicine):
 * - 3 rotating training days: Squat, Press, Deadlift
 * - Each session has a fixed weight × reps target per exercise
 * - Last set of each main lift is AMRAP (as many reps as possible)
 * - Beating the AMRAP target → Training Max increases
 * - Missing twice in a row → 10% deload
 *
 * Training Max (TM) ≈ 85-90% of 1RM. Weights are prescribed as % of TM.
 * Users never need to manage this directly — it auto-seeds from PR data.
 */

// ─── Types ───────────────────────────────────────────────────────────

export type DayNumber = 1 | 2 | 3

export interface LiftPrescription {
  /** Matches Exercise.name in the database */
  exerciseName: string
  /** Number of total sets (last one is the AMRAP set) */
  sets: number
  /** Target reps for working sets; also the minimum to beat on AMRAP */
  repsTarget: number
  /** Fraction of Training Max to prescribe (0 = bodyweight) */
  tmPercent: number
  /** kg added to TM when AMRAP target is beaten */
  incrementKg: number
  blockType: 'MAIN_LIFT' | 'ACCESSORY'
  /** Whether this exercise has its own AMRAP tracking */
  isTracked: boolean
}

export interface DayTemplate {
  number: DayNumber
  label: string        // "Day 1 — Squat"
  shortLabel: string   // "Squat Day"
  lifts: LiftPrescription[]
}

export interface GeneratedSet {
  setNumber: number
  weightKg: number
  repsTarget: number
  isAmrap: boolean
}

export interface GeneratedExercise {
  exerciseName: string
  blockType: 'MAIN_LIFT' | 'ACCESSORY'
  isTracked: boolean
  incrementKg: number
  amrapTargetReps: number
  sets: GeneratedSet[]
  weightKg: number
  repsTarget: number
  tmAvailable: boolean  // false if no TM found → show as "needs setup"
}

export interface GeneratedSession {
  dayNumber: DayNumber
  label: string
  exercises: GeneratedExercise[]
}

export interface ProgressionResult {
  progressed: boolean
  deload: boolean
  newTrainingMaxKg: number
  consecutiveMisses: number
  message: string
}

export type TrainingGoal = 'strength' | 'hypertrophy'

// ─── 3-Day Program Templates ──────────────────────────────────────────
//
// All tmPercent values are expressed as: desired_%_of_1RM ÷ 0.90
// because TM = 90% of 1RM, so working weight = tmPercent × TM = desired% of 1RM.
//
// STRENGTH targets:
//   Main lifts (5 reps):   80% 1RM  →  tmPercent = 0.80/0.90 = 0.889
//   Accessories (8 reps):  65% 1RM  →  tmPercent = 0.65/0.90 = 0.722
//
// HYPERTROPHY targets:
//   Main lifts (10 reps):  72% 1RM  →  tmPercent = 0.72/0.90 = 0.800
//   Deadlift (8 reps):     78% 1RM  →  tmPercent = 0.78/0.90 = 0.867
//   OHP secondary (12rep): 62% 1RM  →  tmPercent = 0.62/0.90 = 0.689
//   Accessories (12 reps): 60% 1RM  →  tmPercent = 0.60/0.90 = 0.667

function buildDays(goal: TrainingGoal): DayTemplate[] {
  const isHyp = goal === 'hypertrophy'
  return [
    {
      number: 1 as DayNumber,
      label: 'Day 1 — Squat',
      shortLabel: 'Squat Day',
      lifts: [
        {
          exerciseName: 'Back Squat',
          sets: isHyp ? 4 : 3,
          repsTarget: isHyp ? 10 : 5,
          tmPercent: isHyp ? 0.800 : 0.889, // hyp: 72% 1RM | str: 80% 1RM
          incrementKg: isHyp ? 2.5 : 5,
          blockType: 'MAIN_LIFT',
          isTracked: true,
        },
        {
          exerciseName: 'Romanian Deadlift',
          sets: 3,
          repsTarget: isHyp ? 12 : 8,
          tmPercent: isHyp ? 0.667 : 0.722, // hyp: 60% 1RM | str: 65% 1RM
          incrementKg: 2.5,
          blockType: 'ACCESSORY',
          isTracked: true,
        },
        {
          exerciseName: 'Barbell Row',
          sets: 3,
          repsTarget: isHyp ? 12 : 8,
          tmPercent: isHyp ? 0.667 : 0.722, // hyp: 60% 1RM | str: 65% 1RM
          incrementKg: 2.5,
          blockType: 'ACCESSORY',
          isTracked: false,
        },
      ],
    },
    {
      number: 2 as DayNumber,
      label: 'Day 2 — Press',
      shortLabel: 'Press Day',
      lifts: [
        {
          exerciseName: 'Bench Press',
          sets: isHyp ? 4 : 3,
          repsTarget: isHyp ? 10 : 5,
          tmPercent: isHyp ? 0.800 : 0.889, // hyp: 72% 1RM | str: 80% 1RM
          incrementKg: isHyp ? 1.25 : 2.5,
          blockType: 'MAIN_LIFT',
          isTracked: true,
        },
        {
          exerciseName: 'Overhead Press',
          sets: isHyp ? 4 : 3,
          repsTarget: isHyp ? 10 : 5,
          tmPercent: isHyp ? 0.800 : 0.889, // hyp: 72% 1RM | str: 80% 1RM
          incrementKg: isHyp ? 1.25 : 2.5,
          blockType: 'MAIN_LIFT',
          isTracked: true,
        },
        {
          exerciseName: 'Barbell Row',
          sets: 3,
          repsTarget: isHyp ? 12 : 8,
          tmPercent: isHyp ? 0.667 : 0.722, // hyp: 60% 1RM | str: 65% 1RM
          incrementKg: 2.5,
          blockType: 'ACCESSORY',
          isTracked: false,
        },
      ],
    },
    {
      number: 3 as DayNumber,
      label: 'Day 3 — Deadlift',
      shortLabel: 'Deadlift Day',
      lifts: [
        {
          exerciseName: 'Deadlift',
          sets: 3,
          repsTarget: isHyp ? 8 : 5,
          tmPercent: isHyp ? 0.867 : 0.889, // hyp: 78% 1RM | str: 80% 1RM
          incrementKg: isHyp ? 2.5 : 5,
          blockType: 'MAIN_LIFT',
          isTracked: true,
        },
        {
          exerciseName: 'Overhead Press',
          sets: 3,
          repsTarget: isHyp ? 12 : 8,
          tmPercent: isHyp ? 0.689 : 0.722, // hyp: 62% 1RM | str: 65% 1RM
          incrementKg: isHyp ? 1.25 : 2.5,
          blockType: 'MAIN_LIFT',
          isTracked: true,
        },
        {
          exerciseName: 'Barbell Row',
          sets: 3,
          repsTarget: isHyp ? 12 : 8,
          tmPercent: isHyp ? 0.667 : 0.722, // hyp: 60% 1RM | str: 65% 1RM
          incrementKg: 2.5,
          blockType: 'ACCESSORY',
          isTracked: false,
        },
      ],
    },
  ]
}

export const PROGRAM_DAYS: DayTemplate[] = buildDays('strength')
export const PROGRAM_DAYS_HYPERTROPHY: DayTemplate[] = buildDays('hypertrophy')

// ─── All exercise names used across all days ──────────────────────────
export const ALL_TRACKED_LIFTS = [
  'Back Squat',
  'Romanian Deadlift',
  'Bench Press',
  'Overhead Press',
  'Deadlift',
  'Barbell Row',
]

/**
 * Aliases for Hevy-imported exercise names → our canonical SBS lift names.
 * Hevy uses "(Barbell)" suffixes; German workout names are also mapped.
 * When auto-seeding TMs from PR data, we check these names too.
 */
export const LIFT_ALIASES: Record<string, string[]> = {
  'Back Squat': [
    'Squat (Barbell)',
    'Back Squat (Barbell)',
    'Barbell Squat',
    'Barbell Back Squat',
    'Kniebeugen',
  ],
  'Deadlift': [
    'Deadlift (Barbell)',
    'Barbell Deadlift',
    'Conventional Deadlift',
    'Conventional Deadlift (Barbell)',
    'Kreuzheben',
  ],
  'Bench Press': [
    'Bench Press (Barbell)',
    'Barbell Bench Press',
    'Flat Bench Press',
    'Flat Bench Press (Barbell)',
    'Bankdrücken',
  ],
  'Overhead Press': [
    'Overhead Press (Barbell)',
    'Standing Military Press (Barbell)',
    'Military Press (Barbell)',
    'Strict Press (Barbell)',
    'OHP',
    'Barbell Overhead Press',
    'Schulterdrücken',
    'Seated Overhead Press (Barbell)',
  ],
  'Barbell Row': [
    'Bent Over Row (Barbell)',
    'Barbell Bent Over Row',
    'Pendlay Row',
    'T Bar Row',
    'T-Bar Row',
    'Rudern',
  ],
  'Romanian Deadlift': [
    'Romanian Deadlift (Barbell)',
    'RDL (Barbell)',
    'Barbell Romanian Deadlift',
    'RDL',
  ],
}

// ─── Utility ──────────────────────────────────────────────────────────

/** Round weight to nearest 2.5 kg plate increment */
export function roundToPlate(kg: number): number {
  return Math.round(kg / 2.5) * 2.5
}

/** Calculate initial Training Max from a 1RM (default 90%) */
export function calcInitialTM(oneRmKg: number, percent = 0.90): number {
  return roundToPlate(oneRmKg * percent)
}

/** Prescribed weight = TM × intensity %, rounded to 2.5kg */
export function calcPrescribedWeight(trainingMaxKg: number, tmPercent: number): number {
  if (tmPercent === 0) return 0
  return roundToPlate(trainingMaxKg * tmPercent)
}

/** Get a day template by number and goal */
export function getDayTemplate(dayNumber: DayNumber, goal: TrainingGoal = 'strength'): DayTemplate {
  const days = goal === 'hypertrophy' ? PROGRAM_DAYS_HYPERTROPHY : PROGRAM_DAYS
  return days[dayNumber - 1]
}

// ─── Session generation ───────────────────────────────────────────────

/**
 * Generate a planned session from the template and current training maxes.
 * If a TM is missing for a lift, weight will be 0 (flagged as tmAvailable: false).
 */
export function generateSession(
  dayNumber: DayNumber,
  trainingMaxes: Record<string, number>,
  goal: TrainingGoal = 'strength',
): GeneratedSession {
  const template = getDayTemplate(dayNumber, goal)

  const exercises: GeneratedExercise[] = template.lifts.map((lift) => {
    const tm = trainingMaxes[lift.exerciseName]
    const tmAvailable = tm != null && tm > 0
    const weight = tmAvailable ? calcPrescribedWeight(tm, lift.tmPercent) : 0

    const sets: GeneratedSet[] = Array.from({ length: lift.sets }, (_, i) => ({
      setNumber: i + 1,
      weightKg: weight,
      repsTarget: lift.repsTarget,
      isAmrap: lift.isTracked && i === lift.sets - 1, // last set is AMRAP only for tracked lifts
    }))

    return {
      exerciseName: lift.exerciseName,
      blockType: lift.blockType,
      isTracked: lift.isTracked,
      incrementKg: lift.incrementKg,
      amrapTargetReps: lift.repsTarget,
      sets,
      weightKg: weight,
      repsTarget: lift.repsTarget,
      tmAvailable,
    }
  })

  return { dayNumber, label: template.label, exercises }
}

// ─── Progression logic ────────────────────────────────────────────────

/**
 * Calculate the new Training Max after an AMRAP result.
 *
 * Rules:
 * - Beat (actual ≥ target): TM += incrementKg, reset miss counter
 * - Miss (actual < target): TM unchanged, miss counter +1
 * - 2+ consecutive misses: TM × 0.90 (deload), reset counter
 */
export function calculateProgression(params: {
  currentTM: number
  incrementKg: number
  amrapTarget: number
  amrapActual: number
  consecutiveMisses: number
}): ProgressionResult {
  const { currentTM, incrementKg, amrapTarget, amrapActual, consecutiveMisses } = params
  const beat = amrapActual >= amrapTarget

  if (beat) {
    const newTM = roundToPlate(currentTM + incrementKg)
    return {
      progressed: true,
      deload: false,
      newTrainingMaxKg: newTM,
      consecutiveMisses: 0,
      message: `Beat ${amrapTarget} reps (${amrapActual}) → +${incrementKg}kg · new TM ${newTM}kg`,
    }
  }

  const newMisses = consecutiveMisses + 1

  if (newMisses >= 2) {
    const newTM = roundToPlate(currentTM * 0.90)
    return {
      progressed: false,
      deload: true,
      newTrainingMaxKg: newTM,
      consecutiveMisses: 0,
      message: `2 misses → 10% deload · new TM ${newTM}kg`,
    }
  }

  return {
    progressed: false,
    deload: false,
    newTrainingMaxKg: currentTM,
    consecutiveMisses: newMisses,
    message: `${amrapActual}/${amrapTarget} reps — hold weight next session`,
  }
}

// ─── Day rotation ─────────────────────────────────────────────────────

/** Given the last completed day number, return the next one (1→2→3→1) */
export function nextDayNumber(lastDayNumber: number | null): DayNumber {
  if (!lastDayNumber) return 1
  return ((lastDayNumber % 3) + 1) as DayNumber
}
