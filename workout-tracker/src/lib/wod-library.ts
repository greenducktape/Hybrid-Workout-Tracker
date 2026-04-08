/**
 * Curated WOD library.
 * Categories: CONDITIONING (cardio-biased), STRENGTH_METCON (barbell + conditioning),
 *             GYMNASTICS (bodyweight/gymnastics), CLASSIC (benchmark CrossFit WODs)
 *
 * Each WOD has a `movementTags` array used to avoid repeating movement patterns
 * on consecutive days.
 */

export type WodCategory = 'CONDITIONING' | 'STRENGTH_METCON' | 'GYMNASTICS' | 'CLASSIC'
export type WodType = 'AMRAP' | 'FOR_TIME' | 'EMOM' | 'TABATA' | 'CHIPPER'

export interface Wod {
  id: string
  name: string
  category: WodCategory
  type: WodType
  /** Duration hint in minutes */
  timeCap: number
  /** Formatted description shown to user */
  description: string
  /** Rx movements for scoring reference */
  movements: string[]
  /** Tags for fatigue/conflict detection — avoid repeating the same tag on back-to-back days */
  movementTags: Array<'squat' | 'hinge' | 'push' | 'pull' | 'run' | 'row' | 'double-under' | 'barbell' | 'gymnastics' | 'kb'>
  /** Approximate intensity level 1-5 */
  intensity: number
}

