import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CheckoutClient } from '@/components/checkout/CheckoutClient'
import { todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import { marketSupports } from '@/lib/market'
import { employeeRelationshipId, getEmployees } from '@/services/employees'
import { getProducts } from '@/services/products'
import { areShopSettingsComplete, getShopSettings, marketContextFromSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Record Past Sale' }

export default async function HistoricalSalesPage() {
  const [{ dictionary, locale }, employees, products, settings] = await Promise.all([
    getDictionary(),
    getEmployees(),
    getProducts(),
    getShopSettings(),
  ])
  const market = marketContextFromSettings(settings)
  if (!marketSupports(market.profile, 'historicalSales')) notFound()
  const configuredDefaultEmployeeId = employeeRelationshipId(settings.defaultEmployee)
  const defaultEmployeeId = employees.some(({ id }) => id === configuredDefaultEmployeeId)
    ? configuredDefaultEmployeeId
    : undefined

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.recordPastSale}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dictionary.historicalSalesDescription}
        </p>
      </header>
      <CheckoutClient
        autoTranslateProducts={market.autoTranslateProducts}
        defaultEmployeeId={defaultEmployeeId}
        defaultPriceIncludesVat={settings.defaultPriceIncludesVat ?? false}
        defaultSaleDate={todayDateInput(market.profile)}
        dictionary={dictionary}
        employees={employees}
        locale={locale}
        market={market.profile}
        products={products}
        saleMode="historical"
        secondaryLanguage={market.secondaryLanguage}
        settingsReady={areShopSettingsComplete(settings)}
      />
    </div>
  )
}
