'use client'

import { FileDown, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useId, useState, useTransition, type FormEvent } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsSection } from '@/components/ui/settings-section'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { BusinessReportFilter, BusinessReportPeriod, BusinessReportSummary, BusinessReportWarnings } from '@/lib/business-report-types'
import { formatMarketDateTime } from '@/lib/calendar'
import { cashMovementLabels, cashReportParams, cashReportPeriodLabels, cashSummaryFigures, cashSummaryPath, combinedAmount, openingBalanceRows } from '@/lib/cash-summary-view'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale, type MarketProfile } from '@/lib/market'
import { formatMoney } from '@/lib/money'
import type { CashReport } from '@/services/cash-report'
import type { CashSaleReview } from '@/services/cash-sale-review'
import type { CashClosingReport } from '@/services/cash-closing'

import { CashBalanceBreakdown, CashBalanceEquations } from './CashBalanceBreakdown'
import { CashClosingPanel } from './CashClosingPanel'
import { CashMovementDialog } from './CashMovementDialog'
import { CashOpeningDialog } from './CashOpeningDialog'
import { CashSaleReviewDialog } from './CashSaleReviewDialog'

function cashHref(filter: BusinessReportFilter, page = 1) {
  const params = cashReportParams(filter)
  if (page > 1) params.set('page', String(page))
  return `${cashSummaryPath}?${params}`
}

function MetricCard({ label, value, money, className }: {
  label: string
  value: number | null
  money: (value: number) => string
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xl font-semibold tabular-nums">{value === null ? '—' : money(value)}</p>
      </CardContent>
    </Card>
  )
}

function MetricCards({ values, money, columns = 'sm:grid-cols-3' }: {
  values: { label: string; value: number | null }[]
  money: (value: number) => string
  columns?: string
}) {
  return (
    <div className={`grid gap-3 ${columns}`}>
      {values.map((metric) => <MetricCard key={metric.label} {...metric} money={money} />)}
    </div>
  )
}

function SubtractionCards({ values, money, formula }: {
  values: { label: string; value: number | null }[]
  money: (value: number) => string
  formula: string
}) {
  return (
    <div role="group" aria-label={formula}
      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
      {values.map((metric, index) => (
        <Fragment key={metric.label}>
          {index > 0 && <span aria-hidden="true" className="hidden self-center px-1 text-lg text-muted-foreground sm:block">{index === 1 ? '−' : '='}</span>}
          <MetricCard {...metric} money={money} className={index === 2 ? 'bg-muted/50' : undefined} />
        </Fragment>
      ))}
    </div>
  )
}

