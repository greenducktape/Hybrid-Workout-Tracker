'use server'

import { prisma } from '@/lib/prisma'
import { recommendWods, WOD_LIBRARY, type Wod } from '@/lib/wod-library'

/**
 * Get 3 WOD recommendations for today based on recent workout history.
 * Returns the wod objects (serializable).
 */
export async function getWodRecommendations(): Promise<Wod[]> {
  // Look at the last 5 completed sessions and collect their MetCon movement patterns
  const recentMetcons = await prisma.metConResult.findMany({
    where: { block: { session: { completedAt: { not: null } } } },
    orderBy: { block: { session: { completedAt: 'desc' } } },
    take: 5,
    select: { wodName: true },
  })

  // Map past WOD names back to movement tags
  const recentTags: Wod['movementTags'][0][] = []
  for (const m of recentMetcons) {
    if (!m.wodName) continue
    const wod = WOD_LIBRARY.find(
      (w) => w.name.toLowerCase() === m.wodName!.toLowerCase() || w.id === m.wodName
    )
    if (wod) recentTags.push(...wod.movementTags)
  }

  return recommendWods(recentTags, 3)
}
