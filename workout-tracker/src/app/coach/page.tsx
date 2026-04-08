import { CoachClient } from './CoachClient'

export default function CoachPage() {
  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto w-full h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">AI Coach</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">
          Get personalized workout recommendations and coaching advice
        </p>
      </div>
      <CoachClient />
    </div>
  )
}
