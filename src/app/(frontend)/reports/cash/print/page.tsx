import type { Metadata } from 'next'
import Link from 'next/link'

import { CashSummaryDocument } from '@/components/cash/CashSummaryDocument'
import { PrintButton } from '@/components/invoices/PrintButton'
import { buttonVariants } from '@/components/ui/button'
import { cashReportFilter, cashReportParams, cashReportPeriodLabels, cashSummaryPath } from '@/lib/cash-summary-view'
import { getDictionary } from '@/lib/localization'
import { requirePosAccess } from '@/lib/require-pos-access'
import { getBusinessReport } from '@/services/business-reporting'
import { getCashClosingForReport } from '@/services/cash-closing'
import { getCashReport } from '@/services/cash-report'

export const metadata: Metadata = { title: 'Cash Summary PDF' }

export default async function CashSummaryPrintPage({ searchParams }: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>
}) {
  const params = await searchParams
  await requirePosAccess(`${cashSummaryPath}/print`, params)
  const filter = cashReportFilter(params)
  const { dictionary, locale } = await getDictionary()
  const report = await getBusinessReport(filter, locale)
  const now = new Date(report.generatedAt)
  const [cash, closing] = await Promise.all([
    getCashReport(filter, report.market, 'all', now),
    getCashClosingForReport(filter, report.market, now),
  ])
  const periodLabel = cashReportPeriodLabels(dictionary)[filter.period]
  const documentTitle = `${report.businessName} - ${periodLabel} - ${dictionary.cashSummaryTitle}`

  return (
    <div className="report-print mx-auto max-w-[297mm] space-y-4">
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Link className={buttonVariants({ variant: 'outline' })} href={`${cashSummaryPath}?${cashReportParams(filter)}`}>
          {dictionary.cashSummaryTitle}
        </Link>
        <PrintButton documentTitle={documentTitle} label={dictionary.exportPDF} />
      </div>
      <CashSummaryDocument cash={cash} closing={closing?.closing ?? null} dictionary={dictionary} locale={locale} report={report} />
    </div>
  )
}
