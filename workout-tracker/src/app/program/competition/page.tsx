import { prisma } from '@/lib/prisma'
import { CompetitionManager } from './CompetitionManager'

export default async function CompetitionPage() {
  const competitions = await prisma.competition.findMany({
    orderBy: { date: 'asc' },
  })

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Competition Goals</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Set upcoming competitions to auto-calculate your training phase
        </p>
      </div>
      <CompetitionManager competitions={competitions.map((c) => ({
        id: c.id,
        name: c.name,
        date: c.date.toISOString(),
        type: c.type,
        goals: c.goals,
        notes: c.notes,
      }))} />
    </div>
  )
}
