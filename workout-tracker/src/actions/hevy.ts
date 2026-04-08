'use server'

import { prisma } from '@/lib/prisma'
import {
  verifyHevyKey,
  fetchHevyWorkoutsSince,
  fetchAllHevyExerciseTemplates,
  fetchHevyWorkoutCount,
  mapHevyMuscle,
  mapHevyType,
  type HevyWorkout,
} from '@/lib/hevy'
import { estimateOneRM } from '@/lib/one-rm'
import { slugify, getTrainingPhase } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

// ─── Settings helpers ────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } })
  return row?.value ?? null
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

// ─── API key management ──────────────────────────────────────────────

export async function saveHevyApiKey(apiKey: string): Promise<{ success: boolean; username?: string; error?: string }> {
  try {
    const user = await verifyHevyKey(apiKey)
    await setSetting('hevy_api_key', apiKey)
    await setSetting('hevy_username', user.name)
    revalidatePath('/settings')
    return { success: true, username: user.name }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Invalid API key' }
  }
}

export async function removeHevyApiKey() {
  await prisma.setting.deleteMany({ where: { key: { in: ['hevy_api_key', 'hevy_username', 'hevy_last_sync'] } } })
  revalidatePath('/settings')
}

// ─── Exercise template sync ──────────────────────────────────────────

async function syncHevyExerciseTemplates(apiKey: string): Promise<void> {
  const templates = await fetchAllHevyExerciseTemplates(apiKey)

  for (const t of templates) {
    // Try to find existing exercise by hevyTemplateId or by name
    const existing = await prisma.exercise.findFirst({
      where: {
        OR: [
          { hevyTemplateId: t.id },
          { name: t.title },
        ],
      },
    })

    if (existing) {
      // Update the hevyTemplateId if not set
      if (!existing.hevyTemplateId) {
        await prisma.exercise.update({
          where: { id: existing.id },
          data: { hevyTemplateId: t.id },
        })
      }
    } else {
      // Create a new exercise from the Hevy template
      const mapped = mapHevyType(t.type)
      const primaryMuscle = mapHevyMuscle(t.primary_muscle_group)
      const secondaryMuscles = t.secondary_muscle_groups.map(mapHevyMuscle)

      let slugBase = slugify(t.title)
      let slug = slugBase
      let n = 1
      while (await prisma.exercise.findUnique({ where: { slug } })) {
        slug = `${slugBase}-${n++}`
      }

      await prisma.exercise.create({
        data: {
          name: t.title,
          slug,
          type: mapped.type,
          category: mapped.category,
          movementPattern: mapped.movementPattern,
          primaryMuscles: JSON.stringify([primaryMuscle]),
          secondaryMuscles: JSON.stringify(secondaryMuscles),
          hevyTemplateId: t.id,
          isCustom: t.is_custom,
        },
      })
    }
  }
}

// ─── Workout import ──────────────────────────────────────────────────

