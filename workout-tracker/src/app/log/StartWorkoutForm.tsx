'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSession } from '@/actions/workout'
import { Dumbbell, Loader2 } from 'lucide-react'

export function StartWorkoutForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleStart() {
    startTransition(async () => {
      const session = await createSession({})
      router.push(`/log/${session.id}`)
    })
  }

  return (
    <div>
      <div className="text-xs text-[var(--muted-foreground)] font-medium uppercase tracking-wider px-1 mb-2">
        Custom
      </div>
      <button
        onClick={handleStart}
        disabled={isPending}
        className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-blue-500/40 hover:bg-[var(--muted)] transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Dumbbell className="w-4 h-4 text-[var(--muted-foreground)]" />}
        </div>
        <div>
          <p className="font-medium text-sm">Open Gym</p>
          <p className="text-xs text-[var(--muted-foreground)]">Blank session — add any exercises as you go</p>
        </div>
      </button>
    </div>
  )
}
