const HEVY_BASE = 'https://api.hevyapp.com'

export interface HevySet {
  index: number
  type: string
  weight_kg: number | null
  reps: number | null
  distance_meters: number | null
  duration_seconds: number | null
  rpe: number | null
  custom_metric: number | null
}

export interface HevyExercise {
  index: number
  title: string
  notes: string | null
  exercise_template_id: string
  supersets_id: number | null
  sets: HevySet[]
}

export interface HevyWorkout {
  id: string
  title: string
  routine_id: string | null
  description: string | null
  start_time: string
  end_time: string
  updated_at: string
  created_at: string
  exercises: HevyExercise[]
}

export interface HevyExerciseTemplate {
  id: string
  title: string
  type: string
  primary_muscle_group: string
  secondary_muscle_groups: string[]
  is_custom: boolean
}

async function hevyFetch<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${HEVY_BASE}${path}`, {
    headers: { 'api-key': apiKey },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Hevy API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function verifyHevyKey(apiKey: string): Promise<{ id: string; name: string }> {
  const data = await hevyFetch<{ data: { id: string; name: string; url: string } }>(
    '/v1/user/info',
    apiKey
  )
  return data.data
}

/** Fetch all workouts since a given date (handles pagination) */
export async function fetchHevyWorkoutsSince(
  apiKey: string,
  since: Date
): Promise<HevyWorkout[]> {
  const workouts: HevyWorkout[] = []
  let page = 1

  while (true) {
    const data = await hevyFetch<{
      page: number
      page_count: number
      workouts: HevyWorkout[]
    }>(`/v1/workouts?page=${page}&pageSize=10`, apiKey)

    for (const w of data.workouts) {
      // Workouts come newest-first — stop when we go past our since date
      if (new Date(w.updated_at) < since) {
        return workouts
      }
      workouts.push(w)
    }

    if (page >= data.page_count) break
    page++
  }

  return workouts
}

/** Fetch a paginated list of exercise templates (all pages) */
export async function fetchAllHevyExerciseTemplates(
  apiKey: string
): Promise<HevyExerciseTemplate[]> {
  const templates: HevyExerciseTemplate[] = []
  let page = 1

  while (true) {
    const data = await hevyFetch<{
      page: number
      page_count: number
      exercise_templates: HevyExerciseTemplate[]
    }>(`/v1/exercise_templates?page=${page}&pageSize=100`, apiKey)

    templates.push(...data.exercise_templates)
    if (page >= data.page_count) break
    page++
  }

  return templates
}

/** Fetch workout count */
export async function fetchHevyWorkoutCount(apiKey: string): Promise<number> {
  const data = await hevyFetch<{ workout_count: number }>('/v1/workouts/count', apiKey)
  return data.workout_count
}

/** Map Hevy muscle group names to our internal names */
export function mapHevyMuscle(hevyMuscle: string): string {
  const map: Record<string, string> = {
    chest: 'chest',
    back: 'back',
    shoulders: 'shoulders',
    biceps: 'biceps',
    triceps: 'triceps',
    legs: 'quads',
    quads: 'quads',
    hamstrings: 'hamstrings',
    glutes: 'glutes',
    calves: 'calves',
    abs: 'core',
    core: 'core',
    forearms: 'forearms',
    traps: 'traps',
    lats: 'lats',
    'full body': 'core',
    cardio: 'quads',
    other: 'core',
  }
  return map[hevyMuscle.toLowerCase()] ?? hevyMuscle.toLowerCase()
}

/** Map Hevy exercise type to our category */
export function mapHevyType(hevyType: string): { type: string; category: string; movementPattern: string } {
  const map: Record<string, { type: string; category: string; movementPattern: string }> = {
    weight_reps: { type: 'BARBELL', category: 'COMPOUND', movementPattern: 'SQUAT' },
    reps: { type: 'BODYWEIGHT', category: 'ACCESSORY', movementPattern: 'SQUAT' },
    duration: { type: 'CARDIO', category: 'CARDIO', movementPattern: 'LOCOMOTION' },
    distance_duration: { type: 'CARDIO', category: 'CARDIO', movementPattern: 'LOCOMOTION' },
    weight_distance: { type: 'CARDIO', category: 'CARDIO', movementPattern: 'LOCOMOTION' },
  }
  return map[hevyType] ?? { type: 'BARBELL', category: 'ACCESSORY', movementPattern: 'SQUAT' }
}
