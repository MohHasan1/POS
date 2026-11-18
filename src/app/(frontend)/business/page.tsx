import type { Metadata } from 'next'

import { BusinessInformationForm } from '@/components/business/BusinessInformationForm'
import { getDictionary } from '@/lib/localization'
import { getShopSettings, isCountryLocked } from '@/services/settings'

export const metadata: Metadata = { title: 'Business Information' }

export default async function BusinessPage() {
  const [{ dictionary }, settings, countryLocked] = await Promise.all([
    getDictionary(),
    getShopSettings(),
    isCountryLocked(),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.businessInformation}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.businessDescription}</p>
      </header>
      <BusinessInformationForm dictionary={dictionary} settings={settings} countryLocked={countryLocked} />
    </div>
  )
}
