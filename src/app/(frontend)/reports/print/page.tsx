import type { Metadata } from 'next'
import Link from 'next/link'

import { PrintButton } from '@/components/invoices/PrintButton'
import { ProfessionalReportDocument } from '@/components/reports/ProfessionalReportDocument'
import { buttonVariants } from '@/components/ui/button'
import type { BusinessReportFilter, BusinessReportPeriod } from '@/lib/business-report-types'
import { formatMarketDate } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import { marketLocale } from '@/lib/market'
import { getBusinessReport } from '@/services/business-reporting'
import { getEmployees } from '@/services/employees'

export const metadata: Metadata = { title: 'Report PDF' }

const periods: BusinessReportPeriod[] = [
  'today',
  'yesterday',
  'month',
  'previousMonth',
  'year',
  'previousYear',
  'all',
  'custom',
]

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; end?: string; period?: string; start?: string }>
}) {
  const [{ dictionary, locale }, employees, params] = await Promise.all([
    getDictionary(),
    getEmployees(true),
    searchParams,
  ])
  const period = periods.includes(params.period as BusinessReportPeriod)
    ? (params.period as BusinessReportPeriod)
    : 'month'
  const filter: BusinessReportFilter = {
    employeeId: employees.some(({ id }) => id === params.employee) ? params.employee : undefined,
    endDate: params.end,
    period,
    startDate: params.start,
  }
  const report = await getBusinessReport(filter, locale, true)
  const displayLocale = marketLocale(report.market, locale)
  const periodLabels: Record<BusinessReportPeriod, string> = {
    all: dictionary.allTime,
    custom: dictionary.customRange,
    month: dictionary.thisMonth,
    previousMonth: dictionary.previousMonth,
    previousYear: dictionary.previousYear,
    today: dictionary.today,
    year: dictionary.thisYear,
    yesterday: dictionary.yesterday,
  }
  const rangeStart = report.range.start
    ? formatMarketDate(report.range.start, report.market, displayLocale)
    : undefined
  const rangeEnd = report.range.end
    ? formatMarketDate(
        new Date(new Date(report.range.end).getTime() - 1),
        report.market,
        displayLocale,
      )
    : undefined
  const rangeLabel = rangeStart
    ? rangeStart === rangeEnd || !rangeEnd
      ? rangeStart
      : `${rangeStart} – ${rangeEnd}`
    : dictionary.allTime
  const employeeName = filter.employeeId
    ? employees.find(({ id }) => id === filter.employeeId)?.name
    : undefined
  const documentTitle = `${report.businessName} - ${periodLabels[period]} - ${dictionary.reports}`
  const backParams = new URLSearchParams({ period })
  if (filter.employeeId) backParams.set('employee', filter.employeeId)
  if (period === 'custom' && filter.startDate) backParams.set('start', filter.startDate)
  if (period === 'custom' && filter.endDate) backParams.set('end', filter.endDate)

  return (
    <div className="report-print mx-auto max-w-[297mm] space-y-4">
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Link className={buttonVariants({ variant: 'outline' })} href={`/reports?${backParams}`}>
          {dictionary.backToReports}
        </Link>
        <PrintButton documentTitle={documentTitle} label={dictionary.exportPDF} />
      </div>
      <ProfessionalReportDocument
        dictionary={dictionary}
        employeeName={employeeName}
        locale={locale}
        periodLabel={periodLabels[period]}
        rangeLabel={rangeLabel}
        report={report}
      />
    </div>
  )
}
