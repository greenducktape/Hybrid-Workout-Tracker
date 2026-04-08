'use client'

import { useState } from 'react'
import { Search, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExerciseItem {
  id: string
  name: string
  type: string
  category: string
  movementPattern: string
  primaryMuscles: string[]
  equipment: string[]
  isCustom: boolean
  pr1RM: number | null
  setCount: number
}

const CATEGORIES = ['All', 'COMPOUND', 'ACCESSORY', 'OLYMPIC', 'GYMNASTIC', 'CARDIO', 'METCON']
const MOVEMENTS = ['All', 'SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'VERTICAL_PUSH', 'HORIZONTAL_PULL', 'VERTICAL_PULL', 'OLYMPIC', 'LOCOMOTION']

const MOVEMENT_LABELS: Record<string, string> = {
  HORIZONTAL_PUSH: 'H-Push',
  VERTICAL_PUSH: 'V-Push',
  HORIZONTAL_PULL: 'H-Pull',
  VERTICAL_PULL: 'V-Pull',
  LOCOMOTION: 'Cardio',
}

const CATEGORY_COLORS: Record<string, string> = {
  COMPOUND: 'text-blue-400 bg-blue-500/10',
  ACCESSORY: 'text-green-400 bg-green-500/10',
  OLYMPIC: 'text-purple-400 bg-purple-500/10',
  GYMNASTIC: 'text-pink-400 bg-pink-500/10',
  CARDIO: 'text-orange-400 bg-orange-500/10',
  METCON: 'text-yellow-400 bg-yellow-500/10',
}

export function ExerciseLibrary({ exercises }: { exercises: ExerciseItem[] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [movement, setMovement] = useState('All')

  const filtered = exercises.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.primaryMuscles.some((m) => m.toLowerCase().includes(search.toLowerCase()))
    const matchCat = category === 'All' || e.category === category
    const matchMov = movement === 'All' || e.movementPattern === movement
    return matchSearch && matchCat && matchMov
  })

  return (
    <div>
      {/* Search */}
      <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-2.5 mb-3">
        <Search className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises or muscles..."
          className="bg-transparent flex-1 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
              category === cat
                ? 'bg-blue-500 text-white'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Movement filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {MOVEMENTS.map((mov) => (
          <button
            key={mov}
            onClick={() => setMovement(mov)}
            className={cn(
              'shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
              movement === mov
                ? 'bg-[var(--foreground)] text-[var(--background)]'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            )}
          >
            {MOVEMENT_LABELS[mov] ?? mov}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-[var(--muted-foreground)] mb-3">
        {filtered.length} exercises{search ? ` for "${search}"` : ''}
      </p>

      {/* List */}
      <div className="grid gap-2">
        {filtered.map((ex) => (
          <div
            key={ex.id}
            className="flex items-center justify-between p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl"
          >
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{ex.name}</p>
                  {ex.isCustom && (
                    <span className="text-[10px] bg-[var(--muted)] text-[var(--muted-foreground)] px-1.5 py-0.5 rounded">custom</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', CATEGORY_COLORS[ex.category] ?? '')}>
                    {ex.category}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {ex.primaryMuscles.slice(0, 2).join(', ')}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              {ex.pr1RM && (
                <p className="text-sm font-bold text-blue-400">{ex.pr1RM}kg</p>
              )}
              {ex.setCount > 0 && (
                <p className="text-[10px] text-[var(--muted-foreground)]">{ex.setCount} sets logged</p>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[var(--muted-foreground)] text-sm">No exercises found</p>
          </div>
        )}
      </div>
    </div>
  )
}
