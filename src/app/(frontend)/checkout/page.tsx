import type { Metadata } from 'next'

import { CheckoutClient } from '@/components/checkout/CheckoutClient'
import { getDictionary } from '@/lib/localization'
import { getProducts } from '@/services/products'
import { areShopSettingsComplete, getShopSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Checkout' }

export default async function CheckoutPage() {
  const [{ dictionary, locale }, products, settings] = await Promise.all([
    getDictionary(),
    getProducts(),
    getShopSettings(),
  ])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.checkout}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.checkoutDescription}</p>
      </header>
      <CheckoutClient
        defaultPriceIncludesVat={settings.defaultPriceIncludesVat ?? false}
        dictionary={dictionary}
        locale={locale}
        products={products}
        settingsReady={areShopSettingsComplete(settings)}
      />
    </div>
  )
}
