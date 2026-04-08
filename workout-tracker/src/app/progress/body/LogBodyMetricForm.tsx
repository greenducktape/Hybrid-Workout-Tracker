'use client'

import { useState, useTransition } from 'react'
import { logBodyMetric } from '@/actions/workout'
import { Plus, Loader2 } from 'lucide-react'

export function LogBodyMetricForm() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    bodyWeightKg: '',
    heartRateResting: '',
    sleepHours: '',
    energyLevel: '',
    notes: '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await logBodyMetric({
        bodyWeightKg: form.bodyWeightKg ? parseFloat(form.bodyWeightKg) : undefined,
        heartRateResting: form.heartRateResting ? parseInt(form.heartRateResting) : undefined,
        sleepHours: form.sleepHours ? parseFloat(form.sleepHours) : undefined,
        energyLevel: form.energyLevel ? parseInt(form.energyLevel) : undefined,
        notes: form.notes || undefined,
      })
      setOpen(false)
      setForm({ bodyWeightKg: '', heartRateResting: '', sleepHours: '', energyLevel: '', notes: '' })
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] hover:border-blue-500/30 rounded-xl px-4 py-3 text-sm font-medium transition-colors w-full mb-4"
      >
        <Plus className="w-4 h-4 text-blue-400" />
        Log today's metrics
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4">
      <h3 className="font-semibold text-sm mb-3">Log Metrics</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Body Weight (kg)</label>
          <input
            type="number"
            step="0.1"
            value={form.bodyWeightKg}
            onChange={(e) => setForm((f) => ({ ...f, bodyWeightKg: e.target.value }))}
            className="w-full bg-[var(--muted)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="80.0"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Resting HR (bpm)</label>
          <input
            type="number"
            value={form.heartRateResting}
            onChange={(e) => setForm((f) => ({ ...f, heartRateResting: e.target.value }))}
            className="w-full bg-[var(--muted)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="60"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Sleep (hours)</label>
          <input
            type="number"
            step="0.5"
            value={form.sleepHours}
            onChange={(e) => setForm((f) => ({ ...f, sleepHours: e.target.value }))}
            className="w-full bg-[var(--muted)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="8"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Energy (1-10)</label>
          <input
            type="number"
            min="1"
            max="10"
            value={form.energyLevel}
            onChange={(e) => setForm((f) => ({ ...f, energyLevel: e.target.value }))}
            className="w-full bg-[var(--muted)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="7"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 py-2 text-sm text-[var(--muted-foreground)] border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save
        </button>
      </div>
    </form>
  )
}
