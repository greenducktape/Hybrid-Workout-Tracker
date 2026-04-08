'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function addCompetition(data: FormData) {
  await prisma.competition.create({
    data: {
      name: data.get('name') as string,
      date: new Date(data.get('date') as string),
      type: data.get('type') as string,
      goals: (data.get('goals') as string) || null,
      notes: (data.get('notes') as string) || null,
    },
  })
  revalidatePath('/program/competition')
  revalidatePath('/program')
  revalidatePath('/dashboard')
}