export const WOD_LIBRARY: Wod[] = [
  // ─── CLASSIC BENCHMARKS ───────────────────────────────────────────
  {
    id: 'fran',
    name: 'Fran',
    category: 'CLASSIC',
    type: 'FOR_TIME',
    timeCap: 10,
    description: '21-15-9 reps for time:\n• Thrusters (43/30 kg)\n• Pull-ups',
    movements: ['Thruster 43kg', 'Pull-up'],
    movementTags: ['squat', 'push', 'pull', 'barbell'],
    intensity: 5,
  },
  {
    id: 'cindy',
    name: 'Cindy',
    category: 'GYMNASTICS',
    type: 'AMRAP',
    timeCap: 20,
    description: '20-min AMRAP:\n• 5 Pull-ups\n• 10 Push-ups\n• 15 Air Squats',
    movements: ['Pull-up', 'Push-up', 'Air Squat'],
    movementTags: ['pull', 'push', 'squat', 'gymnastics'],
    intensity: 3,
  },
  {
    id: 'helen',
    name: 'Helen',
    category: 'CONDITIONING',
    type: 'FOR_TIME',
    timeCap: 15,
    description: '3 rounds for time:\n• 400m Run\n• 21 KB Swings (24/16 kg)\n• 12 Pull-ups',
    movements: ['400m Run', 'KB Swing 24kg', 'Pull-up'],
    movementTags: ['run', 'pull', 'kb'],
    intensity: 4,
  },
  {
    id: 'grace',
    name: 'Grace',
    category: 'CLASSIC',
    type: 'FOR_TIME',
    timeCap: 10,
    description: '30 Clean & Jerks (60/43 kg) for time',
    movements: ['Clean & Jerk 60kg'],
    movementTags: ['barbell', 'push', 'hinge'],
    intensity: 5,
  },
  {
    id: 'diane',
    name: 'Diane',
    category: 'STRENGTH_METCON',
    type: 'FOR_TIME',
    timeCap: 10,
    description: '21-15-9 reps for time:\n• Deadlifts (102/70 kg)\n• Handstand Push-ups',
    movements: ['Deadlift 102kg', 'Handstand Push-up'],
    movementTags: ['hinge', 'push', 'gymnastics', 'barbell'],
    intensity: 5,
  },
  {
    id: 'elizabeth',
    name: 'Elizabeth',
    category: 'CLASSIC',
    type: 'FOR_TIME',
    timeCap: 15,
    description: '21-15-9 reps for time:\n• Squat Cleans (60/43 kg)\n• Ring Dips',
    movements: ['Squat Clean 60kg', 'Ring Dip'],
    movementTags: ['squat', 'barbell', 'push', 'gymnastics'],
    intensity: 5,
  },
  // ─── CONDITIONING ────────────────────────────────────────────────
  {
    id: 'rowing-intervals',
    name: 'Rowing Intervals',
    category: 'CONDITIONING',
    type: 'EMOM',
    timeCap: 20,
    description: 'EMOM 20 min:\n• Odd: 15/12 cal Row\n• Even: 15 Box Jumps (60/50 cm)',
    movements: ['Rowing', 'Box Jump'],
    movementTags: ['row'],
    intensity: 3,
  },
  {
    id: 'running-pyramid',
    name: 'Running Pyramid',
    category: 'CONDITIONING',
    type: 'FOR_TIME',
    timeCap: 25,
    description: 'For time:\n• 200m – 400m – 800m – 400m – 200m Run\nRest 1:1 between efforts',
    movements: ['Run'],
    movementTags: ['run'],
    intensity: 4,
  },
  {
    id: 'assault-bike-tabata',
    name: 'Assault Bike Tabata',
    category: 'CONDITIONING',
    type: 'TABATA',
    timeCap: 12,
    description: '8 rounds Tabata (20s work / 10s rest):\n• Assault Bike\nRest 2 min, then:\n8 rounds:\n• Double-unders',
    movements: ['Assault Bike', 'Double-under'],
    movementTags: ['double-under'],
    intensity: 4,
  },
  {
    id: 'chipper-1',
    name: 'The Grind',
    category: 'CONDITIONING',
    type: 'CHIPPER',
    timeCap: 25,
    description: 'For time:\n• 50 Double-unders\n• 40 Wall Balls (9/6 kg)\n• 30 Pull-ups\n• 20 Burpees\n• 10 Box Jumps (60 cm)',
    movements: ['Double-under', 'Wall Ball', 'Pull-up', 'Burpee', 'Box Jump'],
    movementTags: ['double-under', 'pull', 'squat'],
    intensity: 4,
  },
  // ─── STRENGTH METCON ─────────────────────────────────────────────
  {
    id: 'barbell-cycling',
    name: 'Barbell Cycling',
    category: 'STRENGTH_METCON',
    type: 'EMOM',
    timeCap: 15,
    description: 'EMOM 15 min (cycle every 3 min):\n• Min 1: 5 Power Cleans (70/50 kg)\n• Min 2: 5 Push Press (50/35 kg)\n• Min 3: 10 Front Squats (50/35 kg)',
    movements: ['Power Clean 70kg', 'Push Press 50kg', 'Front Squat 50kg'],
    movementTags: ['barbell', 'squat', 'push', 'hinge'],
    intensity: 4,
  },
  {
    id: 'deadlift-burpee',
    name: 'Death by Deadlift',
    category: 'STRENGTH_METCON',
    type: 'AMRAP',
    timeCap: 12,
    description: '12-min AMRAP:\n• 5 Deadlifts (80/55 kg)\n• 10 Burpees over bar\n• 15 KB Swings (24/16 kg)',
    movements: ['Deadlift 80kg', 'Burpee', 'KB Swing 24kg'],
    movementTags: ['hinge', 'barbell', 'kb'],
    intensity: 4,
  },
  {
    id: 'thruster-du',
    name: 'Thrusters & Doubles',
    category: 'STRENGTH_METCON',
    type: 'FOR_TIME',
    timeCap: 12,
    description: '5 rounds for time:\n• 7 Thrusters (50/35 kg)\n• 30 Double-unders',
    movements: ['Thruster 50kg', 'Double-under'],
    movementTags: ['squat', 'push', 'barbell', 'double-under'],
    intensity: 4,
  },
  {
    id: 'push-pull-squat',
    name: 'Push-Pull-Squat',
    category: 'STRENGTH_METCON',
    type: 'AMRAP',
    timeCap: 18,
    description: '18-min AMRAP:\n• 6 Push Press (50/35 kg)\n• 6 Hang Power Cleans (50/35 kg)\n• 6 Front Squats (50/35 kg)\n• 12 Pull-ups',
    movements: ['Push Press 50kg', 'Hang Power Clean', 'Front Squat', 'Pull-up'],
    movementTags: ['push', 'pull', 'squat', 'barbell'],
    intensity: 3,
  },
  // ─── GYMNASTICS ───────────────────────────────────────────────────
  {
    id: 'strict-gymnastics',
    name: 'Strict Saturday',
    category: 'GYMNASTICS',
    type: 'AMRAP',
    timeCap: 20,
    description: '20-min AMRAP:\n• 5 Strict Pull-ups\n• 10 Strict Push-ups\n• 5 Strict Dips\n• 15 V-ups',
    movements: ['Strict Pull-up', 'Strict Push-up', 'Dip', 'V-up'],
    movementTags: ['pull', 'push', 'gymnastics'],
    intensity: 2,
  },
  {
    id: 'emom-gymnastics',
    name: 'Muscle-Up Practice',
    category: 'GYMNASTICS',
    type: 'EMOM',
    timeCap: 20,
    description: 'EMOM 20 min:\n• Odd: 3-5 Ring Muscle-ups (or 5 Chest-to-Bar)\n• Even: 10 Toes-to-Bar',
    movements: ['Ring Muscle-up', 'Toes-to-Bar'],
    movementTags: ['pull', 'push', 'gymnastics'],
    intensity: 3,
  },
  {
    id: 'hspu-pullup',
    name: 'Pressing Power',
    category: 'GYMNASTICS',
    type: 'FOR_TIME',
    timeCap: 15,
    description: '5 rounds for time:\n• 10 Handstand Push-ups\n• 10 Chest-to-Bar Pull-ups\n• 200m Run',
    movements: ['Handstand Push-up', 'Chest-to-Bar', 'Run'],
    movementTags: ['push', 'pull', 'gymnastics', 'run'],
    intensity: 4,
  },
  {
    id: 'amrap-burpee-pullup',
    name: 'Simple & Brutal',
    category: 'GYMNASTICS',
    type: 'AMRAP',
    timeCap: 10,
    description: '10-min AMRAP:\n• 5 Pull-ups\n• 10 Push-ups\n• 15 Squats\n• 5 Burpees',
    movements: ['Pull-up', 'Push-up', 'Squat', 'Burpee'],
    movementTags: ['pull', 'push', 'squat', 'gymnastics'],
    intensity: 3,
  },
]

