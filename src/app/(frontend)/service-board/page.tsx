import type { Metadata } from 'next'

import { ServiceBoardClient } from '@/components/service-board/ServiceBoardClient'
import { getDictionary } from '@/lib/localization'
import { employeeRelationshipId, getEmployees } from '@/services/employees'
import { getProducts } from '@/services/products'
import { getServiceBoardView } from '@/services/service-board'
import { areShopSettingsComplete, getShopSettings, marketContextFromSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Service Board' }

export default async function ServiceBoardPage() {
  const [{ dictionary, locale }, employees, products, settings, view] = await Promise.all([
    getDictionary(),
    getEmployees(),
    getProducts(),
    getShopSettings(),
    getServiceBoardView(),
  ])
  const market = marketContextFromSettings(settings)
  const configuredDefaultEmployeeId = employeeRelationshipId(settings.defaultEmployee)
  const defaultEmployeeId = employees.some(({ id }) => id === configuredDefaultEmployeeId)
    ? configuredDefaultEmployeeId
    : undefined

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.serviceBoard}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.serviceBoardDescription}</p>
      </header>
      <ServiceBoardClient
        allProducts={products}
        autoTranslateProducts={market.autoTranslateProducts}
        defaultEmployeeId={defaultEmployeeId}
        defaultPriceIncludesVat={settings.defaultPriceIncludesVat ?? false}
        dictionary={dictionary}
        employees={employees}
        locale={locale}
        settingsReady={areShopSettingsComplete(settings)}
        view={view}
      />
    </div>
  )
}
