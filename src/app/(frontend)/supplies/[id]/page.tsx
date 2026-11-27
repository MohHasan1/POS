import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SupplyDetailClient } from '@/components/supplies/SupplyDetailClient'
import { todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import { requirePosAccess } from '@/lib/require-pos-access'
import { SUPPLY_HISTORY_PAGE_SIZE, paginateSupplies, supplyPageNumber, supplyParam, type SupplyPageParams } from '@/lib/supply-stock'
import { getSupplyUsageTrends } from '@/lib/supplies'
import { getMarketContext } from '@/services/settings'
import { getAvailableSupplyPurchases, getSupplyDetails, getSupplyPurchaseHistory } from '@/services/supplies'

export const metadata: Metadata = { title: 'Supplies' }

export default async function SupplyPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<SupplyPageParams>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  await requirePosAccess(`/supplies/${encodeURIComponent(id)}`, query)
  const [{ dictionary, locale }, market, details] = await Promise.all([
    getDictionary(),
    getMarketContext(),
    getSupplyDetails(id),
  ])
  if (!details) notFound()
  const today = todayDateInput(market.profile)
  const stockTab = supplyParam(query, 'tab') === 'stock'
  const includeOpened = supplyParam(query, 'purchases') === 'all'
  const page = supplyPageNumber(supplyParam(query, 'page'))
  const [availablePurchases, purchaseHistory] = await Promise.all([
    getAvailableSupplyPurchases(id),
    stockTab ? getSupplyPurchaseHistory(id, includeOpened, page) : null,
  ])
  const { usages, ...stats } = details

  return (
    <div className="mx-auto max-w-6xl">
      <SupplyDetailClient
        {...stats}
        active={stockTab ? [] : usages.filter((usage) => !usage.finishedOn)}
        availablePurchases={availablePurchases}
        dictionary={dictionary}
        finished={paginateSupplies(stockTab ? [] : usages.filter((usage) => usage.finishedOn), page, SUPPLY_HISTORY_PAGE_SIZE)}
        includeOpened={includeOpened}
        locale={locale}
        market={market.profile}
        purchaseHistory={purchaseHistory}
        today={today}
        trends={stockTab ? null : getSupplyUsageTrends(usages, today)}
      />
    </div>
  )
}
