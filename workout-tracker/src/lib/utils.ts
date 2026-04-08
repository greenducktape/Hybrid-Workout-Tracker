import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatWeight(kg: number, unit: 'kg' | 'lbs' = 'kg'): string {
  if (unit === 'lbs') return `${Math.round(kg * 2.20462)}lbs`
  return `${kg}kg`
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function daysUntil(date: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function weeksUntil(date: Date): number {
  return Math.ceil(daysUntil(date) / 7)
}

export function getTrainingPhase(competitionDate: Date | null): string {
  if (!competitionDate) return 'BASE'
  const weeks = weeksUntil(competitionDate)
  if (weeks > 16) return 'BASE'
  if (weeks > 8) return 'STRENGTH'
  if (weeks > 4) return 'PEAK'
  if (weeks > 0) return 'TAPER'
  return 'OFFSEASON'
}
