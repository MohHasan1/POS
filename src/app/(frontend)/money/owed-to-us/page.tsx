import type { Metadata } from 'next'

import { MoneyPageClient } from '@/components/money/MoneyPageClient'
import { todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import { getAvailableMoneyInvoices, getMoneyDashboard } from '@/services/money'

export const metadata: Metadata = { title: 'Money to Receive' }

export default async function OwedToUsPage({ searchParams }: { searchParams: Promise<{ invoice?: string; record?: string }> }) {
  const params = await searchParams
  const [{ dictionary, locale }, dashboard, invoices] = await Promise.all([
    getDictionary(),
    getMoneyDashboard('owedToUs'),
    getAvailableMoneyInvoices(),
  ])
  const initialInvoiceId = invoices.some(({ id }) => id === params.invoice) ? params.invoice : undefined
  return <div className="mx-auto max-w-7xl"><MoneyPageClient dashboard={dashboard} dictionary={dictionary} direction="owedToUs" initialInvoiceId={initialInvoiceId} initialSearch={params.record} invoices={invoices} locale={locale} products={[]} today={todayDateInput(dashboard.market)} /></div>
}
