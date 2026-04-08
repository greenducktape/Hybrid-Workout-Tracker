/**
 * Strength projection engine.
 *
 * Projects future 1RM from current Training Max using the SBS progression model.
 * Assumptions (conservative defaults, adjustable):
 *   - 3 sessions/week total → each day type (1/2/3) comes up ~once/week
 *   - Beat rate: 65% (historical SBS average for intermediate lifters)
 *   - When AMRAP is beaten: TM += incrementKg → estimated 1RM = TM / 0.90
 *   - When missed: no change (already handled by deload logic, averaged in)
 *
 * Returns weekly data points for charting, including an optimistic and pessimistic band.
 */

import { roundToPlate } from './sbs-engine'

export interface ProjectionInput {
  exerciseName: string
  currentTMKg: number
  currentOneRmKg: number
  incrementKg: number
}

export interface ProjectionPoint {
  week: number        // 0 = now, 1 = week 1, ...
  label: string       // "Now", "Week 4", "Week 20"
  realistic: number   // realistic 1RM estimate (65% beat rate)
  optimistic: number  // optimistic (90% beat rate)
  pessimistic: number // pessimistic (40% beat rate)
  isPast: false
}

export interface HistoryPoint {
  week: number
  label: string
  oneRM: number
  isPast: true
  date: string
}

export type ProjectionDataPoint = ProjectionPoint | HistoryPoint

/**
 * Project 1RM forward for `weeks` from today.
 * Each week = one session for this day type.
 */
export function projectLifts(
  inputs: ProjectionInput[],
  weeks = 20,
): Record<string, ProjectionPoint[]> {
  const result: Record<string, ProjectionPoint[]> = {}

  for (const input of inputs) {
    const points: ProjectionPoint[] = []
    let tmRealistic = input.currentTMKg
    let tmOptimistic = input.currentTMKg
    let tmPessimistic = input.currentTMKg

    for (let w = 0; w <= weeks; w++) {
      const oneRmRealistic = Math.round((tmRealistic / 0.90) * 10) / 10
      const oneRmOptimistic = Math.round((tmOptimistic / 0.90) * 10) / 10
      const oneRmPessimistic = Math.round((tmPessimistic / 0.90) * 10) / 10

      points.push({
        week: w,
        label: w === 0 ? 'Now' : w === 4 ? '4 wks' : w === 8 ? '8 wks' : w === 12 ? '12 wks' : w === 16 ? '16 wks' : w === 20 ? '20 wks' : `W${w}`,
        realistic: oneRmRealistic,
        optimistic: oneRmOptimistic,
        pessimistic: oneRmPessimistic,
        isPast: false,
      })

      // Apply one session's worth of progression at different beat rates
      tmRealistic = roundToPlate(tmRealistic + input.incrementKg * 0.65)
      tmOptimistic = roundToPlate(tmOptimistic + input.incrementKg * 0.90)
      tmPessimistic = roundToPlate(tmPessimistic + input.incrementKg * 0.40)
    }

    result[input.exerciseName] = points
  }

  return result
}

/**
 * Merge historical PR data with projection points for a combined chart.
 * Historical data is shown as solid line, projection as dashed.
 */
export function buildCombinedChartData(
  historicalData: Array<{ date: string; oneRM: number }>,
  projection: ProjectionPoint[],
  todayStr: string,
): Array<{
  date: string
  label: string
  historical?: number
  realistic?: number
  optimistic?: number
  pessimistic?: number
  isPast: boolean
}> {
  const result: ReturnType<typeof buildCombinedChartData> = []

  // Add historical points
  for (const h of historicalData) {
    result.push({
      date: h.date,
      label: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      historical: h.oneRM,
      isPast: true,
    })
  }

  // Add projection points (starting from today)
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const todayMs = new Date(todayStr).getTime()

  for (const p of projection) {
    const date = new Date(todayMs + p.week * msPerWeek).toISOString().split('T')[0]
    // Week 0 = today: bridge from historical to projected
    if (p.week === 0) {
      const lastHistorical = historicalData[historicalData.length - 1]
      result.push({
        date,
        label: 'Now',
        historical: lastHistorical?.oneRM,
        realistic: p.realistic,
        optimistic: p.optimistic,
        pessimistic: p.pessimistic,
        isPast: false,
      })
    } else {
      result.push({
        date,
        label: p.label,
        realistic: p.realistic,
        optimistic: p.optimistic,
        pessimistic: p.pessimistic,
        isPast: false,
      })
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}