export function CashSummaryClient({ cash, closing, dictionary, filter, locale, market, review, summary, today, warnings }: {
  cash: CashReport
  closing: CashClosingReport | null
  dictionary: Dictionary
  filter: BusinessReportFilter
  locale: Locale
  market: MarketProfile
  review: CashSaleReview
  summary: BusinessReportSummary
  today: string
  warnings: BusinessReportWarnings
}) {
  const copy = dictionary.cashSummary
  const router = useRouter()
  const id = useId()
  const [period, setPeriod] = useState(filter.period)
  const [startDate, setStartDate] = useState(filter.startDate ?? today)
  const [endDate, setEndDate] = useState(filter.endDate ?? today)
  const [filterError, setFilterError] = useState('')
  const [dialog, setDialog] = useState<'opening' | 'movement' | null>(null)
  const [reviewMode, setReviewMode] = useState<keyof CashSaleReview | null>(null)
  const [refreshing, refresh] = useTransition()
  const moneyLocale = marketLocale(market, locale)
  const money = (value: number) => formatMoney(value, market, moneyLocale)
  const date = (value: string) => formatMarketDateTime(value, market, moneyLocale)
  const periodLabels = cashReportPeriodLabels(dictionary)
  const options = (Object.keys(periodLabels) as BusinessReportPeriod[])
    .map((value) => ({ label: periodLabels[value], value }))
  const saudiVat = market.taxMode === 'saudiVat'
  const { activity, balances } = cash
  const openingBalances = openingBalanceRows(cash, dictionary)
  const { sales, productCosts, payments, salesAfterPayments, balance, profitAfterProductCosts,
    profit, totalProfitExpenses, profitExpenses, profitNote } = cashSummaryFigures(cash, summary, filter.period, dictionary, market)
  const activityLabels = cashMovementLabels(copy)

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (period === 'custom' && (!startDate || !endDate || startDate > endDate)) {
      setFilterError(copy.periodError)
      return
    }
    setFilterError('')
    router.push(cashHref({ period, startDate, endDate }))
  }

  const unclassified = review.legacy.reduce((sum, invoice) => sum + invoice.totalMinor, 0)
  return (
    <div className="space-y-6">
      <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={id + 'period'}>{dictionary.reportingPeriod}</Label>
          <Select items={options} value={period} onValueChange={(value) => { if (value) setPeriod(value) }}>
            <SelectTrigger className="min-w-36" id={id + 'period'}><SelectValue /></SelectTrigger>
            <SelectContent>{options.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {period === 'custom' && (
          <>
            <div className="space-y-1">
              <Label htmlFor={id + 'start'}>{dictionary.startDate}</Label>
              <Input id={id + 'start'} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor={id + 'end'}>{dictionary.endDate}</Label>
              <Input id={id + 'end'} type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} required />
            </div>
          </>
        )}
        <Button type="submit">{copy.apply}</Button>
        <Button type="button" variant="outline" onClick={() => setDialog('opening')}>
          <Pencil aria-hidden="true" />
          {copy.editOpeningBalances}
        </Button>
        <Link className={buttonVariants()} href={`${cashSummaryPath}/print?${cashReportParams(filter)}`} target="_blank" rel="noreferrer">
          <FileDown aria-hidden="true" />
          {dictionary.exportPDF}
        </Link>
        {filterError && <p role="alert" className="w-full text-sm text-destructive">{filterError}</p>}
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">{copy.sales}</h2>
        <MetricCards values={sales} money={money} columns={saudiVat ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-4'} />
        <MetricCards values={productCosts} money={money} columns="sm:grid-cols-2" />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{dictionary.expenses}</h2>
        <MetricCards money={money} columns="sm:grid-cols-2 lg:grid-cols-4" values={payments} />
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span>{copy.salesAfterPayments}</span>
          <strong className="tabular-nums">{salesAfterPayments === null ? '—' : money(salesAfterPayments)}</strong>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{copy.balances}</h2>
            {cash.dailyBalanceDate && <p className="text-sm text-muted-foreground">{copy.balancesForDay.replace('{date}', cash.dailyBalanceDate)}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={refreshing} onClick={() => refresh(() => router.refresh())}>{copy.refresh}</Button>
            <Button variant={cash.startedAt ? 'success' : 'outline'} onClick={() => setDialog('movement')}>{copy.movement}</Button>
          </div>
        </div>
        <MetricCards money={money} values={[
          { label: balances ? copy.total : copy.netActivity, value: combinedAmount(balance) },
          { label: copy.hand, value: balance.cashMinor },
          { label: dictionary.payrollBank, value: balance.bankMinor },
        ]} />
        <CashBalanceEquations cash={cash} dictionary={dictionary} money={money} />
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{copy.openingBalances}</h3>
          {openingBalances.length > 0
            ? openingBalances.map(({ key, values, formula }) => <SubtractionCards key={key} values={values} money={money} formula={formula} />)
            : <p className="text-sm text-muted-foreground">{cash.startedAt ? copy.notTracked : copy.startPrompt}</p>}
        </section>
        {(review.legacy.length > 0 || review.pending.length > 0) && (
          <div className="flex flex-wrap items-center gap-3">
            {review.legacy.length > 0 && (
              <>
                <p className="text-sm font-medium">{copy.needsReview} · {money(unclassified)}</p>
                <Button variant="outline" size="sm" onClick={() => setReviewMode('legacy')}>{copy.reviewToday} ({review.legacy.length})</Button>
              </>
            )}
            {review.pending.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setReviewMode('pending')}>{copy.pendingReceipts} ({review.pending.length})</Button>
            )}
          </div>
        )}
        <CashBalanceBreakdown cash={cash} dictionary={dictionary} money={money} />
      </section>

      {closing && (
        <CashClosingPanel report={closing} dictionary={dictionary} market={market} money={money} date={date}
          balances={closing.businessDate === today ? balances?.closing : undefined}
          onSaved={() => router.refresh()} />
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">{copy.profit}</h2>
        <SubtractionCards values={profitAfterProductCosts} money={money} formula={copy.productCostFormula} />
        <SubtractionCards values={profit} money={money} formula={copy.profitFormula} />
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span>{dictionary.totalExpenses}</span>
          <strong className="tabular-nums">{money(totalProfitExpenses)}</strong>
        </div>
        {profitNote && <p className="text-sm text-muted-foreground">{profitNote}</p>}
        {profitExpenses.length > 0 && (
          <SettingsSection title={dictionary.expenseBreakdown}>
            <dl className="space-y-2 text-sm">
              {profitExpenses.map(({ label, value }) => (
                <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt>{label}</dt>
                  <dd className="font-medium tabular-nums">{money(value)}</dd>
                </div>
              ))}
            </dl>
          </SettingsSection>
        )}
        {warnings.missingCostLines > 0 && <p className="text-sm text-muted-foreground">{copy.costWarning}</p>}
      </section>

      <section id="cash-history" className="space-y-3">
        <h2 className="font-semibold">{copy.history}</h2>
        {activity.history.length ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dictionary.date}</TableHead>
                  <TableHead>{copy.kind}</TableHead>
                  <TableHead className="text-right">{copy.hand}</TableHead>
                  <TableHead className="text-right">{dictionary.payrollBank}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{date(row.effectiveAt)}</TableCell>
                    <TableCell>
                      <div>{activityLabels[row.kind]}</div>
                      {row.note && <p className="max-w-sm text-xs text-muted-foreground wrap-anywhere whitespace-normal">{row.note}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.cashMinor ? money(row.cashMinor) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.bankMinor ? money(row.bankMinor) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : <p className="text-sm text-muted-foreground">{copy.noHistory}</p>}
        {activity.totalPages > 1 && (
          <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={copy.history}>
            <p className="text-sm text-muted-foreground">{dictionary.pageOf
              .replace('{page}', new Intl.NumberFormat(moneyLocale).format(activity.page))
              .replace('{total}', new Intl.NumberFormat(moneyLocale).format(activity.totalPages))}</p>
            <div className="flex gap-2">
              {activity.page > 1 && (
                <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={cashHref(filter, activity.page - 1) + '#cash-history'}>{dictionary.previous}</Link>
              )}
              {activity.page < activity.totalPages && (
                <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} href={cashHref(filter, activity.page + 1) + '#cash-history'}>{dictionary.next}</Link>
              )}
            </div>
          </nav>
        )}
      </section>

      {dialog === 'opening' && <CashOpeningDialog date={cash.openingEditor.date} today={today} balances={cash.openingEditor.balances} dictionary={dictionary} market={market}
        onClose={() => setDialog(null)} onSaved={() => { setDialog(null); router.refresh() }} />}
      {dialog === 'movement' && <CashMovementDialog canReconcile={Boolean(cash.startedAt)} dictionary={dictionary} market={market} money={money} today={today}
        onClose={() => setDialog(null)} onSaved={() => { setDialog(null); router.refresh() }} />}
      {reviewMode && <CashSaleReviewDialog dictionary={dictionary} locale={locale} market={market} today={today}
        mode={reviewMode} sales={review[reviewMode]} onClose={() => setReviewMode(null)} onSave={() => router.refresh()} />}
    </div>
  )
}
