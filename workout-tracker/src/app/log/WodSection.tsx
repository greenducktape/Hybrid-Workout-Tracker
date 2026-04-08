'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WodPicker } from './WodPicker'
import { createSession, createBlock, saveMetConResult } from '@/actions/workout'
import type { Wod } from '@/lib/wod-library'
import { Zap, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

interface Props {
  wods: Wod[]
}

export function WodSection({ wods }: Props) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [startingWod, setStartingWod] = useState<string | null>(null)

  function handleWodSelect(wod: Wod) {
    setStartingWod(wod.id)
    startTransition(async () => {
      // Create a session named after the WOD
      const session = await createSession({ template: wod.name })

      // Pre-create a MetCon block
      const block = await createBlock({
        sessionId: session.id,
        order: 0,
        blockType: 'METCON',
      })

      // Save MetCon result stub so the logger knows what WOD this is
      await saveMetConResult({
        blockId: block.id,
        wodName: wod.name,
        wodType: wod.type,
        timeCap: wod.timeCap * 60, // seconds
        isRx: true,
      })

      router.push(`/log/${session.id}`)
    })
  }

  return (
    <div className="mb-4">
      {/* Section header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between mb-2 group"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-400" />
          <span className="font-semibold text-sm">Today's WOD Options</span>
          <span className="text-xs text-[var(--muted-foreground)]">· pick one</span>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
          : <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
        }
      </button>

      {!collapsed && (
        <div className="relative">
          {isPending && (
            <div className="absolute inset-0 bg-[var(--background)]/60 z-10 flex items-center justify-center rounded-xl">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            </div>
          )}
          <WodPicker wods={wods} onSelect={handleWodSelect} />
        </div>
      )}
    </div>
  )
}
