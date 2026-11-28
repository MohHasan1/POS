import { z } from 'zod'

import type { CashClosing, CashLedger } from '@/payload-types'
import type { CashReport } from '@/services/cash-report'

import type { BusinessReportFilter, BusinessReportPeriod, BusinessReportSummary } from './business-report-types'
import type { Dictionary } from './localization'
import type { MarketProfile } from './market'

export const cashSummaryPath = '/reports/cash'

const periodSchema = z.enum(['today', 'yesterday', 'month', 'previousMonth', 'year', 'previousYear', 'all', 'custom'])
const dateSchema = z.iso.date()

export function cashReportFilter(params: { period?: string; start?: string; end?: string }): BusinessReportFilter {
  const period = periodSchema.safeParse(params.period).data ?? 'today'
  return {
    period,
    startDate: period === 'custom' ? dateSchema.safeParse(params.start).data : undefined,
    endDate: period === 'custom' ? dateSchema.safeParse(params.end).data : undefined,
  }
}

export function cashReportParams(filter: BusinessReportFilter) {
  const params = new URLSearchParams({ period: filter.period })
  if (filter.period === 'custom') {
    if (filter.startDate) params.set('start', filter.startDate)
    if (filter.endDate) params.set('end', filter.endDate)
  }
  return params
}

export function cashReportPeriodLabels(dictionary: Dictionary): Record<BusinessReportPeriod, string> {
  return {
    today: dictionary.today,
    yesterday: dictionary.yesterday,
    month: dictionary.thisMonth,
    previousMonth: dictionary.previousMonth,
    year: dictionary.thisYear,
    previousYear: dictionary.previousYear,
    all: dictionary.allTime,
    custom: dictionary.customRange,
  }
}

type Amounts = { cashMinor: number | null; bankMinor: number | null }
type CashLabels = Dictionary['cashSummary']

export function combinedAmount({ cashMinor, bankMinor }: Amounts) {
  return cashMinor === null || bankMinor === null ? null : cashMinor + bankMinor
}

export function openingBalanceRows(cash: CashReport, dictionary: Dictionary) {
  const { balances } = cash
  if (!balances) return []
  const copy = dictionary.cashSummary
  const opening = balances.carried
  const ending = balances.closing
  const accounts = [
    { key: 'cashMinor', title: copy.openingCash, formula: copy.openingCashFormula,
      labels: [copy.endingCash, copy.openingCash, copy.cashChange] },
    { key: 'bankMinor', title: copy.openingBank, formula: copy.openingBankFormula,
      labels: [copy.endingBank, copy.openingBank, copy.bankChange] },
  ] as const
  return accounts.map(({ key, title, formula, labels: [endingLabel, openingLabel, changeLabel] }) => {
    const start = opening[key]
    const end = ending[key]
    return { key, title, formula, values: [
      { label: endingLabel, value: end },
      { label: openingLabel, value: start },
      { label: changeLabel, value: end - start },
    ] }
  })
}

