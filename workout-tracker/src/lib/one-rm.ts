/**
 * 1RM estimation formulas.
 * Reliable for 1-10 reps; accuracy degrades above ~12 reps.
 */

export function epley(weight: number, reps: number): number {
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export function brzycki(weight: number, reps: number): number {
  if (reps === 1) return weight
  return weight * (36 / (37 - reps))
}

export function lombardi(weight: number, reps: number): number {
  if (reps === 1) return weight
  return weight * Math.pow(reps, 0.1)
}

/** Average of the three formulas — more stable estimate */
export function estimateOneRM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  if (reps > 12) return 0 // unreliable
  const avg = (epley(weight, reps) + brzycki(weight, reps) + lombardi(weight, reps)) / 3
  return Math.round(avg * 10) / 10
}

/** Weight needed to hit target reps at given 1RM (Epley inverse) */
export function weightForReps(oneRM: number, reps: number): number {
  if (reps === 1) return oneRM
  return Math.round((oneRM / (1 + reps / 30)) * 2) / 2 // round to 0.5kg
}

/** Percentage of 1RM for a given reps/RPE combo (rough guideline) */
export function percentageForRPE(reps: number, rpe: number): number {
  // Simplified RPE table approximation
  const basePercent = 100 - (10 - rpe) * 5 - (reps - 1) * 5
  return Math.max(50, Math.min(100, basePercent))
}

export interface RepMaxRecord {
  reps: number
  label: string
  weight: number
  estimated1RM: number
}

export function buildRepMaxTable(
  sets: { weightKg: number; reps: number }[]
): RepMaxRecord[] {
  const repMaxes: Record<number, number> = {}
  for (const s of sets) {
    if (!s.weightKg || !s.reps || s.reps < 1 || s.reps > 12) continue
    if (!repMaxes[s.reps] || s.weightKg > repMaxes[s.reps]) {
      repMaxes[s.reps] = s.weightKg
    }
  }
  return Object.entries(repMaxes).map(([reps, weight]) => ({
    reps: Number(reps),
    label: reps === '1' ? '1RM' : `${reps}RM`,
    weight,
    estimated1RM: estimateOneRM(weight, Number(reps)),
  })).sort((a, b) => a.reps - b.reps)
}
