'use client'

import { useState } from 'react'
import { addCompetition } from './actions'
import { daysUntil, getTrainingPhase } from '@/lib/utils'
import { Trophy, Plus, Calendar, Target } from 'lucide-react'

interface Competition {
  id: string
  name: string
  date: string
  type: string
  goals: string | null
  notes: string | null
}

const phaseColors: Record<string, string> = {
  BASE: 'bg-green-500/15 text-green-400',
  STRENGTH: 'bg-blue-500/15 text-blue-400',
  PEAK: 'bg-orange-500/15 text-orange-400',
  TAPER: 'bg-yellow-500/15 text-yellow-400',
  OFFSEASON: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
}

export function CompetitionManager({ competitions }: { competitions: Competition[] }) {
  const [showForm, setShowForm] = useState(false)

  const upcoming = competitions.filter((c) => new Date(c.date) >= new Date())
  const past = competitions.filter((c) => new Date(c.date) < new Date())

  return (
    <div className="space-y-4">
      {/* Add button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 w-full bg-[var(--card)] border border-dashed border-[var(--border)] hover:border-blue-500/50 rounded-xl p-4 text-sm font-medium text-[var(--muted-foreground)] hover:text-blue-400 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Competition
      </button>

      {/* Add form */}
      {showForm && (
        <form
          action={addCompetition}
          className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3"
        >
          <h3 className="font-semibold text-sm">New Competition</h3>
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Competition Name*</label>
            <input
              name="name"
              required
              placeholder="CrossFit Open 2026"
              className="w-full bg-[var(--muted)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Date*</label>
              <input
                name="date"
                type="date"
                required
                className="w-full bg-[var(--muted)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Type</label>
              <select
                name="type"
                className="w-full bg-[var(--muted)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="CrossFit Open">CrossFit Open</option>
                <option value="Local Throwdown">Local Throwdown</option>
                <option value="Sanctional">Sanctional</option>
                <option value="Powerlifting Meet">Powerlifting Meet</option>
                <option value="Weightlifting Meet">Weightlifting Meet</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Goals (optional)</label>
            <textarea
              name="goals"
              rows={2}
              placeholder="e.g. Top 10% in region, 225kg total..."
              className="w-full bg-[var(--muted)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {/* Upcoming competitions */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-xs text-[var(--muted-foreground)] font-medium uppercase tracking-wider mb-2">Upcoming</h2>
          <div className="space-y-2">
            {upcoming.map((comp) => {
              const days = daysUntil(new Date(comp.date))
              const phase = getTrainingPhase(new Date(comp.date))
              return (
                <div key={comp.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-400 shrink-0" />
                      <div>
                        <p className="font-semibold">{comp.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{comp.type}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-black text-orange-400">{days}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">days out</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${phaseColors[phase]}`}>
                      {phase} phase
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {new Date(comp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  {comp.goals && (
                    <div className="mt-2 pt-2 border-t border-[var(--border)]">
                      <p className="text-xs text-[var(--muted-foreground)]">
                        <Target className="w-3 h-3 inline mr-1" />
                        {comp.goals}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Past competitions */}
      {past.length > 0 && (
        <div>
          <h2 className="text-xs text-[var(--muted-foreground)] font-medium uppercase tracking-wider mb-2">Past</h2>
          <div className="space-y-2">
            {past.slice(0, 5).map((comp) => (
              <div key={comp.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{comp.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{comp.type}</p>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {new Date(comp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {competitions.length === 0 && !showForm && (
        <div className="text-center py-8">
          <Trophy className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--muted-foreground)]">No competitions set yet</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Add a competition to auto-calculate your training phase
          </p>
        </div>
      )}
    </div>
  )
}
