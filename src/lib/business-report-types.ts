import type { MarketProfile, SecondaryLanguage } from './market'

export type BusinessReportPeriod =
  'all' | 'custom' | 'month' | 'previousMonth' | 'previousYear' | 'today' | 'year' | 'yesterday'

export type BusinessReportFilter = {
  employeeId?: string
  endDate?: string
  period: BusinessReportPeriod
  startDate?: string
}

export type BusinessReportRange = {
  end?: string
  start?: string
}

export type BusinessReportSummary = {
  averageInvoiceMinor: number
  billPaidMinor: number
  billUnpaidMinor: number
  capitalExpenseMinor: number
  commissionEarnedMinor: number
  directCostMinor: number
  expenseMinor: number
  fixedExpenseMinor: number
  grossProfitMinor: number
  grossSalesMinor: number
  invoiceCount: number
  netSalesMinor: number
  operatingProfitMinor: number
  owedToUsMinor: number
  payrollPaidMinor: number
  profitMarginBps: number
  salesContributionMinor: number
  salaryEarnedMinor: number
  totalCompensationMinor: number
  variableExpenseMinor: number
  vatMinor: number
  weOweMinor: number
}

export type BusinessReportComparison = {
  range: BusinessReportRange
  summary: BusinessReportSummary
}

export type EmployeeBusinessMetric = {
  commissionMinor: number
  compensationMinor: number
  contributionMinor: number
  directCostMinor: number
  employeeId?: string
  employeeName: string
  invoiceCount: number
  outstandingMinor: number
  paidMinor: number
  salesContributionMinor: number
  salaryMinor: number
  salesMinor: number
}

export type ProductBusinessMetric = {
  commissionMinor: number
  contributionMinor: number
  directCostMinor: number
  grossProfitMinor: number
  knownCostRevenueMinor: number
  missingCostLines: number
  nameArabic?: string
  nameBangla?: string
  nameEnglish: string
  netRevenueMinor: number
  productId?: string
  quantityMilliunits: number
}

export type ExpenseBusinessMetric = {
  capitalMinor: number
  categoryName: string
  fixedMinor: number
  netMinor: number
  paidTotalMinor: number
  unpaidTotalMinor: number
  variableMinor: number
}

export type BusinessTrendPoint = {
  directCostMinor: number
  expenseMinor: number
  grossSalesMinor: number
  key: string
  label: string
  netSalesMinor: number
  operatingProfitMinor: number
  payrollMinor: number
  salesContributionMinor: number
}

export type BusinessReportWarnings = {
  costCoverageBps: number
  missingCostLines: number
  unconfirmedSalaryCount: number
}

export type BusinessReportSaleItem = {
  nameArabic?: string
  nameBangla?: string
  nameEnglish: string
  quantityMilliunits: number
  totalMinor: number
}

export type BusinessReportSale = {
  employeeName?: string
  entrySource: 'live' | 'paperBackfill'
  invoiceId: string
  invoiceNumber: string
  issuedAt: string
  items: BusinessReportSaleItem[]
  netMinor: number
  salesChannel: 'checkout' | 'serviceBoard'
  totalMinor: number
  vatMinor: number
}

export type BusinessReport = {
  businessName: string
  comparison?: BusinessReportComparison
  employeeMetrics: EmployeeBusinessMetric[]
  expenseMetrics: ExpenseBusinessMetric[]
  filter: BusinessReportFilter
  generatedAt: string
  market: MarketProfile
  productMetrics: ProductBusinessMetric[]
  range: BusinessReportRange
  sales: BusinessReportSale[]
  secondaryLanguage: SecondaryLanguage
  summary: BusinessReportSummary
  trend: BusinessTrendPoint[]
  warnings: BusinessReportWarnings
}

export type MissingCostLine = {
  invoiceId: string
  invoiceItemId: string
  invoiceNumber: string
  issuedAt: string
  nameEnglish: string
  productId?: string
  quantityMilliunits: number
}
