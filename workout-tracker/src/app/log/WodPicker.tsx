'use client'

import { useState } from 'react'
import type { Wod } from '@/lib/wod-library'
import { Timer, Zap, Dumbbell, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  CONDITIONING: { label: 'Conditioning', color: 'text-green-400 bg-green-500/10' },
  STRENGTH_METCON: { label: 'Strength MetCon', color: 'text-orange-400 bg-orange-500/10' },
  GYMNASTICS: { label: 'Gymnastics', color: 'text-purple-400 bg-purple-500/10' },
  CLASSIC: { label: 'Benchmark', color: 'text-blue-400 bg-blue-500/10' },
}

const TYPE_LABELS: Record<string, string> = {
  AMRAP: 'AMRAP',
  FOR_TIME: 'For Time',
  EMOM: 'EMOM',
  TABATA: 'Tabata',
  CHIPPER: 'Chipper',
}

function IntensityDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            i <= level ? 'bg-orange-400' : 'bg-[var(--muted)]'
          )}
        />
      ))}
    </div>
  )
}

interface Props {
  wods: Wod[]
  /** Called when user confirms a WOD selection */
  onSelect: (wod: Wod) => void
}

export function WodPicker({ wods, onSelect }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  function handleSelect(wod: Wod) {
    setSelected(wod.id)
    onSelect(wod)
  }

  return (
    <div className="space-y-2">
      {wods.map((wod) => {
        const style = CATEGORY_STYLES[wod.category]
        const isExpanded = expanded === wod.id
        const isSelected = selected === wod.id

        return (
          <div
            key={wod.id}
            className={cn(
              'bg-[var(--card)] border rounded-xl overflow-hidden transition-colors',
              isSelected ? 'border-blue-500/40' : 'border-[var(--border)]'
            )}
          >
            {/* Header row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              onClick={() => setExpanded(isExpanded ? null : wod.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{wod.name}</span>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', style.color)}>
                    {style.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    {TYPE_LABELS[wod.type]} · {wod.timeCap} min
                  </span>
                  <IntensityDots level={wod.intensity} />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
                )}
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
                <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap font-sans leading-relaxed">
                  {wod.description}
                </pre>
                <button
                  onClick={() => handleSelect(wod)}
                  className={cn(
                    'w-full py-2 rounded-lg text-sm font-semibold transition-colors',
                    isSelected
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  )}
                >
                  {isSelected ? '✓ Selected' : 'Do This WOD'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
