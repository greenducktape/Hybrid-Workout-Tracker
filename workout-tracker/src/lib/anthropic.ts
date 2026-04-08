import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { estimateOneRM } from '@/lib/one-rm'
import { calculateMuscleVolume } from '@/lib/volume'
import { calculateFatigue } from '@/lib/fatigue'
import { getTrainingPhase } from '@/lib/utils'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function buildCoachContext(): Promise<string> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const [recentSessions, topPRs, competition] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { date: { gte: fourteenDaysAgo } },
      include: {
        blocks: {
          include: {
            sets: { include: { exercise: true } },
            metconResult: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.personalRecord.findMany({
      include: { exercise: true },
      orderBy: { achievedAt: 'desc' },
      take: 20,
    }),
    prisma.competition.findFirst({
      where: { date: { gte: new Date() } },
      orderBy: { date: 'asc' },
    }),
  ])

  const currentPhase = getTrainingPhase(competition?.date ?? null)

  // Build fatigue map from recent sessions
  const allSets = recentSessions
    .filter((s) => s.date >= sevenDaysAgo)
    .flatMap((s) => s.blocks.flatMap((b) => b.sets))

  const volume = calculateMuscleVolume(allSets)
  const fatigue = calculateFatigue(
    recentSessions.map((s) => ({
      date: s.date,
      muscleLoad: Object.fromEntries(
        calculateMuscleVolume(s.blocks.flatMap((b) => b.sets)).map((v) => [v.muscle, v.hardSets])
      ),
    }))
  )

  const fatigueMap = Object.fromEntries(
    fatigue.map((f) => [f.muscle, { score: f.score, status: f.status }])
  )

  // Summarize recent sessions
  const sessionSummaries = recentSessions.slice(0, 7).map((s) => {
    const lifts = s.blocks
      .flatMap((b) => b.sets)
      .filter((set) => set.weightKg && set.reps)
      .map((set) => `${set.exercise.name}: ${set.weightKg}kg×${set.reps}`)
    const metcons = s.blocks
      .filter((b) => b.metconResult)
      .map((b) => {
        const m = b.metconResult!
        return `${m.wodName ?? 'MetCon'} (${m.wodType}): ${
          m.completionSeconds
            ? `${Math.floor(m.completionSeconds / 60)}:${String(m.completionSeconds % 60).padStart(2, '0')}`
            : m.roundsCompleted
            ? `${m.roundsCompleted}+${m.repsCompleted ?? 0} rounds`
            : 'DNF'
        } ${m.isRx ? 'RX' : 'Scaled'}`
      })
    return {
      date: s.date.toISOString().split('T')[0],
      template: s.template,
      lifts: lifts.slice(0, 5),
      metcons,
      rpe: s.perceivedEffort,
      duration: s.durationMinutes,
    }
  })

  // Top PRs
  const prSummary = topPRs.slice(0, 15).map((pr) => ({
    exercise: pr.exercise.name,
    type: pr.prType,
    value: pr.prType === 'WOD_TIME'
      ? `${Math.floor(pr.value / 60)}:${String(pr.value % 60).padStart(2, '0')}`
      : pr.prType === 'AMRAP_SCORE'
      ? `${pr.value} reps/rounds`
      : `${pr.value}kg`,
    date: pr.achievedAt.toISOString().split('T')[0],
  }))

  return JSON.stringify({
    currentPhase,
    competition: competition
      ? {
          name: competition.name,
          date: competition.date.toISOString().split('T')[0],
          type: competition.type,
          weeksOut: Math.ceil(
            (competition.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)
          ),
        }
      : null,
    fatigue: fatigueMap,
    weeklyVolume: Object.fromEntries(volume.map((v) => [v.muscle, v.hardSets])),
    recentSessions: sessionSummaries,
    personalRecords: prSummary,
  }, null, 2)
}

export const COACH_SYSTEM_PROMPT = `You are an elite hybrid athletic coach specializing in strength training, hypertrophy, and functional fitness/CrossFit.

You have deep expertise in:
- Powerlifting programming (squat, bench press, deadlift progressions)
- Olympic weightlifting (snatch, clean & jerk technique and loading)
- CrossFit competition preparation (Open, Quarterfinals, Sanctionals)
- Hypertrophy training (volume landmarks, mechanical tension, metabolic stress)
- Periodization models (conjugate, block, linear, undulating)
- CrossFit benchmark WODs and movement standards (RX/Scaled)
- Energy system development (aerobic base, lactate threshold, phosphocreatine)

When recommending workouts:
1. Consider current fatigue levels — avoid overloading recently stressed muscle groups
2. Respect the current training phase (BASE=volume/GPP, STRENGTH=intensity/specificity, PEAK=PR attempts/competition prep, TAPER=reduce volume 40-60%)
3. Structure sessions as: Main Lift → Accessory Work (2-4 exercises, hypertrophy focus) → Optional MetCon
4. For MetCons: recommend 10-20 minute WODs unless specific energy system work is needed
5. Always include loading prescriptions (% 1RM or RPE), set/rep schemes, and rest periods
6. Flag when muscles are fatigued (score >50) and suggest alternatives

When responding with workout recommendations, use this JSON format:
{
  "mainLift": {
    "exercise": "Back Squat",
    "warmup": "...",
    "workSets": [{"sets": 5, "reps": 3, "intensity": "80% 1RM or RPE 8", "rest": "3-4 min"}],
    "notes": "..."
  },
  "accessory": [
    {"exercise": "Romanian Deadlift", "sets": 3, "reps": "10-12", "rest": "90s", "notes": "..."},
    ...
  ],
  "metcon": {
    "name": "...",
    "type": "AMRAP/FOR_TIME/EMOM",
    "duration": 12,
    "movements": [...],
    "targetScore": "...",
    "scaling": "..."
  },
  "rationale": "Brief explanation of choices based on fatigue/phase/goals"
}`
