import type { Metadata } from 'next'

import { CheckoutClient } from '@/components/checkout/CheckoutClient'
import { getDictionary } from '@/lib/localization'
import { employeeRelationshipId, getEmployees } from '@/services/employees'
import { getProducts } from '@/services/products'
import { getMoneyPeople } from '@/services/money'
import { areShopSettingsComplete, getShopSettings, marketContextFromSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Checkout' }

export default async function CheckoutPage() {
  const [{ dictionary, locale }, employees, people, products, settings] = await Promise.all([
    getDictionary(),
    getEmployees(),
    getMoneyPeople(false),
    getProducts(),
    getShopSettings(),
  ])
  const market = marketContextFromSettings(settings)
  const configuredDefaultEmployeeId = employeeRelationshipId(settings.defaultEmployee)
  const defaultEmployeeId = employees.some(({ id }) => id === configuredDefaultEmployeeId)
    ? configuredDefaultEmployeeId
    : undefined

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.checkout}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.checkoutDescription}</p>
      </header>
      <CheckoutClient
        autoTranslateProducts={market.autoTranslateProducts}
        defaultEmployeeId={defaultEmployeeId}
        defaultPriceIncludesVat={settings.defaultPriceIncludesVat ?? false}
        dictionary={dictionary}
        employees={employees}
        locale={locale}
        market={market.profile}
        people={people}
        products={products}
        secondaryLanguage={market.secondaryLanguage}
        settingsReady={areShopSettingsComplete(settings)}
      />
    </div>
  )
}
