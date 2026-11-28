import type { Metadata } from 'next'

import { CashSummaryClient } from '@/components/cash/CashSummaryClient'
import { ReportNavigation } from '@/components/reports/ReportNavigation'
import { todayDateInput } from '@/lib/calendar'
import { cashReportFilter, cashSummaryPath } from '@/lib/cash-summary-view'
import { getDictionary } from '@/lib/localization'
import { requirePosAccess } from '@/lib/require-pos-access'
import { getBusinessReport } from '@/services/business-reporting'
import { getCashClosingForReport } from '@/services/cash-closing'
import { getCashReport } from '@/services/cash-report'
import { getCashSaleReview } from '@/services/cash-sale-review'

export const metadata: Metadata = { title: 'Cash Summary' }

export default async function CashSummaryPage({ searchParams }: {
  searchParams: Promise<{ period?: string; start?: string; end?: string; page?: string }>
}) {
  const params = await searchParams
  await requirePosAccess(cashSummaryPath, params)
  const filter = cashReportFilter(params)
  const page = Number(params.page)
  const { dictionary, locale } = await getDictionary()
  const business = await getBusinessReport(filter, locale)
  const now = new Date(business.generatedAt)
  const [cash, review, closing] = await Promise.all([
    getCashReport(filter, business.market, Number.isSafeInteger(page) ? page : 1, now),
    getCashSaleReview(business.market),
    getCashClosingForReport(filter, business.market, now),
  ])
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.cashSummaryTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.cashSummaryDescription}</p>
      </header>
      <ReportNavigation active="cash" dictionary={dictionary} />
      <CashSummaryClient key={JSON.stringify(filter)} dictionary={dictionary} locale={locale}
        today={todayDateInput(business.market, now)} filter={filter} market={business.market} closing={closing}
        summary={business.summary} warnings={business.warnings} cash={cash} review={review} />
    </div>
  )
}
