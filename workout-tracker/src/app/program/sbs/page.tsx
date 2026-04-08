import { getSbsOverview } from '@/actions/sbs'
import { ProgramView } from './ProgramView'
import { Zap } from 'lucide-react'

export default async function SbsProgramPage() {
  const overview = await getSbsOverview()

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto w-full">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-blue-400" fill="currentColor" />
          <h1 className="text-2xl font-bold tracking-tight">Beat the Logbook</h1>
        </div>
        <p className="text-[var(--muted-foreground)] text-sm">
          Deterministic progression — each session has an exact target. Beat your last set to increase weight automatically.
        </p>
      </div>

      {!overview.hasAnyTMs ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 text-center">
          <Zap className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-3" />
          <p className="font-semibold mb-1">No training data yet</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            Sync your Hevy workouts in Settings — your training maxes will be detected automatically from your workout history.
          </p>
        </div>
      ) : (
        <ProgramView overview={overview} />
      )}
    </div>
  )
}
