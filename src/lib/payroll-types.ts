import type { MarketProfile } from './market'

export type CompensationType = 'unconfigured' | 'monthly' | 'commission'
export type PayrollPaymentMethod = 'cash' | 'bank' | 'other'
export type PayrollPeriodMode = 'day' | 'month' | 'year' | 'all'

export type PayrollPeriodFilter = {
  employeeId?: string
  mode: PayrollPeriodMode
  value?: string
}

export type PayrollMetrics = {
  commissionEarnedMinor: number
  currentBalanceMinor: number
  fixedEarnedMinor: number
  paidMinor: number
  periodBalanceMinor: number
  totalEarnedMinor: number
}

export type PayrollEmployeeSummary = PayrollMetrics & {
  compensationType: CompensationType
  employeeId: string
  employeeName: string
  salaryConfirmedForActionMonth: boolean
  salesGeneratedMinor: number
}

export type PayrollCommissionBreakdown = {
  amountMinor: number
  serviceName: string
}

export type PayrollActivity = {
  amountMinor: number
  correctedAmountMinor?: number
  date: string
  employeeId: string
  employeeName: string
  id: string
  invoiceId?: string
  invoiceItemId?: string
  invoiceNumber?: string
  kind: 'commission' | 'monthlySalary' | 'payout'
  note?: string
  paymentMethod?: PayrollPaymentMethod
  reference?: string
  salaryMonth?: string
  serviceName?: string
}

export type PayrollDashboard = {
  activities: PayrollActivity[]
  commissionBreakdown: PayrollCommissionBreakdown[]
  employeeSummaries: PayrollEmployeeSummary[]
  filter: PayrollPeriodFilter
  market: MarketProfile
  metrics: PayrollMetrics
  salaryActionMonth: string
}
