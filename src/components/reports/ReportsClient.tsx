'use client'

import { AlertTriangle, ArrowDownRight, ArrowUpRight, ReceiptCent, Wrench } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { BusinessTrendChart } from '@/components/reports/BusinessTrendChart'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  BusinessReport,
  BusinessReportPeriod,
  BusinessReportSummary,
} from '@/lib/business-report-types'
import type { Dictionary, Locale } from '@/lib/localization'
import { localizedName, marketLocale, normalizedTranslations } from '@/lib/market'
import { formatMoney, formatQuantity } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Employee } from '@/payload-types'

const ALL_EMPLOYEES = '__all_employees__'

function changeBps(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0
  return Math.round(((current - previous) * 10_000) / Math.abs(previous))
}

function ComparisonBadge({
  current,
  locale,
  lowerIsBetter = false,
  newLabel,
  previous,
}: {
  current: number
  locale: string
  lowerIsBetter?: boolean
  newLabel: string
  previous?: number
}) {
  if (previous === undefined) return null
  const change = changeBps(current, previous)
  if (change === null) return <Badge variant="secondary">{newLabel}</Badge>
  const improved = lowerIsBetter ? change <= 0 : change >= 0
  return (
    <Badge
      className={
        improved
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
      }
      variant="secondary"
    >
      {change >= 0 ? <ArrowUpRight /> : <ArrowDownRight />}
      {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.abs(change) / 100)}%
    </Badge>
  )
}

