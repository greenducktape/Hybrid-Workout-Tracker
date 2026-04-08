/**
 * Muscle group fatigue scoring.
 * Uses a 7-day rolling window with exponential decay.
 * Fatigue score 0-100, where 100 = maximally fatigued.
 */

export interface FatigueScore {
  muscle: string
  label: string
  score: number     // 0-100
  readiness: number // 100 - score
  status: 'fresh' | 'moderate' | 'fatigued' | 'overtrained'
}

const MUSCLE_LABELS: Record<string, string> = {
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  chest: 'Chest',
  back: 'Back',
  lats: 'Lats',
  traps: 'Traps',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  biceps: 'Biceps',
  core: 'Core',
}

/** Half-life in days — each muscle group recovers at different rates */
const RECOVERY_HALF_LIFE: Record<string, number> = {
  quads: 2.5,
  hamstrings: 2.5,
  glutes: 2,
  calves: 1.5,
  chest: 2,
  back: 2.5,
  lats: 2,
  traps: 1.5,
  shoulders: 2,
  triceps: 1.5,
  biceps: 1.5,
  core: 1,
}

/** Sets per muscle needed to reach ~80% fatigue (individual tolerance) */
const FATIGUE_CEILING_SETS = 20

export interface SessionFatigue {
  date: Date
  muscleLoad: Record<string, number> // muscle -> hard sets contributed
}

export function calculateFatigue(sessions: SessionFatigue[]): FatigueScore[] {
  const now = Date.now()
  const accumulated: Record<string, number> = {}

  for (const session of sessions) {
    const daysAgo = (now - session.date.getTime()) / (1000 * 60 * 60 * 24)
    if (daysAgo > 7) continue

    for (const [muscle, sets] of Object.entries(session.muscleLoad)) {
      const halfLife = RECOVERY_HALF_LIFE[muscle] ?? 2
      const decay = Math.pow(0.5, daysAgo / halfLife)
      if (!accumulated[muscle]) accumulated[muscle] = 0
      accumulated[muscle] += sets * decay
    }
  }

  return Object.keys(MUSCLE_LABELS).map((muscle) => {
    const raw = accumulated[muscle] ?? 0
    const score = Math.min(100, Math.round((raw / FATIGUE_CEILING_SETS) * 100))
    const readiness = 100 - score
    let status: FatigueScore['status'] = 'fresh'
    if (score >= 70) status = 'overtrained'
    else if (score >= 50) status = 'fatigued'
    else if (score >= 25) status = 'moderate'

    return {
      muscle,
      label: MUSCLE_LABELS[muscle],
      score,
      readiness,
      status,
    }
  }).sort((a, b) => b.score - a.score)
}
