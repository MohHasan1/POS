import type { BusinessReport } from '@/lib/business-report-types'
import { formatMarketDateTime } from '@/lib/calendar'
import type { Dictionary, Locale } from '@/lib/localization'
import { localizedName, marketLocale, normalizedTranslations } from '@/lib/market'
import { formatMoney, formatQuantity } from '@/lib/money'

export function ProfessionalReportDocument({
  dictionary,
  employeeName,
  locale,
  periodLabel,
  rangeLabel,
  report,
}: {
  dictionary: Dictionary
  employeeName?: string
  locale: Locale
  periodLabel: string
  rangeLabel: string
  report: BusinessReport
}) {
  const displayLocale = marketLocale(report.market, locale)
  const money = (value: number) => formatMoney(value, report.market, displayLocale)
  const number = (value: number) => new Intl.NumberFormat(displayLocale, { maximumFractionDigits: 2 }).format(value)
  const isDaily = report.filter.period === 'today' || report.filter.period === 'yesterday'
  const { capitalRecovery } = report
  const vatSummary: Array<[string, string]> =
    report.market.taxMode === 'saudiVat'
      ? [[dictionary.vatCollected, money(report.summary.vatMinor)]]
      : []
  const calculationSummary: Array<[string, string]> = isDaily
    ? [
        [dictionary.grossSales, money(report.summary.grossSalesMinor)],
        [dictionary.directCosts, money(report.summary.directCostMinor)],
        [dictionary.grossProfit, money(report.summary.grossProfitMinor)],
        [dictionary.commissionEarned, money(report.summary.commissionEarnedMinor)],
        [dictionary.salesContribution, money(report.summary.salesContributionMinor)],
      ]
    : [
        [dictionary.grossSales, money(report.summary.grossSalesMinor)],
        [dictionary.netSales, money(report.summary.netSalesMinor)],
        [dictionary.directCosts, money(report.summary.directCostMinor)],
        [dictionary.grossProfit, money(report.summary.grossProfitMinor)],
        [dictionary.commissionEarned, money(report.summary.commissionEarnedMinor)],
        [dictionary.salesContribution, money(report.summary.salesContributionMinor)],
        [dictionary.salaryConfirmed, money(report.summary.salaryEarnedMinor)],
        [dictionary.profitBeforeOperatingExpenses, money(report.summary.profitBeforeOperatingExpensesMinor)],
        [dictionary.operatingExpenses, money(report.summary.expenseMinor)],
        [dictionary.operatingProfit, money(report.summary.operatingProfitMinor)],
      ]
  const activitySummary: Array<[string, string]> = [
    [dictionary.invoices, number(report.summary.invoiceCount)],
    [dictionary.averageInvoicesPerDay, number(report.summary.averageInvoicesPerDay)],
    [dictionary.averageInvoice, money(report.summary.averageInvoiceMinor)],
    ...vatSummary,
  ]
  const paymentSummary: Array<[string, string]> = isDaily
    ? []
    : [
        [dictionary.payrollPaid, money(report.summary.payrollPaidMinor)],
        [dictionary.paidBills, money(report.summary.billPaidMinor)],
        [dictionary.unpaidBills, money(report.summary.billUnpaidMinor)],
        [dictionary.totalExpenses, money(report.summary.totalExpenseMinor)],
      ]
  const capitalSummary: Array<[string, string]> = [
    [dictionary.capitalExpenseTotal, money(report.summary.capitalExpenseMinor)],
  ]
  if (capitalRecovery) {
    capitalSummary.push(
      [dictionary.operatingProfit, money(report.summary.operatingProfitMinor)],
      [dictionary.profitNeededToBreakEven, money(capitalRecovery.profitNeededMinor)],
      [dictionary.profitAboveBreakEven, money(capitalRecovery.profitAboveBreakEvenMinor)],
    )
  }
  const moneySummary: Array<[string, string]> = [
    [dictionary.owedToUsAtPeriodEnd, money(report.summary.owedToUsMinor)],
    [dictionary.moneyReceivedInPeriod, money(report.summary.moneyReceivedMinor)],
    [dictionary.weOweAtPeriodEnd, money(report.summary.weOweMinor)],
    [dictionary.moneyPaidInPeriod, money(report.summary.moneyPaidMinor)],
  ]
  const summaryGroups = [
    { items: calculationSummary, title: dictionary.profitCalculation },
    { items: activitySummary, title: dictionary.salesActivity },
    ...(isDaily ? [] : [
      { items: paymentSummary, title: dictionary.paymentsAndExpenses },
      {
        items: capitalSummary,
        title: capitalRecovery ? dictionary.annualCapitalRecovery : dictionary.capitalExpenses,
      },
    ]),
    { items: moneySummary, title: dictionary.money },
  ]

  return (
    <article className="professional-report space-y-6">
      <header className="border-b-2 border-black pb-3">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">{report.businessName}</h1>
            <p className="mt-1 text-lg font-semibold">{dictionary.professionalBusinessReport}</p>
            <p className="mt-1 text-sm">
              {periodLabel} · {rangeLabel}
            </p>
            {employeeName && (
              <p className="mt-1 text-sm">
                {dictionary.employeeDetails}: {employeeName}
              </p>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{dictionary.reportGeneratedAt}</p>
            <p className="mt-1 font-medium text-foreground">
              {formatMarketDateTime(report.generatedAt, report.market, displayLocale)}
            </p>
            <p className="mt-1">{report.market.currencyCode}</p>
          </div>
        </div>
        {employeeName && <p className="mt-2 text-xs">{dictionary.employeeFilterHint}</p>}
      </header>

      <section className="professional-report-section">
        <h2 className="mb-2 text-base font-bold">{dictionary.reportSummary}</h2>
        <div className="space-y-3">
          {summaryGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-1 text-[9pt] font-semibold">{group.title}</h3>
              <div className="professional-summary-grid grid grid-cols-5 border-l border-t border-black/30">
                {group.items.map(([label, value]) => (
                  <div key={label} className="border-b border-r border-black/30 p-2">
                    <p className="text-[8pt] text-muted-foreground">{label}</p>
                    <p className="mt-1 text-[11pt] font-bold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[8pt] text-muted-foreground">
          {dictionary.salesAfterDirectCostsHelp}
        </p>
        {!isDaily && (
          <p className="mt-1 text-[8pt] text-muted-foreground">
            {dictionary.paymentsAndExpensesHelp}
          </p>
        )}
        {capitalRecovery && (
          <p className="mt-1 text-[8pt] text-muted-foreground">{dictionary.capitalRecoveryHelp}</p>
        )}
        <p className="mt-1 text-[8pt] text-muted-foreground">{dictionary.moneyBalancesHelp}</p>
        {(report.warnings.missingCostLines > 0 ||
          (!isDaily && report.warnings.unconfirmedSalaryCount > 0)) && (
          <div className="mt-2 border border-black/30 p-2 text-[8pt]">
            {report.warnings.missingCostLines > 0 && (
              <p>
                {dictionary.profitEstimateWarning}.{' '}
                {dictionary.costCoverage.replace(
                  '{percent}',
                  new Intl.NumberFormat(displayLocale, { maximumFractionDigits: 1 }).format(
                    report.warnings.costCoverageBps / 100,
                  ),
                )}
              </p>
            )}
            {!isDaily && report.warnings.unconfirmedSalaryCount > 0 && (
              <p>
                {dictionary.unconfirmedSalaryCount.replace(
                  '{count}',
                  number(report.warnings.unconfirmedSalaryCount),
                )}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="professional-report-section">
        <div className="mb-2 flex items-end justify-between gap-4">
          <h2 className="text-base font-bold">{dictionary.salesRegister}</h2>
          <p className="text-xs text-muted-foreground">
            {dictionary.invoiceCount.replace('{count}', number(report.sales.length))}
          </p>
        </div>
        <table className="w-full border-collapse text-[8pt]">
          <thead>
            <tr className="border-y border-black bg-black/5 text-left">
              <th className="p-1.5">{dictionary.date}</th>
              <th className="p-1.5">{dictionary.invoiceNumber}</th>
              <th className="p-1.5">{dictionary.saleItems}</th>
              <th className="p-1.5">{dictionary.employee}</th>
              <th className="p-1.5">{dictionary.saleSource}</th>
              <th className="p-1.5 text-right">{dictionary.netSales}</th>
              {report.market.taxMode === 'saudiVat' && (
                <th className="p-1.5 text-right">{dictionary.vatCollected}</th>
              )}
              <th className="p-1.5 text-right">{dictionary.total}</th>
            </tr>
          </thead>
          <tbody>
            {report.sales.map((sale) => (
              <tr key={sale.invoiceId} className="professional-report-row border-b border-black/20">
                <td className="whitespace-nowrap p-1.5 align-top">
                  {formatMarketDateTime(sale.issuedAt, report.market, displayLocale)}
                </td>
                <td className="whitespace-nowrap p-1.5 align-top font-medium">
                  {sale.invoiceNumber}
                </td>
                <td className="p-1.5 align-top">
                  {sale.items.map((item, index) => {
                    const secondary = localizedName(
                      normalizedTranslations(undefined, {
                        ar: item.nameArabic,
                        bn: item.nameBangla,
                      }),
                      report.secondaryLanguage,
                    )
                    return (
                      <div key={`${sale.invoiceId}:${index}`}>
                        {item.nameEnglish}
                        {secondary ? ` / ${secondary}` : ''} ×{' '}
                        {formatQuantity(item.quantityMilliunits, displayLocale)} —{' '}
                        {money(item.totalMinor)}
                      </div>
                    )
                  })}
                </td>
                <td className="p-1.5 align-top">
                  {sale.employeeName || dictionary.unassignedEmployee}
                </td>
                <td className="p-1.5 align-top">
                  {sale.entrySource === 'paperBackfill'
                    ? dictionary.historicalPaperSale
                    : sale.salesChannel === 'serviceBoard'
                      ? dictionary.serviceBoard
                      : dictionary.checkout}
                </td>
                <td className="whitespace-nowrap p-1.5 text-right align-top tabular-nums">
                  {money(sale.netMinor)}
                </td>
                {report.market.taxMode === 'saudiVat' && (
                  <td className="whitespace-nowrap p-1.5 text-right align-top tabular-nums">
                    {money(sale.vatMinor)}
                  </td>
                )}
                <td className="whitespace-nowrap p-1.5 text-right align-top font-semibold tabular-nums">
                  {money(sale.totalMinor)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-bold">
              <td
                className="p-1.5 text-right"
                colSpan={report.market.taxMode === 'saudiVat' ? 7 : 6}
              >
                {dictionary.total}
              </td>
              <td className="whitespace-nowrap p-1.5 text-right tabular-nums">
                {money(report.summary.grossSalesMinor)}
              </td>
            </tr>
          </tfoot>
        </table>
        {!report.sales.length && (
          <p className="border-b border-black/20 py-4 text-center text-sm">
            {dictionary.noReportData}
          </p>
        )}
      </section>

      <section className="professional-report-section">
        <h2 className="mb-2 text-base font-bold">{dictionary.employeePerformance}</h2>
        <table className="w-full border-collapse text-[8pt]">
          <thead>
            <tr className="border-y border-black bg-black/5 text-left">
              <th className="p-1.5">{dictionary.employee}</th>
              <th className="p-1.5 text-right">{dictionary.invoices}</th>
              <th className="p-1.5 text-right">{dictionary.salesGenerated}</th>
              <th className="p-1.5 text-right">{dictionary.directCosts}</th>
              <th className="p-1.5 text-right">{dictionary.commissionEarned}</th>
              {!isDaily && <th className="p-1.5 text-right">{dictionary.salaryConfirmed}</th>}
              <th className="p-1.5 text-right">
                {isDaily ? dictionary.salesContribution : dictionary.contribution}
              </th>
            </tr>
          </thead>
          <tbody>
            {report.employeeMetrics.map((metric) => (
              <tr
                key={metric.employeeId || 'unassigned'}
                className="professional-report-row border-b border-black/20"
              >
                <td className="p-1.5 font-medium">
                  {metric.employeeId ? metric.employeeName : dictionary.unassignedEmployee}
                </td>
                <td className="p-1.5 text-right tabular-nums">{number(metric.invoiceCount)}</td>
                <td className="p-1.5 text-right tabular-nums">{money(metric.salesMinor)}</td>
                <td className="p-1.5 text-right tabular-nums">{money(metric.directCostMinor)}</td>
                <td className="p-1.5 text-right tabular-nums">{money(metric.commissionMinor)}</td>
                {!isDaily && (
                  <td className="p-1.5 text-right tabular-nums">{money(metric.salaryMinor)}</td>
                )}
                <td className="p-1.5 text-right font-semibold tabular-nums">
                  {money(isDaily ? metric.salesContributionMinor : metric.contributionMinor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="professional-report-section">
        <h2 className="mb-2 text-base font-bold">{dictionary.productProfitability}</h2>
        <table className="w-full border-collapse text-[8pt]">
          <thead>
            <tr className="border-y border-black bg-black/5 text-left">
              <th className="p-1.5">{dictionary.product}</th>
              <th className="p-1.5 text-right">{dictionary.quantity}</th>
              <th className="p-1.5 text-right">{dictionary.netSales}</th>
              <th className="p-1.5 text-right">{dictionary.directCosts}</th>
              <th className="p-1.5 text-right">{dictionary.commissionEarned}</th>
              <th className="p-1.5 text-right">{dictionary.contribution}</th>
            </tr>
          </thead>
          <tbody>
            {report.productMetrics.map((metric) => (
              <tr
                key={metric.productId || metric.nameEnglish}
                className="professional-report-row border-b border-black/20"
              >
                <td className="p-1.5 font-medium">{metric.nameEnglish}</td>
                <td className="p-1.5 text-right">
                  {formatQuantity(metric.quantityMilliunits, displayLocale)}
                </td>
                <td className="p-1.5 text-right tabular-nums">{money(metric.netRevenueMinor)}</td>
                <td className="p-1.5 text-right tabular-nums">{money(metric.directCostMinor)}</td>
                <td className="p-1.5 text-right tabular-nums">{money(metric.commissionMinor)}</td>
                <td className="p-1.5 text-right font-semibold tabular-nums">
                  {money(metric.contributionMinor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {!isDaily && (
        <section className="professional-report-section">
          <h2 className="mb-2 text-base font-bold">{dictionary.expenseBreakdown}</h2>
          <table className="w-full border-collapse text-[8pt]">
            <thead>
              <tr className="border-y border-black bg-black/5 text-left">
                <th className="p-1.5">{dictionary.category}</th>
                <th className="p-1.5 text-right">{dictionary.fixedExpenses}</th>
                <th className="p-1.5 text-right">{dictionary.variableExpenses}</th>
                <th className="p-1.5 text-right">{dictionary.capitalExpenses}</th>
                <th className="p-1.5 text-right">{dictionary.total}</th>
              </tr>
            </thead>
            <tbody>
              {report.expenseMetrics.map((metric) => (
                <tr key={metric.categoryName} className="border-b border-black/20">
                  <td className="p-1.5 font-medium">{metric.categoryName}</td>
                  <td className="p-1.5 text-right tabular-nums">{money(metric.fixedMinor)}</td>
                  <td className="p-1.5 text-right tabular-nums">{money(metric.variableMinor)}</td>
                  <td className="p-1.5 text-right tabular-nums">{money(metric.capitalMinor)}</td>
                  <td className="p-1.5 text-right font-semibold tabular-nums">
                    {money(metric.netMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="border-t border-black pt-2 text-center text-[8pt] text-muted-foreground">
        {dictionary.generatedByQuickPOS}
      </footer>
    </article>
  )
}