async function importHevyWorkout(workout: HevyWorkout): Promise<void> {
  // Skip already imported
  const existing = await prisma.workoutSession.findUnique({
    where: { hevyId: workout.id },
  })
  if (existing) return

  const startTime = new Date(workout.start_time)
  const endTime = new Date(workout.end_time)
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  // Create session
  const session = await prisma.workoutSession.create({
    data: {
      hevyId: workout.id,
      source: 'hevy',
      date: startTime,
      dayOfWeek: startTime.getDay(),
      phase: 'BASE', // will be updated by phase calculator if competition exists
      template: workout.title,
      notes: workout.description,
      durationMinutes: durationMinutes > 0 ? durationMinutes : null,
      completedAt: endTime,
    },
  })

  // Group exercises by supersets_id for block classification
  let blockOrder = 0

  for (const ex of workout.exercises) {
    // Find matching exercise in our library
    const exercise = await prisma.exercise.findFirst({
      where: {
        OR: [
          { hevyTemplateId: ex.exercise_template_id },
          { name: ex.title },
        ],
      },
    })

    if (!exercise) continue // skip unknown exercises (shouldn't happen after template sync)

    // Determine block type from exercise category
    const blockType =
      exercise.category === 'COMPOUND' || exercise.category === 'OLYMPIC'
        ? 'MAIN_LIFT'
        : exercise.category === 'METCON'
        ? 'METCON'
        : 'ACCESSORY'

    const block = await prisma.workoutBlock.create({
      data: {
        sessionId: session.id,
        order: blockOrder++,
        blockType,
        notes: ex.notes,
      },
    })

    // Import sets
    let setIndex = 0
    for (const set of ex.sets) {
      // Skip warmup sets from PR tracking
      if (set.type === 'warmup') {
        await prisma.setLog.create({
          data: {
            blockId: block.id,
            exerciseId: exercise.id,
            setNumber: setIndex++,
            weightKg: set.weight_kg,
            reps: set.reps,
            rpe: set.rpe,
            durationSeconds: set.duration_seconds,
            distanceMeters: set.distance_meters,
            isRx: true,
            completedAt: startTime,
          },
        })
        continue
      }

      await prisma.setLog.create({
        data: {
          blockId: block.id,
          exerciseId: exercise.id,
          setNumber: setIndex++,
          weightKg: set.weight_kg,
          reps: set.reps,
          rpe: set.rpe,
          durationSeconds: set.duration_seconds,
          distanceMeters: set.distance_meters,
          isRx: true,
          completedAt: startTime,
        },
      })

      // Check for PRs on working sets with weight+reps
      if (set.weight_kg && set.reps && set.type === 'normal') {
        const est1RM = estimateOneRM(set.weight_kg, set.reps)

        if (est1RM > 0) {
          const existing = await prisma.personalRecord.findUnique({
            where: { exerciseId_prType: { exerciseId: exercise.id, prType: 'ONE_RM' } },
          })
          if (!existing || est1RM > existing.value) {
            await prisma.personalRecord.upsert({
              where: { exerciseId_prType: { exerciseId: exercise.id, prType: 'ONE_RM' } },
              create: {
                exerciseId: exercise.id,
                prType: 'ONE_RM',
                value: est1RM,
                weightKg: set.weight_kg,
                achievedAt: startTime,
              },
              update: { value: est1RM, weightKg: set.weight_kg, achievedAt: startTime },
            })
          }
        }

        // Rep-max PRs
        const prTypeMap: Record<number, string> = { 1: 'ONE_RM', 3: 'THREE_RM', 5: 'FIVE_RM', 10: 'TEN_RM' }
        const prType = prTypeMap[set.reps]
        if (prType && set.reps > 1) {
          const existing = await prisma.personalRecord.findUnique({
            where: { exerciseId_prType: { exerciseId: exercise.id, prType } },
          })
          if (!existing || set.weight_kg > (existing.weightKg ?? 0)) {
            await prisma.personalRecord.upsert({
              where: { exerciseId_prType: { exerciseId: exercise.id, prType } },
              create: {
                exerciseId: exercise.id,
                prType,
                value: set.weight_kg,
                weightKg: set.weight_kg,
                achievedAt: startTime,
              },
              update: { value: set.weight_kg, weightKg: set.weight_kg, achievedAt: startTime },
            })
          }
        }
      }
    }
  }
}

// ─── Main sync function ──────────────────────────────────────────────

export interface SyncResult {
  success: boolean
  imported: number
  skipped: number
  totalInHevy: number
  error?: string
}

export async function syncHevyWorkouts(): Promise<SyncResult> {
  try {
    const apiKey = await getSetting('hevy_api_key')
    if (!apiKey) return { success: false, imported: 0, skipped: 0, totalInHevy: 0, error: 'No API key configured' }

    const lastSyncStr = await getSetting('hevy_last_sync')
    const since = lastSyncStr ? new Date(lastSyncStr) : new Date(0)

    // Step 1: Sync exercise templates so we can match sets
    await syncHevyExerciseTemplates(apiKey)

    // Step 2: Fetch workouts since last sync
    const [workouts, totalCount] = await Promise.all([
      fetchHevyWorkoutsSince(apiKey, since),
      fetchHevyWorkoutCount(apiKey),
    ])

    let imported = 0
    let skipped = 0

    for (const workout of workouts) {
      const existingSession = await prisma.workoutSession.findUnique({
        where: { hevyId: workout.id },
      })
      if (existingSession) {
        skipped++
        continue
      }
      await importHevyWorkout(workout)
      imported++
    }

    await setSetting('hevy_last_sync', new Date().toISOString())

    revalidatePath('/dashboard')
    revalidatePath('/progress')
    revalidatePath('/log/history')
    revalidatePath('/settings')

    return { success: true, imported, skipped, totalInHevy: totalCount }
  } catch (err) {
    console.error('Hevy sync error:', err)
    return {
      success: false,
      imported: 0,
      skipped: 0,
      totalInHevy: 0,
      error: err instanceof Error ? err.message : 'Sync failed',
    }
  }
}
