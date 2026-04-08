'use server'

import { prisma } from '@/lib/prisma'
import { estimateOneRM } from '@/lib/one-rm'
import { revalidatePath } from 'next/cache'

export async function createSession(data: {
  template?: string
  phase?: string
  notes?: string
}) {
  const now = new Date()
  const session = await prisma.workoutSession.create({
    data: {
      date: now,
      dayOfWeek: now.getDay(),
      phase: data.phase ?? 'BASE',
      template: data.template,
      notes: data.notes,
    },
  })
  revalidatePath('/dashboard')
  return session
}

export async function createBlock(data: {
  sessionId: string
  order: number
  blockType: string
  notes?: string
}) {
  return prisma.workoutBlock.create({ data })
}

export async function logSet(data: {
  blockId: string
  exerciseId: string
  setNumber: number
  weightKg?: number
  reps?: number
  rpe?: number
  durationSeconds?: number
  distanceMeters?: number
  isRx?: boolean
  isAmrap?: boolean
  amrapTarget?: number
  scalingNote?: string
  notes?: string
}): Promise<{ set: { id: string }; newPR: boolean; estimated1RM?: number }> {
  const set = await prisma.setLog.create({ data })

  let newPR = false
  let estimated1RM: number | undefined

  if (data.weightKg && data.reps) {
    estimated1RM = estimateOneRM(data.weightKg, data.reps) || undefined

    // Check 1RM PR
    if (estimated1RM) {
      const existing = await prisma.personalRecord.findUnique({
        where: { exerciseId_prType: { exerciseId: data.exerciseId, prType: 'ONE_RM' } },
      })
      if (!existing || estimated1RM > existing.value) {
        await prisma.personalRecord.upsert({
          where: { exerciseId_prType: { exerciseId: data.exerciseId, prType: 'ONE_RM' } },
          create: {
            exerciseId: data.exerciseId,
            prType: 'ONE_RM',
            value: estimated1RM,
            weightKg: data.weightKg,
            achievedAt: new Date(),
          },
          update: {
            value: estimated1RM,
            weightKg: data.weightKg,
            achievedAt: new Date(),
          },
        })
        newPR = true
      }
    }

    // Check rep-max PR (actual weight for specific rep count)
    const prTypeMap: Record<number, string> = { 1: 'ONE_RM', 3: 'THREE_RM', 5: 'FIVE_RM', 10: 'TEN_RM' }
    const prType = prTypeMap[data.reps]
    if (prType && data.reps > 1) {
      const existing = await prisma.personalRecord.findUnique({
        where: { exerciseId_prType: { exerciseId: data.exerciseId, prType } },
      })
      if (!existing || data.weightKg > (existing.weightKg ?? 0)) {
        await prisma.personalRecord.upsert({
          where: { exerciseId_prType: { exerciseId: data.exerciseId, prType } },
          create: {
            exerciseId: data.exerciseId,
            prType,
            value: data.weightKg,
            weightKg: data.weightKg,
            achievedAt: new Date(),
          },
          update: {
            value: data.weightKg,
            weightKg: data.weightKg,
            achievedAt: new Date(),
          },
        })
        newPR = true
      }
    }
  }

  revalidatePath('/progress')
  return { set, newPR, estimated1RM }
}

export async function updateSet(data: {
  setId: string
  weightKg?: number
  reps?: number
  rpe?: number
  durationSeconds?: number
  distanceMeters?: number
  isAmrap?: boolean
  amrapTarget?: number
  scalingNote?: string
  notes?: string
}) {
  const set = await prisma.setLog.update({
    where: { id: data.setId },
    data: {
      weightKg: data.weightKg,
      reps: data.reps,
      rpe: data.rpe,
      durationSeconds: data.durationSeconds,
      distanceMeters: data.distanceMeters,
      isAmrap: data.isAmrap,
      amrapTarget: data.amrapTarget,
      scalingNote: data.scalingNote,
      notes: data.notes,
    },
  })
  revalidatePath('/log')
  return set
}

export async function saveMetConResult(data: {
  blockId: string
  wodName?: string
  wodType: string
  timeCap?: number
  roundsCompleted?: number
  repsCompleted?: number
  completionSeconds?: number
  dnf?: boolean
  isRx?: boolean
  scalingNote?: string
  notes?: string
}) {
  const result = await prisma.metConResult.create({ data })

  // Save WOD time PR if applicable
  if (data.completionSeconds && data.wodName) {
    const exercise = await prisma.exercise.findFirst({
      where: { name: { contains: data.wodName } },
    })
    if (exercise) {
      const existing = await prisma.personalRecord.findUnique({
        where: { exerciseId_prType: { exerciseId: exercise.id, prType: 'WOD_TIME' } },
      })
      if (!existing || data.completionSeconds < existing.value) {
        await prisma.personalRecord.upsert({
          where: { exerciseId_prType: { exerciseId: exercise.id, prType: 'WOD_TIME' } },
          create: {
            exerciseId: exercise.id,
            prType: 'WOD_TIME',
            value: data.completionSeconds,
            isRx: data.isRx ?? true,
            achievedAt: new Date(),
          },
          update: {
            value: data.completionSeconds,
            isRx: data.isRx ?? true,
            achievedAt: new Date(),
          },
        })
      }
    }
  }

  revalidatePath('/progress')
  return result
}

export async function completeSession(
  sessionId: string,
  data: {
    durationMinutes?: number
    perceivedEffort?: number
    caloriesBurned?: number
    heartRateAvg?: number
    heartRateMax?: number
    notes?: string
  }
) {
  const session = await prisma.workoutSession.update({
    where: { id: sessionId },
    data: {
      ...data,
      completedAt: new Date(),
    },
  })
  revalidatePath('/dashboard')
  revalidatePath('/log/history')
  return session
}

/**
 * Get last logged weight + reps for a batch of exercises.
 * Used to pre-fill the workout logger when an exercise is added.
 * Returns a map: exerciseId → { weightKg, reps }
 */
export async function getLastPerformances(
  exerciseIds: string[],
): Promise<Record<string, { weightKg: number; reps: number }>> {
  if (exerciseIds.length === 0) return {}

  // For each exercise, find the most recent set with weight + reps
  const rows = await prisma.setLog.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      weightKg: { not: null, gt: 0 },
      reps: { not: null, gt: 0 },
    },
    orderBy: { completedAt: 'desc' },
    select: { exerciseId: true, weightKg: true, reps: true },
    distinct: ['exerciseId'],
  })

  const result: Record<string, { weightKg: number; reps: number }> = {}
  for (const row of rows) {
    if (row.weightKg && row.reps) {
      result[row.exerciseId] = { weightKg: row.weightKg, reps: row.reps }
    }
  }
  return result
}

export async function deleteSession(sessionId: string) {
  await prisma.workoutSession.delete({ where: { id: sessionId } })
  revalidatePath('/dashboard')
  revalidatePath('/log/history')
}

export async function logBodyMetric(data: {
  bodyWeightKg?: number
  heartRateResting?: number
  sleepHours?: number
  energyLevel?: number
  notes?: string
  sessionId?: string
}) {
  const metric = await prisma.bodyMetric.create({
    data: { ...data, date: new Date() },
  })
  revalidatePath('/progress/body')
  return metric
}
