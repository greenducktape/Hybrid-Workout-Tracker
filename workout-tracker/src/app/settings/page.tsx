import { getSetting } from '@/actions/hevy'
import { HevyIntegration } from './HevyIntegration'

export default async function SettingsPage() {
  const [apiKey, username, lastSync] = await Promise.all([
    getSetting('hevy_api_key'),
    getSetting('hevy_username'),
    getSetting('hevy_last_sync'),
  ])

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-0.5">Manage integrations and preferences</p>
      </div>

      <HevyIntegration
        hasApiKey={!!apiKey}
        username={username}
        lastSync={lastSync}
      />
    </div>
  )
}
