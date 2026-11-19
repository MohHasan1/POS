import type { MarketProfile } from './market'

export type ExpenseFrequency = 'weekly' | 'monthly' | 'yearly'
export type ExpensePaymentMethod = 'bank' | 'cash' | 'other'
export type ExpensePaymentStatus = 'paid' | 'unpaid'
export type ManualExpenseRecordType = 'capital' | 'variable'

export type ExpenseTemplateInput = {
  active: boolean
  categoryId: string
  defaultTotalMinor: number
  defaultVatMinor: number
  endDate?: string
  frequency: ExpenseFrequency
  monthlyDay?: number
  name: string
  note?: string
  startDate: string
  vendor?: string
  weeklyDay?: number
  yearlyDay?: number
  yearlyMonth?: number
}

export type ExpenseRecordInput = {
  billDate: string
  categoryId: string
  idempotencyKey: string
  name: string
  note?: string
  paidAt?: string
  paymentMethod?: ExpensePaymentMethod
  paymentStatus: ExpensePaymentStatus
  reference?: string
  totalMinor: number
  vatMinor: number
  vendor?: string
}

export type ManualExpenseRecordInput = ExpenseRecordInput & {
  recordType: ManualExpenseRecordType
}

export type DueExpenseOccurrence = {
  categoryId: string
  categoryName: string
  dueDate: string
  market: MarketProfile
  name: string
  note?: string
  templateId: string
  totalMinor: number
  vatMinor: number
  vendor?: string
}
