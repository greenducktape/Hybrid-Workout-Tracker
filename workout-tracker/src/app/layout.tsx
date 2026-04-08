import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'

export const metadata: Metadata = {
  title: 'HybridAthlete Tracker',
  description: 'Data-driven workout tracking for strength, hypertrophy, and CrossFit',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      style={{
        '--font-geist-sans': 'Inter, system-ui, -apple-system, Segoe UI, sans-serif',
        '--font-geist-mono': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      } as CSSProperties}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
            {children}
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  )
}
