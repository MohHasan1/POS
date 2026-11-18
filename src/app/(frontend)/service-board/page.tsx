import type { Metadata } from 'next'

import { ServiceBoardClient } from '@/components/service-board/ServiceBoardClient'
import { getDictionary } from '@/lib/localization'
import { getProducts } from '@/services/products'
import { getServiceBoardView } from '@/services/service-board'
import { areShopSettingsComplete, getShopSettings, marketContextFromSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Service Board' }

export default async function ServiceBoardPage() {
  const [{ dictionary, locale }, products, settings, view] = await Promise.all([
    getDictionary(),
    getProducts(),
    getShopSettings(),
    getServiceBoardView(),
  ])
  const market = marketContextFromSettings(settings)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.serviceBoard}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.serviceBoardDescription}</p>
      </header>
      <ServiceBoardClient
        allProducts={products}
        autoTranslateProducts={market.autoTranslateProducts}
        defaultPriceIncludesVat={settings.defaultPriceIncludesVat ?? false}
        dictionary={dictionary}
        locale={locale}
        settingsReady={areShopSettingsComplete(settings)}
        view={view}
      />
    </div>
  )
}
