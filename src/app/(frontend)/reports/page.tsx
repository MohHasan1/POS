import type { Metadata } from 'next'

import { ReportsClient } from '@/components/reports/ReportsClient'
import { getDictionary } from '@/lib/localization'
import type { BusinessReportFilter, BusinessReportPeriod } from '@/lib/business-report-types'
import { getBusinessReport } from '@/services/business-reporting'
import { getEmployees } from '@/services/employees'

export const metadata: Metadata = { title: 'Reports' }

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

export default async function ReportsPage({
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
  const report = await getBusinessReport(filter, locale)

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.reports}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.reportsDescription}</p>
      </header>
      <ReportsClient
        key={`${period}:${filter.employeeId || 'all'}:${filter.startDate || ''}:${filter.endDate || ''}`}
        dictionary={dictionary}
        employees={employees}
        locale={locale}
        report={report}
      />
    </div>
  )
}