// ─── Recommendation logic ─────────────────────────────────────────────

/**
 * Pick 3 WOD options that:
 * 1. Span different categories (variety)
 * 2. Avoid repeating movement tags from recent sessions
 * 3. Vary intensity levels
 */
export function recommendWods(
  recentMovementTags: Array<Wod['movementTags'][0]>,
  count = 3,
): Wod[] {
  // Score each WOD: lower = better (fewer overlapping tags with recent work)
  const scored = WOD_LIBRARY.map((wod) => {
    const overlap = wod.movementTags.filter((t) => recentMovementTags.includes(t)).length
    return { wod, score: overlap }
  })

  // Sort by overlap (lower = fresher), then shuffle within same score for variety
  scored.sort((a, b) => a.score - b.score || Math.random() - 0.5)

  // Ensure we pick across categories
  const picked: Wod[] = []
  const usedCategories = new Set<WodCategory>()

  for (const { wod } of scored) {
    if (picked.length >= count) break
    // Prefer different categories but don't block if we need to fill
    if (!usedCategories.has(wod.category) || picked.length === count - 1) {
      picked.push(wod)
      usedCategories.add(wod.category)
    }
  }

  // Fill remaining slots if needed
  for (const { wod } of scored) {
    if (picked.length >= count) break
    if (!picked.includes(wod)) picked.push(wod)
  }

  // Sort final list by intensity: one easy, one medium, one hard
  return picked.sort((a, b) => a.intensity - b.intensity)
}
