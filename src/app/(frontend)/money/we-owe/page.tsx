import type { Metadata } from 'next'

import { MoneyPageClient } from '@/components/money/MoneyPageClient'
import { todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import { getMoneyDashboard } from '@/services/money'
import { getProducts } from '@/services/products'

export const metadata: Metadata = { title: 'Money to Pay' }

export default async function WeOwePage() {
  const [{ dictionary, locale }, dashboard, products] = await Promise.all([
    getDictionary(),
    getMoneyDashboard('weOwe'),
    getProducts(true),
  ])
  return <div className="mx-auto max-w-7xl"><MoneyPageClient dashboard={dashboard} dictionary={dictionary} direction="weOwe" invoices={[]} locale={locale} products={products} today={todayDateInput(dashboard.market)} /></div>
}
