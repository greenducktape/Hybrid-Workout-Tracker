/**
 * Weekly training volume calculations per muscle group.
 * Volume = sets × reps × weight (kg) — normalized tonnage.
 * Also tracks "hard sets" (working sets) as a simpler metric.
 */

export interface MuscleVolume {
  muscle: string
  label: string
  hardSets: number
  tonnage: number // kg moved total
  color: string
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
  forearms: 'Forearms',
  hip_flexors: 'Hip Flexors',
}

const MUSCLE_COLORS: Record<string, string> = {
  quads: '#3b82f6',
  hamstrings: '#8b5cf6',
  glutes: '#ec4899',
  calves: '#06b6d4',
  chest: '#ef4444',
  back: '#f97316',
  lats: '#f59e0b',
  traps: '#84cc16',
  shoulders: '#10b981',
  triceps: '#6366f1',
  biceps: '#a855f7',
  core: '#14b8a6',
  forearms: '#78716c',
  hip_flexors: '#94a3b8',
}

export interface SetWithMuscles {
  weightKg: number | null
  reps: number | null
  exercise: {
    primaryMuscles: string
    secondaryMuscles: string
  }
}

export function calculateMuscleVolume(sets: SetWithMuscles[]): MuscleVolume[] {
  const volumeMap: Record<string, { hardSets: number; tonnage: number }> = {}

  for (const set of sets) {
    if (!set.weightKg || !set.reps) continue
    const primary: string[] = JSON.parse(set.exercise.primaryMuscles || '[]')
    const secondary: string[] = JSON.parse(set.exercise.secondaryMuscles || '[]')
    const tonnageThisSet = set.weightKg * set.reps

    for (const muscle of primary) {
      if (!volumeMap[muscle]) volumeMap[muscle] = { hardSets: 0, tonnage: 0 }
      volumeMap[muscle].hardSets += 1
      volumeMap[muscle].tonnage += tonnageThisSet
    }
    for (const muscle of secondary) {
      if (!volumeMap[muscle]) volumeMap[muscle] = { hardSets: 0, tonnage: 0 }
      volumeMap[muscle].hardSets += 0.5
      volumeMap[muscle].tonnage += tonnageThisSet * 0.5
    }
  }

  return Object.entries(volumeMap)
    .map(([muscle, data]) => ({
      muscle,
      label: MUSCLE_LABELS[muscle] ?? muscle,
      hardSets: Math.round(data.hardSets * 10) / 10,
      tonnage: Math.round(data.tonnage),
      color: MUSCLE_COLORS[muscle] ?? '#94a3b8',
    }))
    .sort((a, b) => b.hardSets - a.hardSets)
}
