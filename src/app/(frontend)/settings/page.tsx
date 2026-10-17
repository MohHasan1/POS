import type { Metadata } from 'next'

import { SettingsForm } from '@/components/settings/SettingsForm'
import { getDictionary } from '@/lib/localization'
import { getShopSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const [{ dictionary }, settings] = await Promise.all([getDictionary(), getShopSettings()])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.settings}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.settingsDescription}</p>
      </header>
      <SettingsForm dictionary={dictionary} settings={settings} />
    </div>
  )
}
