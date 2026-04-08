import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { WorkoutLogger } from './WorkoutLogger'
import { getSbsSessionForWorkout } from '@/actions/sbs'
import { getLastPerformances } from '@/actions/workout'

export default async function ActiveSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  const [session, exercises, sbsSession] = await Promise.all([
    prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        blocks: {
          include: {
            sets: { include: { exercise: true }, orderBy: { setNumber: 'asc' } },
            metconResult: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    }),
    prisma.exercise.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        type: true,
        movementPattern: true,
        primaryMuscles: true,
      },
    }),
    getSbsSessionForWorkout(sessionId),
  ])

  if (!session) redirect('/log')
  if (session.completedAt) redirect('/dashboard')

  // Fetch last performance for every exercise to pre-fill the logger
  const allExerciseIds = exercises.map((e) => e.id)
  const lastPerformances = await getLastPerformances(allExerciseIds)

  // Build SBS target map: exerciseId → prescription
  // Also fetch TMs so we can compute the reference 1RM (TM / 0.90) for each exercise.
  const { getTrainingMaxes } = await import('@/actions/sbs')
  const trainingMaxes = await getTrainingMaxes()
  const tmByExerciseId = Object.fromEntries(
    trainingMaxes.map((tm) => [tm.exerciseId, tm.trainingMaxKg])
  )

  const sbsTargets: Record<string, {
    amrapTargetReps: number
    weightKg: number
    repsTarget: number
    plannedExerciseId: string
    incrementKg: number
    refOneRM: number
  }> = {}

  if (sbsSession) {
    for (const ex of sbsSession.exercises) {
      const tmKg = tmByExerciseId[ex.exerciseId]
      // Reference 1RM = TM ÷ 0.90, rounded to 1 decimal
      const refOneRM = tmKg ? Math.round((tmKg / 0.90) * 10) / 10 : 0
      sbsTargets[ex.exerciseId] = {
        amrapTargetReps: ex.amrapTargetReps,
        weightKg: ex.weightKg,
        repsTarget: ex.repsTarget,
        plannedExerciseId: ex.id,
        incrementKg: ex.incrementKg,
        refOneRM,
      }
    }
  }

  return (
    <WorkoutLogger
      session={session}
      exercises={exercises}
      lastPerformances={lastPerformances}
      sbsTargets={Object.keys(sbsTargets).length > 0 ? sbsTargets : undefined}
      sbsPlannedSessionId={sbsSession?.id}
    />
  )
}
