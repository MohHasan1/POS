import type { Metadata } from 'next'

import { ApplicationPreferences } from '@/components/settings/ApplicationPreferences'
import { InvoicingPreferences } from '@/components/settings/InvoicingPreferences'
import { OfflineTranslationSettings } from '@/components/settings/OfflineTranslationSettings'
import { getDictionary } from '@/lib/localization'
import { getShopSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const [{ dictionary, locale }, settings] = await Promise.all([getDictionary(), getShopSettings()])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.settings}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.settingsDescription}</p>
      </header>
      <ApplicationPreferences dictionary={dictionary} locale={locale} />
      <InvoicingPreferences
        defaultPriceIncludesVat={settings.defaultPriceIncludesVat ?? false}
        dictionary={dictionary}
      />
      <OfflineTranslationSettings dictionary={dictionary} />
    </div>
  )
}
