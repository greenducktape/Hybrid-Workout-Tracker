import { getSbsOverview } from '@/actions/sbs'
import { getWodRecommendations } from '@/actions/wod'
import { StartWorkoutForm } from './StartWorkoutForm'
import { SbsNextSessionCard } from './SbsNextSessionCard'
import { WodSection } from './WodSection'

export default async function LogPage() {
  const [sbsOverview, wodOptions] = await Promise.all([
    getSbsOverview(),
    getWodRecommendations(),
  ])

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Start Workout</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">Follow your program or start custom</p>
      </div>

      {/* SBS Recommendation */}
      <SbsNextSessionCard overview={sbsOverview} />

      {/* WOD of the Day */}
      <WodSection wods={wodOptions} />

      {/* Open gym / custom */}
      <StartWorkoutForm />
    </div>
  )
}
