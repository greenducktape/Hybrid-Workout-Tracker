import { prisma } from '@/lib/prisma'
import { ExerciseLibrary } from './ExerciseLibrary'

export default async function ExercisesPage() {
  const exercises = await prisma.exercise.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: {
      personalRecords: {
        where: { prType: 'ONE_RM' },
        orderBy: { value: 'desc' },
        take: 1,
      },
      _count: { select: { sets: true } },
    },
  })

  const serialized = exercises.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    category: e.category,
    movementPattern: e.movementPattern,
    primaryMuscles: JSON.parse(e.primaryMuscles || '[]') as string[],
    equipment: JSON.parse(e.equipment || '[]') as string[],
    isCustom: e.isCustom,
    pr1RM: e.personalRecords[0]?.value ?? null,
    setCount: e._count.sets,
  }))

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Exercise Library</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">{exercises.length} exercises</p>
      </div>
      <ExerciseLibrary exercises={serialized} />
    </div>
  )
}
