import config from '@payload-config'
import { getPayload } from 'payload'

import { dateInBusinessRange, resolveBusinessReportPeriod } from '@/lib/business-report-periods'
import type {
  BusinessReport,
  BusinessReportFilter,
  BusinessReportRange,
  BusinessReportSummary,
  BusinessTrendPoint,
  EmployeeBusinessMetric,
  ExpenseBusinessMetric,
  MissingCostLine,
  ProductBusinessMetric,
} from '@/lib/business-report-types'
import { toMarketDateInput } from '@/lib/calendar'
import { marketLocale, type MarketProfile } from '@/lib/market'
import { moneyBalanceAt } from '@/services/money'
import type {
  Employee,
  EmployeeCommissionOverride,
  EmployeePayrollEntry,
  Expense,
  Invoice,
  InvoiceCostOverride,
  MoneyAccount,
  MoneyPayment,
  Product,
} from '@/payload-types'

import { getShopSettings, marketContextFromSettings } from './settings'

type ReportData = {
  commissionOverrides: EmployeeCommissionOverride[]
  costOverrides: InvoiceCostOverride[]
  employees: Employee[]
  expenses: Expense[]
  invoices: Invoice[]
  moneyAccounts?: MoneyAccount[]
  moneyPayments?: MoneyPayment[]
  payrollEntries: EmployeePayrollEntry[]
  products?: Product[]
}

type CalculatedPeriod = {
  employeeMetrics: EmployeeBusinessMetric[]
  expenseMetrics: ExpenseBusinessMetric[]
  missingCostLines: number
  productMetrics: ProductBusinessMetric[]
  summary: BusinessReportSummary
  trend: BusinessTrendPoint[]
}

type TrendGranularity = 'day' | 'hour' | 'month' | 'year'

function relationshipId(value: { id: string } | null | string | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.id
}

function emptySummary(): BusinessReportSummary {
  return {
    averageInvoiceMinor: 0,
    billPaidMinor: 0,
    billUnpaidMinor: 0,
    capitalExpenseMinor: 0,
    commissionEarnedMinor: 0,
    directCostMinor: 0,
    expenseMinor: 0,
    fixedExpenseMinor: 0,
    grossProfitMinor: 0,
    grossSalesMinor: 0,
    invoiceCount: 0,
    netSalesMinor: 0,
    operatingProfitMinor: 0,
    owedToUsMinor: 0,
    payrollPaidMinor: 0,
    profitMarginBps: 0,
    salesContributionMinor: 0,
    salaryEarnedMinor: 0,
    totalCompensationMinor: 0,
    variableExpenseMinor: 0,
    vatMinor: 0,
    weOweMinor: 0,
  }
}

function trendBucket(
  value: string,
  granularity: TrendGranularity,
  market: MarketProfile,
  displayLocale: string,
) {
  const date = new Date(value)
  const dateInput = toMarketDateInput(date, market)
  if (granularity === 'hour') {
    const hour = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: market.timeZone,
    }).format(date)
    return {
      key: `${dateInput}T${hour}`,
      label: new Intl.DateTimeFormat(displayLocale, {
        hour: 'numeric',
        timeZone: market.timeZone,
      }).format(date),
    }
  }
  if (granularity === 'day') {
    return {
      key: dateInput,
      label: new Intl.DateTimeFormat(displayLocale, {
        day: 'numeric',
        month: 'short',
        timeZone: market.timeZone,
      }).format(date),
    }
  }
  if (granularity === 'month') {
    return {
      key: dateInput.slice(0, 7),
      label: new Intl.DateTimeFormat(displayLocale, {
        month: 'short',
        year: 'numeric',
        timeZone: market.timeZone,
      }).format(date),
    }
  }
  return { key: dateInput.slice(0, 4), label: dateInput.slice(0, 4) }
}

function trendGranularity(
  data: ReportData,
  filter: BusinessReportFilter,
  range: BusinessReportRange,
): TrendGranularity {
  if (filter.period === 'today' || filter.period === 'yesterday') return 'hour'
  if (filter.period === 'month' || filter.period === 'previousMonth') return 'day'
  if (filter.period === 'year' || filter.period === 'previousYear') return 'month'
  if (filter.period === 'all') {
    const dates = [
      ...data.invoices.map(({ issuedAt }) => issuedAt),
      ...data.payrollEntries.map(({ entryDate }) => entryDate),
      ...data.expenses.flatMap(({ billDate, recordType, status }) =>
        status === 'confirmed' && recordType !== 'capital' ? [billDate] : [],
      ),
    ]
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite)
    if (dates.length < 2) return 'month'
    return Math.max(...dates) - Math.min(...dates) <= 730 * 86_400_000 ? 'month' : 'year'
  }
  const duration =
    range.start && range.end ? new Date(range.end).getTime() - new Date(range.start).getTime() : 0
  if (duration <= 2 * 86_400_000) return 'hour'
  if (duration <= 95 * 86_400_000) return 'day'
  if (duration <= 730 * 86_400_000) return 'month'
  return 'year'
}