export function cashSummaryFigures(cash: CashReport, summary: BusinessReportSummary, period: BusinessReportPeriod, dictionary: Dictionary, market: MarketProfile) {
  const copy = dictionary.cashSummary
  const daily = period === 'today' || period === 'yesterday'
  const { activity, balances } = cash
  const withVat = market.taxMode === 'saudiVat'
  const { expensesPaid, payrollPaid, moneyPaidToPeople } = activity.breakdown
  const expenseTotal = 0 - expensesPaid.cashMinor - expensesPaid.bankMinor
  const payrollTotal = 0 - payrollPaid.cashMinor - payrollPaid.bankMinor
  const moneyPaidTotal = 0 - moneyPaidToPeople.cashMinor - moneyPaidToPeople.bankMinor
  const totalPaid = expenseTotal + payrollTotal + moneyPaidTotal
  const totalSalesReceived = combinedAmount(activity.breakdown.salesReceived)
  const profitAfterExpenses = daily ? summary.salesContributionMinor - summary.expenseMinor : summary.operatingProfitMinor
  const salesAfterProductCosts = { label: copy.salesAfterProductCosts, value: summary.grossProfitMinor }
  const productCosts = [
    { label: copy.directProductCosts, value: summary.directCostMinor },
    salesAfterProductCosts,
  ]

  return {
    sales: [
      { label: dictionary.grossSales, value: summary.grossSalesMinor },
      ...(withVat ? [{ label: dictionary.vat, value: summary.vatMinor }] : []),
      { label: dictionary.netSales, value: summary.netSalesMinor },
      { label: withVat ? copy.netCashReceived : copy.cashReceived, value: activity.breakdown.salesReceived.cashMinor },
      { label: withVat ? copy.netBankReceived : copy.bankReceived, value: activity.breakdown.salesReceived.bankMinor },
    ],
    productCosts,
    payments: [
      { label: copy.expensesPaid, value: expenseTotal },
      { label: copy.payrollPaid, value: payrollTotal },
      { label: copy.moneyPaidToPeople, value: moneyPaidTotal },
      { label: dictionary.totalPaid, value: totalPaid },
    ],
    salesAfterPayments: totalSalesReceived === null ? null : totalSalesReceived - totalPaid,
    balance: balances?.closing ?? activity.net,
    profitAfterProductCosts: [
      { label: dictionary.netSales, value: summary.netSalesMinor },
      ...productCosts,
    ],
    profit: [
      salesAfterProductCosts,
      { label: copy.otherExpenses, value: summary.grossProfitMinor - profitAfterExpenses },
      { label: copy.profitAfterExpenses, value: profitAfterExpenses },
    ],
    totalProfitExpenses: summary.netSalesMinor - profitAfterExpenses,
    profitExpenses: [
      { label: copy.employeeCommissions, value: summary.commissionEarnedMinor },
      ...(!daily ? [{ label: dictionary.salaryConfirmed, value: summary.salaryEarnedMinor }] : []),
      { label: dictionary.operatingExpenses, value: summary.expenseMinor },
    ].filter(({ value }) => value !== 0),
    profitNote: daily ? copy.dailyProfitSalaryNote : undefined,
  }
}

type BalanceRow = { label: string; amounts: Amounts; signed?: boolean; total?: boolean }

export function cashBalanceRows(cash: CashReport, copy: CashLabels): BalanceRow[] {
  const { balances, activity } = cash
  const breakdown = balances?.breakdown ?? activity.breakdown
  const opening = balances?.carried
  const amounts = balances?.closing ?? activity.net
  return [
    ...(opening ? [{ label: copy.opening, amounts: opening }] : []),
    {
      label: copy.salesReceived,
      amounts: breakdown.salesReceived,
      signed: true,
    },
    ...(['otherIn', 'expensesPaid', 'payrollPaid', 'moneyPaidToPeople', 'otherOut', 'transfers', 'adjustments', 'ownerPickup'] as const)
      .map((kind) => ({ label: copy[kind], amounts: breakdown[kind], signed: true })),
    { label: balances ? copy.total : copy.netActivity, amounts, total: true },
  ]
}

export function cashClosingFigures(closing: CashClosing, copy: CashLabels) {
  return [
    { label: copy.expectedCash, value: closing.expectedCashMinor },
    { label: copy.actualCash, value: closing.actualCashMinor },
    { label: copy.difference, value: closing.actualCashMinor - closing.expectedCashMinor },
    { label: copy.ownerPickup, value: closing.ownerPickupMinor },
    { label: copy.cashLeftInDrawer, value: closing.actualCashMinor - closing.ownerPickupMinor },
  ]
}

export function bankClosingFigures(closing: CashClosing, copy: CashLabels) {
  const { actualBankMinor, expectedBankMinor, bankPickupMinor } = closing
  if (actualBankMinor == null || expectedBankMinor == null) return []
  return [
    { label: copy.expectedBank, value: expectedBankMinor },
    { label: copy.actualBank, value: actualBankMinor },
    { label: copy.difference, value: actualBankMinor - expectedBankMinor },
    { label: copy.bankWithdrawal, value: bankPickupMinor ?? 0 },
    { label: copy.bankBalanceLeft, value: actualBankMinor - (bankPickupMinor ?? 0) },
  ]
}

export function cashMovementLabels(copy: CashLabels): Record<CashLedger['kind'], string> {
  return {
    opening: copy.opening, sale: copy.cashSale, payment: copy.moneyPayment, expense: copy.paidExpense,
    payroll: copy.payrollPayout, income: copy.income, outflow: copy.outflow, transfer: copy.transfer,
    reconcile: copy.reconcile, correction: copy.correction, ownerPickup: copy.ownerPickup,
  }
}
