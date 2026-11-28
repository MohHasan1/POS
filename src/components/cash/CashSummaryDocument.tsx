import { ProfessionalReportLayout, ProfessionalReportMetrics } from '@/components/reports/ProfessionalReportLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { BusinessReport } from '@/lib/business-report-types'
import { formatMarketDate, formatMarketDateTime } from '@/lib/calendar'
import { bankClosingFigures, cashBalanceRows, cashClosingFigures, cashMovementLabels, cashReportPeriodLabels, cashSummaryFigures, combinedAmount, openingBalanceRows } from '@/lib/cash-summary-view'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale } from '@/lib/market'
import { formatMoney } from '@/lib/money'
import type { CashClosingReport } from '@/services/cash-closing'
import type { CashReport } from '@/services/cash-report'

export function CashSummaryDocument({ cash, closing, dictionary, locale, report }: {
  cash: CashReport
  closing: CashClosingReport['closing']
  dictionary: Dictionary
  locale: Locale
  report: BusinessReport
}) {
  const copy = dictionary.cashSummary
  const bankClosing = closing ? bankClosingFigures(closing, copy) : []
  const { market, filter, range, summary } = report
  const displayLocale = marketLocale(market, locale)
  const money = (value: number | null) => value === null ? '—' : formatMoney(value, market, displayLocale)
  const date = (value: string) => formatMarketDateTime(value, market, displayLocale)
  const metricValues = (figures: ReadonlyArray<{ label: string; value: number | null }>) =>
    figures.map(({ label, value }) => [label, money(value)] as const)
  const rangeStart = range.start && formatMarketDate(range.start, market, displayLocale)
  const rangeEnd = range.end && formatMarketDate(new Date(Date.parse(range.end) - 1), market, displayLocale)
  const rangeLabel = rangeStart && rangeEnd && rangeStart !== rangeEnd
    ? `${rangeStart} – ${rangeEnd}` : rangeStart || dictionary.allTime
  const { sales, productCosts, payments, salesAfterPayments, profitAfterProductCosts,
    profit, totalProfitExpenses, profitExpenses, profitNote } = cashSummaryFigures(cash, summary, filter.period, dictionary, market)
  const movementLabels = cashMovementLabels(copy)
  const { activity } = cash
  const openingBalances = openingBalanceRows(cash, dictionary)

  return (
    <ProfessionalReportLayout dictionary={dictionary} displayLocale={displayLocale} report={report}
      title={dictionary.cashSummaryTitle} periodLabel={cashReportPeriodLabels(dictionary)[filter.period]} rangeLabel={rangeLabel}>
      <section className="professional-report-section space-y-3">
        <h2 className="text-base font-bold">{dictionary.reportSummary}</h2>
        <ProfessionalReportMetrics title={copy.sales} items={metricValues([...sales, ...productCosts])} />
        <ProfessionalReportMetrics title={dictionary.expenses} items={metricValues([
          ...payments, { label: copy.salesAfterPayments, value: salesAfterPayments },
        ])} />
        <ProfessionalReportMetrics title={copy.profit} items={metricValues([...profitAfterProductCosts, ...profit.slice(1)])} />
        <p className="text-[8pt] text-muted-foreground">
          <strong>{dictionary.totalExpenses} {money(totalProfitExpenses)}</strong>
          {profitExpenses.map(({ label, value }) => ` · ${label} ${money(value)}`)}
        </p>
        {profitNote && <p className="text-[8pt] text-muted-foreground">{profitNote}</p>}
        {report.warnings.missingCostLines > 0 && <p className="text-[8pt] text-muted-foreground">{copy.costWarning}</p>}
      </section>

      <section className="professional-report-section">
        <h2 className="mb-2 text-base font-bold">{copy.balances}</h2>
        {cash.dailyBalanceDate && <p className="mb-2 text-xs text-muted-foreground">{copy.balancesForDay.replace('{date}', cash.dailyBalanceDate)}</p>}
        {activity.includesBeforeOpening && <p className="mb-2 text-xs text-muted-foreground">{copy.balanceStartsAtCount}</p>}
        <div className="mb-3 space-y-2">
          {openingBalances.length > 0
            ? openingBalances.map(({ key, title, values, formula }) => (
                <div key={key} className="report-avoid-break">
                  <ProfessionalReportMetrics title={title} items={metricValues(values)} />
                  <p className="mt-1 text-[8pt] text-muted-foreground">{formula}</p>
                </div>
              ))
            : <p className="text-xs text-muted-foreground">{cash.startedAt ? copy.notTracked : copy.startPrompt}</p>}
        </div>
        <Table className="w-full border-collapse text-[8pt]" aria-label={copy.balanceBreakdown}>
          <TableHeader>
            <TableRow className="border-y border-black bg-black/5 text-left">
              <TableHead className="h-auto p-1.5">{copy.balanceCalculation}</TableHead>
              <TableHead className="h-auto p-1.5 text-right">{copy.hand}</TableHead>
              <TableHead className="h-auto p-1.5 text-right">{dictionary.payrollBank}</TableHead>
              <TableHead className="h-auto p-1.5 text-right">{dictionary.total}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashBalanceRows(cash, copy).map(({ label, amounts, total }) => (
              <TableRow key={label} className={`professional-report-row border-b border-black/20${total ? ' bg-black/5 font-semibold' : ''}`}>
                <TableHead scope="row" className="h-auto p-1.5 text-left whitespace-normal font-medium">{label}</TableHead>
                <TableCell className="p-1.5 text-right tabular-nums">{money(amounts.cashMinor)}</TableCell>
                <TableCell className="p-1.5 text-right tabular-nums">{money(amounts.bankMinor)}</TableCell>
                <TableCell className="p-1.5 text-right tabular-nums">{money(combinedAmount(amounts))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {closing && (
        <section className="professional-report-section report-avoid-break">
          <h2 className="mb-2 text-base font-bold">{copy.dailyClosing}</h2>
          <ProfessionalReportMetrics title={copy.closedAt.replace('{date}', date(closing.closedAt))}
            items={metricValues(cashClosingFigures(closing, copy))} />
          {bankClosing.length > 0 && <ProfessionalReportMetrics title={dictionary.payrollBank} items={metricValues(bankClosing)} />}
          {closing.note && <p className="mt-2 text-xs wrap-anywhere text-muted-foreground">{closing.note}</p>}
        </section>
      )}

      {closing?.nextDayCashMinor != null && (
        <section className="professional-report-section report-avoid-break">
          <ProfessionalReportMetrics title={copy.cashForTomorrow} items={[[copy.openingCash, money(closing.nextDayCashMinor)]]} />
        </section>
      )}

      <section className="professional-report-section">
        <h2 className="mb-2 text-base font-bold">{copy.history}</h2>
        {activity.history.length > 0 ? (
          <Table className="w-full border-collapse text-[8pt]">
            <TableHeader>
              <TableRow className="border-y border-black bg-black/5 text-left">
                <TableHead className="h-auto p-1.5">{dictionary.date}</TableHead>
                <TableHead className="h-auto p-1.5">{copy.kind}</TableHead>
                <TableHead className="h-auto p-1.5">{dictionary.note}</TableHead>
                <TableHead className="h-auto p-1.5 text-right">{copy.hand}</TableHead>
                <TableHead className="h-auto p-1.5 text-right">{dictionary.payrollBank}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.history.map((movement) => (
                <TableRow key={movement.id} className="professional-report-row border-b border-black/20">
                  <TableCell className="p-1.5 whitespace-nowrap">{date(movement.effectiveAt)}</TableCell>
                  <TableCell className="p-1.5 font-medium">{movementLabels[movement.kind]}</TableCell>
                  <TableCell className="p-1.5 wrap-anywhere whitespace-normal">{movement.note}</TableCell>
                  <TableCell className="p-1.5 text-right tabular-nums">{money(movement.cashMinor || null)}</TableCell>
                  <TableCell className="p-1.5 text-right tabular-nums">{money(movement.bankMinor || null)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="text-xs text-muted-foreground">{copy.noHistory}</p>}
      </section>
    </ProfessionalReportLayout>
  )
}
