import type { Metadata } from 'next'

import { SuppliesClient } from '@/components/supplies/SuppliesClient'
import { todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import { requirePosAccess } from '@/lib/require-pos-access'
import { getMarketContext } from '@/services/settings'
import { getSupplyCatalog } from '@/services/supplies'

export const metadata: Metadata = { title: 'Supplies' }

export default async function SuppliesPage() {
  await requirePosAccess('/supplies')
  const [{ dictionary, locale }, market] = await Promise.all([getDictionary(), getMarketContext()])
  const catalog = await getSupplyCatalog(todayDateInput(market.profile))

  return (
    <div className="mx-auto max-w-6xl">
      <SuppliesClient {...catalog} dictionary={dictionary} locale={locale} market={market.profile} />
    </div>
  )
}
