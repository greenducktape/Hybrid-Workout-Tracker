'use client'

import { useState, useTransition } from 'react'
import { saveHevyApiKey, removeHevyApiKey, syncHevyWorkouts, type SyncResult } from '@/actions/hevy'
import { RefreshCw, Link2, Link2Off, CheckCircle2, XCircle, Loader2, Download } from 'lucide-react'

interface Props {
  hasApiKey: boolean
  username: string | null
  lastSync: string | null
}

export function HevyIntegration({ hasApiKey: initialHasKey, username: initialUsername, lastSync }: Props) {
  const [hasApiKey, setHasApiKey] = useState(initialHasKey)
  const [username, setUsername] = useState(initialUsername)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<'save' | 'remove' | 'sync' | null>(null)

  function handleSaveKey() {
    if (!apiKeyInput.trim()) return
    setError(null)
    setAction('save')
    startTransition(async () => {
      const result = await saveHevyApiKey(apiKeyInput.trim())
      if (result.success) {
        setHasApiKey(true)
        setUsername(result.username ?? null)
        setApiKeyInput('')
      } else {
        setError(result.error ?? 'Failed to connect')
      }
      setAction(null)
    })
  }

  function handleRemoveKey() {
    setAction('remove')
    startTransition(async () => {
      await removeHevyApiKey()
      setHasApiKey(false)
      setUsername(null)
      setSyncResult(null)
      setAction(null)
    })
  }

  function handleSync() {
    setError(null)
    setSyncResult(null)
    setAction('sync')
    startTransition(async () => {
      const result = await syncHevyWorkouts()
      setSyncResult(result)
      if (!result.success) setError(result.error ?? 'Sync failed')
      setAction(null)
    })
  }

  return (
    <div className="space-y-3">
      {/* Header card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-1">
          {/* Hevy logo-ish icon */}
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-400 font-black text-sm shrink-0">
            H
          </div>
          <div>
            <h2 className="font-semibold">Hevy</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Import your Hevy workout history into the AI coach context
            </p>
          </div>
          {hasApiKey && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected{username ? ` · ${username}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* API key form */}
      {!hasApiKey ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-sm">Connect your Hevy account</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Get your API key at{' '}
            <span className="text-blue-400">hevy.com/settings?developer</span>
            {' '}(requires Hevy Pro).
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="flex-1 bg-[var(--muted)] rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-[var(--muted-foreground)] placeholder:font-sans"
            />
            <button
              onClick={handleSaveKey}
              disabled={isPending || !apiKeyInput.trim()}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {action === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Connect
            </button>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-4">
          {/* Sync section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium">Sync Workouts</p>
                {lastSync && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Last synced{' '}
                    {new Date(lastSync).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
                {!lastSync && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Never synced — first sync will import all history
                  </p>
                )}
              </div>
              <button
                onClick={handleSync}
                disabled={isPending}
                className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {action === 'sync' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {action === 'sync' ? 'Syncing...' : lastSync ? 'Sync Now' : 'Import All'}
              </button>
            </div>

            {/* Sync result */}
            {syncResult && (
              <div className={`rounded-lg p-3 text-sm ${
                syncResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
              }`}>
                {syncResult.success ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-green-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Sync complete
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="bg-[var(--card)] rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-green-400">{syncResult.imported}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">Imported</p>
                      </div>
                      <div className="bg-[var(--card)] rounded-lg p-2 text-center">
                        <p className="text-lg font-bold">{syncResult.skipped}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">Already had</p>
                      </div>
                      <div className="bg-[var(--card)] rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-blue-400">{syncResult.totalInHevy}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">Total in Hevy</p>
                      </div>
                    </div>
                    {syncResult.imported > 0 && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-2">
                        Dashboard, progress charts, and AI coach context updated.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {syncResult.error}
                  </div>
                )}
              </div>
            )}

            {error && !syncResult && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg mt-2">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* What gets imported */}
          <div className="pt-3 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--muted-foreground)] font-medium mb-2">What gets imported</p>
            <ul className="text-xs text-[var(--muted-foreground)] space-y-1">
              {[
                'All workout sessions (title, date, duration)',
                'Every set — weights, reps, RPE',
                'Exercise templates → mapped to your exercise library',
                'PR detection runs automatically on all imported sets',
                'Imported workouts appear in history, progress charts, and AI coach context',
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <Download className="w-3 h-3 mt-0.5 shrink-0 text-blue-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Disconnect */}
          <div className="pt-3 border-t border-[var(--border)]">
            <button
              onClick={handleRemoveKey}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-red-400 transition-colors disabled:opacity-40"
            >
              {action === 'remove' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
              Disconnect Hevy account
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
