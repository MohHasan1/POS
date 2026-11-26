import type { Metadata } from 'next'

import { MissingCostsClient } from '@/components/reports/MissingCostsClient'
import { getDictionary } from '@/lib/localization'
import { requirePosAccess } from '@/lib/require-pos-access'
import { getMissingCostLines } from '@/services/business-reporting'
import { getShopSettings, marketContextFromSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Missing costs' }

export default async function MissingCostsPage() {
  await requirePosAccess('/reports/costs')
  const [{ dictionary, locale }, lines, settings] = await Promise.all([
    getDictionary(),
    getMissingCostLines(),
    getShopSettings(),
  ])
  const market = marketContextFromSettings(settings).profile

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.missingCosts}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.missingCostsDescription}</p>
      </header>
      <MissingCostsClient dictionary={dictionary} lines={lines} locale={locale} market={market} />
    </div>
  )
}