function calculatePeriod(
  data: ReportData,
  range: BusinessReportRange,
  market: MarketProfile,
  granularity: TrendGranularity,
  employeeFilter?: string,
  displayLocale = market.locale,
): CalculatedPeriod {
  const summary = emptySummary()
  const commissionByItem = new Map(
    data.commissionOverrides.map((override) => [
      override.invoiceItemId,
      override.correctedAmountMinor,
    ]),
  )
  const costByItem = new Map(
    data.costOverrides.map((override) => [override.invoiceItemId, override]),
  )
  const employeeNames = new Map(data.employees.map((employee) => [employee.id, employee.name]))
  const productCosts = new Map(
    (data.products || []).map((product) => [product.id, product.unitCostMinor ?? 0]),
  )
  const employeeMetrics = new Map<string, EmployeeBusinessMetric>()
  const productMetrics = new Map<string, ProductBusinessMetric>()
  const expenseMetrics = new Map<string, ExpenseBusinessMetric>()
  const trend = new Map<string, BusinessTrendPoint>()
  let missingCostLines = 0

  const ensureEmployee = (employeeId?: string, fallbackName?: string) => {
    const key = employeeId || '__unassigned__'
    const existing = employeeMetrics.get(key)
    if (existing) return existing
    const created: EmployeeBusinessMetric = {
      commissionMinor: 0,
      compensationMinor: 0,
      contributionMinor: 0,
      directCostMinor: 0,
      employeeId,
      employeeName:
        fallbackName || (employeeId ? employeeNames.get(employeeId) : undefined) || 'Unassigned',
      invoiceCount: 0,
      outstandingMinor: 0,
      paidMinor: 0,
      salesContributionMinor: 0,
      salaryMinor: 0,
      salesMinor: 0,
    }
    employeeMetrics.set(key, created)
    return created
  }

  const ensureTrend = (date: string) => {
    const bucket = trendBucket(date, granularity, market, displayLocale)
    const existing = trend.get(bucket.key)
    if (existing) return existing
    const created: BusinessTrendPoint = {
      directCostMinor: 0,
      expenseMinor: 0,
      grossSalesMinor: 0,
      key: bucket.key,
      label: bucket.label,
      netSalesMinor: 0,
      operatingProfitMinor: 0,
      payrollMinor: 0,
      salesContributionMinor: 0,
    }
    trend.set(bucket.key, created)
    return created
  }

  for (const invoice of data.invoices) {
    const employeeId = relationshipId(invoice.employee)
    if (employeeFilter && employeeId !== employeeFilter) continue
    if (!dateInBusinessRange(invoice.issuedAt, range)) continue
    summary.invoiceCount += 1
    summary.grossSalesMinor += invoice.totalMinor
    summary.vatMinor += invoice.vatMinor
    const employee = ensureEmployee(employeeId, invoice.employeeSnapshot?.name || undefined)
    employee.invoiceCount += 1
    const invoiceTrend = ensureTrend(invoice.issuedAt)
    invoiceTrend.grossSalesMinor += invoice.totalMinor

    for (const item of invoice.items) {
      summary.netSalesMinor += item.netMinor
      employee.salesMinor += item.netMinor
      invoiceTrend.netSalesMinor += item.netMinor
      invoiceTrend.salesContributionMinor += item.netMinor
      const itemId = item.id
      const productId = relationshipId(item.product)
      const override = itemId ? costByItem.get(itemId) : undefined
      const currentProductUnitCost = productId ? productCosts.get(productId) : undefined
      const currentProductTotalCost =
        currentProductUnitCost === undefined
          ? undefined
          : Math.round((currentProductUnitCost * item.quantityMilliunits) / 1_000)
      const totalCost =
        override?.totalCostMinor ?? item.cost?.totalCostMinor ?? currentProductTotalCost
      const knownCost = totalCost !== undefined && totalCost !== null
      if (knownCost) {
        summary.directCostMinor += totalCost
        employee.directCostMinor += totalCost
        invoiceTrend.directCostMinor += totalCost
        invoiceTrend.salesContributionMinor -= totalCost
      } else {
        missingCostLines += 1
      }
      const commission =
        (itemId ? commissionByItem.get(itemId) : undefined) ?? item.commission?.amountMinor ?? 0
      summary.commissionEarnedMinor += commission
      employee.commissionMinor += commission
      invoiceTrend.payrollMinor += commission
      invoiceTrend.salesContributionMinor -= commission
      const productKey =
        productId || `${item.descriptionEnglish}\u0000${item.descriptionArabic || ''}`
      const product = productMetrics.get(productKey) || {
        commissionMinor: 0,
        contributionMinor: 0,
        directCostMinor: 0,
        grossProfitMinor: 0,
        knownCostRevenueMinor: 0,
        missingCostLines: 0,
        nameArabic: item.descriptionArabic || undefined,
        nameBangla: item.descriptionBangla || undefined,
        nameEnglish: item.descriptionEnglish,
        netRevenueMinor: 0,
        productId,
        quantityMilliunits: 0,
      }
      product.quantityMilliunits += item.quantityMilliunits
      product.netRevenueMinor += item.netMinor
      product.directCostMinor += knownCost ? totalCost : 0
      product.knownCostRevenueMinor += knownCost ? item.netMinor : 0
      product.commissionMinor += commission
      product.missingCostLines += knownCost ? 0 : 1
      productMetrics.set(productKey, product)
    }
  }

  for (const entry of data.payrollEntries) {
    const employeeId = relationshipId(entry.employee)
    if (!employeeId || (employeeFilter && employeeId !== employeeFilter)) continue
    if (!dateInBusinessRange(entry.entryDate, range)) continue
    const employee = ensureEmployee(employeeId, entry.employeeSnapshot.name)
    const point = ensureTrend(entry.entryDate)
    if (entry.entryType === 'monthlySalary') {
      summary.salaryEarnedMinor += entry.amountMinor
      employee.salaryMinor += entry.amountMinor
      point.payrollMinor += entry.amountMinor
    } else {
      summary.payrollPaidMinor += entry.amountMinor
      employee.paidMinor += entry.amountMinor
    }
  }

  for (const expense of data.expenses) {
    if (expense.status !== 'confirmed' || !dateInBusinessRange(expense.billDate, range)) continue
    if (expense.paymentStatus === 'paid') summary.billPaidMinor += expense.totalMinor
    else summary.billUnpaidMinor += expense.totalMinor
    const categoryName = expense.categorySnapshot.name
    const metric = expenseMetrics.get(categoryName) || {
      capitalMinor: 0,
      categoryName,
      fixedMinor: 0,
      netMinor: 0,
      paidTotalMinor: 0,
      unpaidTotalMinor: 0,
      variableMinor: 0,
    }
    metric.netMinor += expense.netMinor
    if (expense.recordType === 'capital') {
      summary.capitalExpenseMinor += expense.netMinor
      metric.capitalMinor += expense.netMinor
    } else {
      summary.expenseMinor += expense.netMinor
      if (expense.recordType === 'fixed') {
        summary.fixedExpenseMinor += expense.netMinor
        metric.fixedMinor += expense.netMinor
      } else {
        summary.variableExpenseMinor += expense.netMinor
        metric.variableMinor += expense.netMinor
      }
      ensureTrend(expense.billDate).expenseMinor += expense.netMinor
    }
    if (expense.paymentStatus === 'paid') metric.paidTotalMinor += expense.totalMinor
    else metric.unpaidTotalMinor += expense.totalMinor
    expenseMetrics.set(categoryName, metric)
  }

  const allTimeOutstanding = new Map<string, number>()
  for (const entry of data.payrollEntries) {
    const employeeId = relationshipId(entry.employee)
    if (!employeeId) continue
    const direction = entry.entryType === 'monthlySalary' ? 1 : -1
    allTimeOutstanding.set(
      employeeId,
      (allTimeOutstanding.get(employeeId) || 0) + direction * entry.amountMinor,
    )
  }
  for (const invoice of data.invoices) {
    const employeeId = relationshipId(invoice.employee)
    if (!employeeId) continue
    for (const item of invoice.items) {
      const amount =
        (item.id ? commissionByItem.get(item.id) : undefined) ?? item.commission?.amountMinor ?? 0
      allTimeOutstanding.set(employeeId, (allTimeOutstanding.get(employeeId) || 0) + amount)
    }
  }

  for (const employee of employeeMetrics.values()) {
    employee.salesContributionMinor =
      employee.salesMinor - employee.directCostMinor - employee.commissionMinor
    employee.compensationMinor = employee.salaryMinor + employee.commissionMinor
    employee.contributionMinor =
      employee.salesMinor - employee.directCostMinor - employee.compensationMinor
    employee.outstandingMinor = employee.employeeId
      ? allTimeOutstanding.get(employee.employeeId) || 0
      : 0
  }
  for (const product of productMetrics.values()) {
    product.grossProfitMinor = product.netRevenueMinor - product.directCostMinor
    product.contributionMinor = product.grossProfitMinor - product.commissionMinor
  }
  for (const point of trend.values()) {
    point.operatingProfitMinor =
      point.netSalesMinor - point.directCostMinor - point.payrollMinor - point.expenseMinor
  }

  summary.totalCompensationMinor = summary.salaryEarnedMinor + summary.commissionEarnedMinor
  summary.grossProfitMinor = summary.netSalesMinor - summary.directCostMinor
  summary.salesContributionMinor = summary.grossProfitMinor - summary.commissionEarnedMinor
  summary.averageInvoiceMinor = summary.invoiceCount
    ? Math.round(summary.grossSalesMinor / summary.invoiceCount)
    : 0
  summary.operatingProfitMinor =
    summary.grossProfitMinor - summary.totalCompensationMinor - summary.expenseMinor
  summary.owedToUsMinor = moneyBalanceAt(
    data.moneyAccounts || [],
    data.moneyPayments || [],
    'owedToUs',
    range.end,
  )
  summary.weOweMinor = moneyBalanceAt(
    data.moneyAccounts || [],
    data.moneyPayments || [],
    'weOwe',
    range.end,
  )
  summary.profitMarginBps = summary.netSalesMinor
    ? Math.round((summary.operatingProfitMinor * 10_000) / summary.netSalesMinor)
    : 0

  return {
    employeeMetrics: [...employeeMetrics.values()].sort(
      (a, b) => b.salesMinor - a.salesMinor || a.employeeName.localeCompare(b.employeeName),
    ),
    expenseMetrics: [...expenseMetrics.values()].sort(
      (a, b) => b.netMinor - a.netMinor || a.categoryName.localeCompare(b.categoryName),
    ),
    missingCostLines,
    productMetrics: [...productMetrics.values()].sort(
      (a, b) => b.netRevenueMinor - a.netRevenueMinor || a.nameEnglish.localeCompare(b.nameEnglish),
    ),
    summary,
    trend: [...trend.values()].sort((a, b) => a.key.localeCompare(b.key)),
  }
}