export function ReportsClient({
  dictionary,
  employees,
  locale,
  report,
}: {
  dictionary: Dictionary
  employees: Employee[]
  locale: Locale
  report: BusinessReport
}) {
  const router = useRouter()
  const moneyLocale = marketLocale(report.market, locale)
  const [period, setPeriod] = useState<BusinessReportPeriod>(report.filter.period)
  const [employeeId, setEmployeeId] = useState(report.filter.employeeId || '')
  const [startDate, setStartDate] = useState(report.filter.startDate || '')
  const [endDate, setEndDate] = useState(report.filter.endDate || '')
  const money = (value: number) => formatMoney(value, report.market, moneyLocale)
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
  const employeeOptions = [
    { label: dictionary.allEmployees, value: ALL_EMPLOYEES },
    ...employees.map((employee) => ({ label: employee.name, value: employee.id })),
  ]

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new URLSearchParams({ period })
    if (employeeId) values.set('employee', employeeId)
    if (period === 'custom') {
      if (startDate) values.set('start', startDate)
      if (endDate) values.set('end', endDate)
    }
    router.push(`/reports?${values}`)
  }

  const metrics: Array<{
    key: keyof BusinessReportSummary
    label: string
    value: number
    lowerIsBetter?: boolean
    warning?: boolean
  }> = [
    { key: 'grossSalesMinor', label: dictionary.grossSales, value: report.summary.grossSalesMinor },
    { key: 'netSalesMinor', label: dictionary.netSales, value: report.summary.netSalesMinor },
    {
      key: 'directCostMinor',
      label: dictionary.directCosts,
      lowerIsBetter: true,
      value: report.summary.directCostMinor,
      warning: report.warnings.missingCostLines > 0,
    },
    {
      key: 'grossProfitMinor',
      label: dictionary.grossProfit,
      value: report.summary.grossProfitMinor,
      warning: report.warnings.missingCostLines > 0,
    },
    {
      key: 'salaryEarnedMinor',
      label: dictionary.salaryConfirmed,
      lowerIsBetter: true,
      value: report.summary.salaryEarnedMinor,
      warning: report.warnings.unconfirmedSalaryCount > 0,
    },
    {
      key: 'commissionEarnedMinor',
      label: dictionary.commissionEarned,
      lowerIsBetter: true,
      value: report.summary.commissionEarnedMinor,
    },
    {
      key: 'expenseMinor',
      label: dictionary.operatingExpenses,
      lowerIsBetter: true,
      value: report.summary.expenseMinor,
    },
    {
      key: 'operatingProfitMinor',
      label: dictionary.operatingProfit,
      value: report.summary.operatingProfitMinor,
      warning: report.warnings.missingCostLines > 0 || report.warnings.unconfirmedSalaryCount > 0,
    },
  ]

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-background p-3">
        <form className="flex flex-col gap-3 lg:flex-row lg:items-end" onSubmit={apply}>
          <div className="min-w-48 space-y-1.5">
            <Label htmlFor="report-period">{dictionary.reportingPeriod}</Label>
            <Select
              value={period}
              onValueChange={(value) => setPeriod(value as BusinessReportPeriod)}
            >
              <SelectTrigger id="report-period" className="h-9 w-full bg-background">
                <SelectValue>{periodLabels[period]}</SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="today">{dictionary.today}</SelectItem>
                <SelectItem value="yesterday">{dictionary.yesterday}</SelectItem>
                <SelectItem value="month">{dictionary.thisMonth}</SelectItem>
                <SelectItem value="previousMonth">{dictionary.previousMonth}</SelectItem>
                <SelectItem value="year">{dictionary.thisYear}</SelectItem>
                <SelectItem value="previousYear">{dictionary.previousYear}</SelectItem>
                <SelectItem value="all">{dictionary.allTime}</SelectItem>
                <SelectItem value="custom">{dictionary.customRange}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === 'custom' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="report-start">{dictionary.startDate}</Label>
                <Input
                  id="report-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-end">{dictionary.endDate}</Label>
                <Input
                  id="report-end"
                  type="date"
                  min={startDate || undefined}
                  required
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </>
          )}
          <div className="min-w-52 space-y-1.5">
            <Label htmlFor="report-employee">{dictionary.employee}</Label>
            <Select
              items={employeeOptions}
              value={employeeId || ALL_EMPLOYEES}
              onValueChange={(value) => setEmployeeId(value === ALL_EMPLOYEES ? '' : value || '')}
            >
              <SelectTrigger id="report-employee" className="h-9 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value={ALL_EMPLOYEES}>{dictionary.allEmployees}</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            {dictionary.applyFilter}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/reports')}>
            {dictionary.resetFilters}
          </Button>
          <div className="flex gap-2 lg:ml-auto">
            <Link className={buttonVariants({ variant: 'outline' })} href="/reports/costs">
              <Wrench />
              {dictionary.missingCosts}
            </Link>
            <Link className={buttonVariants({ variant: 'success' })} href="/expenses">
              <ReceiptCent />
              {dictionary.manageExpenses}
            </Link>
          </div>
        </form>
      </section>

      {(report.warnings.missingCostLines > 0 || report.warnings.unconfirmedSalaryCount > 0) && (
        <section className="grid gap-3 md:grid-cols-2">
          {report.warnings.missingCostLines > 0 && (
            <div className="flex gap-3 rounded-lg bg-amber-100 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-medium">{dictionary.profitEstimateWarning}</p>
                <p className="mt-1 text-sm opacity-80">
                  {dictionary.costCoverage.replace(
                    '{percent}',
                    new Intl.NumberFormat(moneyLocale, { maximumFractionDigits: 1 }).format(
                      report.warnings.costCoverageBps / 100,
                    ),
                  )}
                </p>
              </div>
            </div>
          )}
          {report.warnings.unconfirmedSalaryCount > 0 && (
            <div className="flex gap-3 rounded-lg bg-amber-100 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-medium">{dictionary.unconfirmedSalaryWarning}</p>
                <p className="mt-1 text-sm opacity-80">
                  {dictionary.unconfirmedSalaryCount.replace(
                    '{count}',
                    String(report.warnings.unconfirmedSalaryCount),
                  )}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card
            key={metric.key}
            className={cn(metric.key === 'operatingProfitMinor' && 'ring-1 ring-primary/20')}
          >
            <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
                {metric.warning ? ' *' : ''}
              </CardTitle>
              <ComparisonBadge
                current={metric.value}
                locale={moneyLocale}
                lowerIsBetter={metric.lowerIsBetter}
                newLabel={dictionary.reportNewValue}
                previous={report.comparison?.summary[metric.key]}
              />
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  'text-2xl font-semibold tabular-nums',
                  metric.value < 0 && 'text-red-600 dark:text-red-400',
                )}
              >
                {money(metric.value)}
              </p>
              {metric.key === 'operatingProfitMinor' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {dictionary.profitMargin}:{' '}
                  {new Intl.NumberFormat(moneyLocale, { maximumFractionDigits: 1 }).format(
                    report.summary.profitMarginBps / 100,
                  )}
                  %
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [dictionary.vatCollected, report.summary.vatMinor],
          [dictionary.payrollPaid, report.summary.payrollPaidMinor],
          [dictionary.capitalExpenses, report.summary.capitalExpenseMinor],
          [dictionary.paidBills, report.summary.billPaidMinor],
          [dictionary.unpaidBills, report.summary.billUnpaidMinor],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-lg font-semibold tabular-nums">{money(Number(value))}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{dictionary.salesAndProfitTrend}</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessTrendChart dictionary={dictionary} locale={locale} report={report} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dictionary.employeePerformance}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dictionary.employee}</TableHead>
                <TableHead className="text-right">{dictionary.salesGenerated}</TableHead>
                <TableHead className="text-right">{dictionary.salaryConfirmed}</TableHead>
                <TableHead className="text-right">{dictionary.commissionEarned}</TableHead>
                <TableHead className="text-right">{dictionary.totalPayable}</TableHead>
                <TableHead className="text-right">{dictionary.totalPaid}</TableHead>
                <TableHead className="text-right">{dictionary.outstandingAllTime}</TableHead>
                <TableHead className="text-right">{dictionary.contribution}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.employeeMetrics.map((metric) => (
                <TableRow key={metric.employeeId || 'unassigned'}>
                  <TableCell className="font-medium">
                    {metric.employeeId ? metric.employeeName : dictionary.unassignedEmployee}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(metric.salesMinor)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(metric.salaryMinor)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(metric.commissionMinor)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(metric.compensationMinor)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(metric.paidMinor)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(metric.outstandingMinor)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {money(metric.contributionMinor)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!report.employeeMetrics.length && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {dictionary.noReportData}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.productProfitability}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dictionary.product}</TableHead>
                  <TableHead className="text-right">{dictionary.quantity}</TableHead>
                  <TableHead className="text-right">{dictionary.netSales}</TableHead>
                  <TableHead className="text-right">{dictionary.directCosts}</TableHead>
                  <TableHead className="text-right">{dictionary.contribution}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.productMetrics.map((metric) => {
                  const secondary = localizedName(
                    normalizedTranslations(undefined, {
                      ar: metric.nameArabic,
                      bn: metric.nameBangla,
                    }),
                    report.secondaryLanguage,
                  )
                  return (
                    <TableRow
                      key={metric.productId || `${metric.nameEnglish}:${metric.nameArabic || ''}`}
                    >
                      <TableCell>
                        <span className="font-medium">{metric.nameEnglish}</span>
                        {secondary && (
                          <span className="block text-xs text-muted-foreground">{secondary}</span>
                        )}
                        {metric.missingCostLines > 0 && (
                          <Badge
                            className="mt-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            variant="secondary"
                          >
                            {dictionary.costMissing}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQuantity(metric.quantityMilliunits, moneyLocale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(metric.netRevenueMinor)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(metric.directCostMinor)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {money(metric.contributionMinor)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.expenseBreakdown}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dictionary.category}</TableHead>
                  <TableHead className="text-right">{dictionary.fixedExpenses}</TableHead>
                  <TableHead className="text-right">{dictionary.variableExpenses}</TableHead>
                  <TableHead className="text-right">{dictionary.capitalExpenses}</TableHead>
                  <TableHead className="text-right">{dictionary.total}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.expenseMetrics.map((metric) => (
                  <TableRow key={metric.categoryName}>
                    <TableCell className="font-medium">{metric.categoryName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(metric.fixedMinor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(metric.variableMinor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(metric.capitalMinor)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(metric.netMinor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!report.expenseMetrics.length && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {dictionary.noExpensesForPeriod}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
