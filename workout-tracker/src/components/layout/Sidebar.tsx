'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Dumbbell,
  TrendingUp,
  Brain,
  BookOpen,
  Calendar,
  Zap,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/log', label: 'Log Workout', icon: Dumbbell },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/coach', label: 'AI Coach', icon: Brain },
  { href: '/exercises', label: 'Exercises', icon: BookOpen },
  { href: '/program', label: 'Program', icon: Calendar },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-[var(--card)] border-r border-[var(--border)] py-6 px-3 gap-1">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 mb-6">
        <Zap className="w-6 h-6 text-blue-400" fill="currentColor" />
        <span className="font-bold text-lg tracking-tight">HybridAthlete</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
              )}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer nav */}
      <div className="border-t border-[var(--border)] pt-3 mt-3">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            pathname.startsWith('/settings')
              ? 'bg-blue-500/15 text-blue-400'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
          )}
        >
          <Settings className="w-4.5 h-4.5 shrink-0" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
