'use server'

import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

export async function createExercise(data: {
  name: string
  type: string
  category: string
  movementPattern: string
  primaryMuscles: string[]
  secondaryMuscles?: string[]
  equipment?: string[]
  description?: string
  cues?: string
}) {
  const exercise = await prisma.exercise.create({
    data: {
      name: data.name,
      slug: slugify(data.name),
      type: data.type,
      category: data.category,
      movementPattern: data.movementPattern,
      primaryMuscles: JSON.stringify(data.primaryMuscles),
      secondaryMuscles: JSON.stringify(data.secondaryMuscles ?? []),
      equipment: JSON.stringify(data.equipment ?? []),
      description: data.description,
      cues: data.cues,
      isCustom: true,
    },
  })
  revalidatePath('/exercises')
  return exercise
}

export async function searchExercises(query: string, filters?: {
  type?: string
  category?: string
  movementPattern?: string
  muscle?: string
}) {
  const exercises = await prisma.exercise.findMany({
    where: {
      AND: [
        query ? { name: { contains: query } } : {},
        filters?.type ? { type: filters.type } : {},
        filters?.category ? { category: filters.category } : {},
        filters?.movementPattern ? { movementPattern: filters.movementPattern } : {},
        filters?.muscle ? { primaryMuscles: { contains: filters.muscle } } : {},
      ],
    },
    orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
    take: 50,
  })
  return exercises
}