function salaryMonthsInRange(
  range: BusinessReportRange,
  market: MarketProfile,
  now: Date,
  employeeCreatedAt: string,
): string[] {
  const endTime = range.end
    ? Math.min(new Date(range.end).getTime() - 1, now.getTime())
    : now.getTime()
  const endMonth = toMarketDateInput(new Date(endTime), market).slice(0, 7)
  const rangeStartMonth = range.start
    ? toMarketDateInput(range.start, market).slice(0, 7)
    : undefined
  const createdMonth = toMarketDateInput(employeeCreatedAt, market).slice(0, 7)
  const startMonth =
    rangeStartMonth && rangeStartMonth > createdMonth ? rangeStartMonth : createdMonth
  const values: string[] = []
  let [year, month] = startMonth.split('-').map(Number)
  while (`${year}-${String(month).padStart(2, '0')}` <= endMonth) {
    values.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return values
}

function unconfirmedSalaryCount(
  data: ReportData,
  range: BusinessReportRange,
  market: MarketProfile,
  now: Date,
  employeeFilter?: string,
): number {
  const posted = new Set(
    data.payrollEntries.flatMap((entry) => {
      const employeeId = relationshipId(entry.employee)
      return entry.entryType === 'monthlySalary' && employeeId && entry.salaryMonth
        ? [`${employeeId}:${entry.salaryMonth}`]
        : []
    }),
  )
  let count = 0
  for (const employee of data.employees) {
    if (!employee.active || employee.compensationType !== 'monthly') continue
    if (employeeFilter && employee.id !== employeeFilter) continue
    for (const month of salaryMonthsInRange(range, market, now, employee.createdAt)) {
      if (!posted.has(`${employee.id}:${month}`)) count += 1
    }
  }
  return count
}

function salesInRange(data: ReportData, range: BusinessReportRange): BusinessReport['sales'] {
  const employeeNames = new Map(data.employees.map((employee) => [employee.id, employee.name]))
  return data.invoices
    .filter(({ issuedAt }) => dateInBusinessRange(issuedAt, range))
    .map((invoice) => {
      const employeeId = relationshipId(invoice.employee)
      return {
        employeeName:
          invoice.employeeSnapshot?.name ||
          (employeeId ? employeeNames.get(employeeId) : undefined) ||
          undefined,
        entrySource: invoice.entrySource || 'live',
        invoiceId: invoice.id || invoice.invoiceNumber || '',
        invoiceNumber: invoice.invoiceNumber || invoice.id || '',
        issuedAt: invoice.issuedAt,
        items: invoice.items.map((item) => ({
          nameArabic: item.descriptionArabic || undefined,
          nameBangla: item.descriptionBangla || undefined,
          nameEnglish: item.descriptionEnglish,
          quantityMilliunits: item.quantityMilliunits,
          totalMinor: item.totalMinor ?? item.netMinor,
        })),
        netMinor: invoice.items.reduce((total, item) => total + item.netMinor, 0),
        salesChannel: invoice.salesChannel || 'checkout',
        totalMinor: invoice.totalMinor,
        vatMinor: invoice.vatMinor,
      }
    })
    .sort(
      (a, b) =>
        a.issuedAt.localeCompare(b.issuedAt) || a.invoiceNumber.localeCompare(b.invoiceNumber),
    )
}

export function buildBusinessReport(
  data: ReportData,
  filter: BusinessReportFilter,
  market: MarketProfile,
  secondaryLanguage: BusinessReport['secondaryLanguage'],
  now = new Date(),
  displayLocale = market.locale,
  businessName = 'QuickPOS',
  includeSales = true,
): BusinessReport {
  const ranges = resolveBusinessReportPeriod(filter, market, now)
  const granularity = trendGranularity(data, filter, ranges.selected)
  const selected = calculatePeriod(
    data,
    ranges.selected,
    market,
    granularity,
    undefined,
    displayLocale,
  )
  const detail = filter.employeeId
    ? calculatePeriod(data, ranges.selected, market, granularity, filter.employeeId, displayLocale)
    : selected
  const knownRevenue = selected.productMetrics.reduce(
    (total, product) => total + product.knownCostRevenueMinor,
    0,
  )
  const comparison = ranges.comparison
    ? calculatePeriod(data, ranges.comparison, market, granularity, undefined, displayLocale)
    : undefined
  const isDaily = filter.period === 'today' || filter.period === 'yesterday'
  const employeeMetrics = isDaily
    ? detail.employeeMetrics.filter(
        ({ commissionMinor, invoiceCount, salesMinor }) =>
          invoiceCount > 0 || salesMinor !== 0 || commissionMinor !== 0,
      )
    : detail.employeeMetrics
  const trend = isDaily
    ? selected.trend.filter(
        ({ grossSalesMinor, netSalesMinor }) => grossSalesMinor !== 0 || netSalesMinor !== 0,
      )
    : selected.trend
  return {
    businessName,
    comparison: comparison ? { range: ranges.comparison!, summary: comparison.summary } : undefined,
    employeeMetrics,
    expenseMetrics: selected.expenseMetrics,
    filter,
    generatedAt: now.toISOString(),
    market,
    productMetrics: detail.productMetrics,
    range: ranges.selected,
    sales: includeSales ? salesInRange(data, ranges.selected) : [],
    secondaryLanguage,
    summary: selected.summary,
    trend,
    warnings: {
      costCoverageBps: selected.summary.netSalesMinor
        ? Math.round((knownRevenue * 10_000) / selected.summary.netSalesMinor)
        : 10_000,
      missingCostLines: selected.missingCostLines,
      unconfirmedSalaryCount: unconfirmedSalaryCount(data, ranges.selected, market, now),
    },
  }
}

async function allInvoices(): Promise<Invoice[]> {
  const payload = await getPayload({ config })
  const values: Invoice[] = []
  let page = 1
  let totalPages = 1
  do {
    const result = await payload.find({
      collection: 'invoices',
      depth: 0,
      limit: 500,
      page,
      sort: '-issuedAt',
    })
    values.push(...result.docs)
    totalPages = result.totalPages
    page += 1
  } while (page <= totalPages)
  return values
}

export async function getBusinessReport(
  filter: BusinessReportFilter,
  interfaceLocale: 'bn' | 'en' = 'en',
  includeSales = false,
): Promise<BusinessReport> {
  const payload = await getPayload({ config })
  const [
    invoices,
    payroll,
    commissionOverrides,
    costOverrides,
    expenses,
    employees,
    products,
    moneyAccounts,
    moneyPayments,
    settings,
  ] = await Promise.all([
    allInvoices(),
    payload.find({ collection: 'employee-payroll-entries', depth: 0, pagination: false }),
    payload.find({ collection: 'employee-commission-overrides', depth: 0, pagination: false }),
    payload.find({ collection: 'invoice-cost-overrides', depth: 0, pagination: false }),
    payload.find({ collection: 'expenses', depth: 0, pagination: false }),
    payload.find({ collection: 'employees', depth: 0, pagination: false }),
    payload.find({ collection: 'products', depth: 0, pagination: false }),
    payload.find({ collection: 'money-accounts', depth: 0, pagination: false }),
    payload.find({ collection: 'money-payments', depth: 0, pagination: false }),
    getShopSettings(),
  ])
  const market = marketContextFromSettings(settings)
  return buildBusinessReport(
    {
      commissionOverrides: commissionOverrides.docs,
      costOverrides: costOverrides.docs,
      employees: employees.docs,
      expenses: expenses.docs,
      invoices,
      moneyAccounts: moneyAccounts.docs,
      moneyPayments: moneyPayments.docs,
      payrollEntries: payroll.docs,
      products: products.docs,
    },
    filter,
    market.profile,
    market.secondaryLanguage,
    new Date(),
    marketLocale(market.profile, interfaceLocale),
    settings.sellerNameEnglish || 'QuickPOS',
    includeSales,
  )
}

export async function getMissingCostLines(): Promise<MissingCostLine[]> {
  const payload = await getPayload({ config })
  const [invoices, overrides, products] = await Promise.all([
    allInvoices(),
    payload.find({ collection: 'invoice-cost-overrides', pagination: false }),
    payload.find({ collection: 'products', depth: 0, pagination: false }),
  ])
  const overridden = new Set(overrides.docs.map(({ invoiceItemId }) => invoiceItemId))
  const currentProducts = new Set(products.docs.map(({ id }) => id))
  return invoices.flatMap((invoice) =>
    invoice.items.flatMap((item) => {
      const hasSavedCost =
        item.cost?.totalCostMinor !== undefined && item.cost.totalCostMinor !== null
      const productId = relationshipId(item.product)
      const hasCurrentProductCost = productId ? currentProducts.has(productId) : false
      if (!item.id || hasSavedCost || hasCurrentProductCost || overridden.has(item.id)) return []
      return [
        {
          invoiceId: invoice.id,
          invoiceItemId: item.id,
          invoiceNumber: invoice.invoiceNumber,
          issuedAt: invoice.issuedAt,
          nameEnglish: item.descriptionEnglish,
          productId,
          quantityMilliunits: item.quantityMilliunits,
        },
      ]
    }),
  )
}

export async function upsertInvoiceCostOverride(input: {
  invoiceId: string
  invoiceItemId: string
  note?: string
  unitCostMinor: number
}): Promise<InvoiceCostOverride> {
  if (!Number.isSafeInteger(input.unitCostMinor) || input.unitCostMinor < 0) {
    throw new Error('Enter a valid unit cost.')
  }
  const payload = await getPayload({ config })
  const invoice = await payload.findByID({ collection: 'invoices', id: input.invoiceId, depth: 0 })
  const item = invoice.items.find(({ id }) => id === input.invoiceItemId)
  if (!item) throw new Error('The invoice line could not be found.')
  const existing = await payload.find({
    collection: 'invoice-cost-overrides',
    limit: 1,
    where: { invoiceItemId: { equals: input.invoiceItemId } },
  })
  const data = {
    invoice: invoice.id,
    invoiceItemId: input.invoiceItemId,
    note: input.note?.trim() || undefined,
    product: relationshipId(item.product),
    totalCostMinor: Math.round((input.unitCostMinor * item.quantityMilliunits) / 1_000),
    unitCostMinor: input.unitCostMinor,
  }
  return existing.docs[0]
    ? payload.update({ collection: 'invoice-cost-overrides', id: existing.docs[0].id, data })
    : payload.create({ collection: 'invoice-cost-overrides', data })
}
