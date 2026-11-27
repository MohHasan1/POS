import type { Metadata } from 'next'

import { SuppliesClient } from '@/components/supplies/SuppliesClient'
import { todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import { requirePosAccess } from '@/lib/require-pos-access'
import type { SupplyPageParams } from '@/lib/supply-stock'
import { getMarketContext } from '@/services/settings'
import { getSupplyCatalog } from '@/services/supplies'

export const metadata: Metadata = { title: 'Supplies' }

export default async function SuppliesPage({ searchParams }: { searchParams: Promise<SupplyPageParams> }) {
  await requirePosAccess('/supplies', await searchParams)
  const [{ dictionary, locale }, market] = await Promise.all([getDictionary(), getMarketContext()])
  const today = todayDateInput(market.profile)
  const catalog = await getSupplyCatalog(today)

  return (
    <div className="mx-auto max-w-6xl">
      <SuppliesClient {...catalog} dictionary={dictionary} locale={locale} market={market.profile} today={today} />
    </div>
  )
}
