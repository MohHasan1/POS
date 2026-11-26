import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SupplyDetailClient } from '@/components/supplies/SupplyDetailClient'
import { todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import { requirePosAccess } from '@/lib/require-pos-access'
import { getMarketContext } from '@/services/settings'
import { getSupplyDetails } from '@/services/supplies'

export const metadata: Metadata = { title: 'Supplies' }

export default async function SupplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requirePosAccess(`/supplies/${encodeURIComponent(id)}`)
  const [{ dictionary, locale }, market, details] = await Promise.all([
    getDictionary(),
    getMarketContext(),
    getSupplyDetails(id),
  ])
  if (!details) notFound()

  return (
    <div className="mx-auto max-w-6xl">
      <SupplyDetailClient {...details} dictionary={dictionary} locale={locale} market={market.profile} today={todayDateInput(market.profile)} />
    </div>
  )
}
