import type { Metadata } from 'next'

import { ApplicationPreferences } from '@/components/settings/ApplicationPreferences'
import { InvoicingPreferences } from '@/components/settings/InvoicingPreferences'
import { OfflineTranslationSettings } from '@/components/settings/OfflineTranslationSettings'
import { MarketProfileSummary } from '@/components/settings/MarketProfileSummary'
import { ProductLanguagePreferences } from '@/components/settings/ProductLanguagePreferences'
import { getDictionary } from '@/lib/localization'
import { getShopSettings, isCountryLocked, marketContextFromSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const [{ dictionary, locale }, settings, locked] = await Promise.all([
    getDictionary(),
    getShopSettings(),
    isCountryLocked(),
  ])
  const market = marketContextFromSettings(settings)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.settings}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.settingsDescription}</p>
      </header>
      <ApplicationPreferences dictionary={dictionary} locale={locale} />
      <MarketProfileSummary dictionary={dictionary} locked={locked} profile={market.profile} />
      <ProductLanguagePreferences
        autoTranslateProducts={market.autoTranslateProducts}
        dictionary={dictionary}
        secondaryLanguage={market.secondaryLanguage}
      />
      {market.profile.taxMode === 'saudiVat' && (
        <InvoicingPreferences
          defaultPriceIncludesVat={settings.defaultPriceIncludesVat ?? false}
          dictionary={dictionary}
        />
      )}
      {market.autoTranslateProducts && (
        <OfflineTranslationSettings dictionary={dictionary} targetLanguage={market.secondaryLanguage} />
      )}
    </div>
  )
}
