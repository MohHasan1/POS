import type { MarketProfile } from './market'
import type { MoneyAccount, MoneyPayment, MoneyPerson } from '@/payload-types'

export type MoneyDirection = 'owedToUs' | 'weOwe'
export type MoneyKind =
  | 'borrowedMoney'
  | 'moneyLent'
  | 'other'
  | 'supplierCredit'
  | 'unpaidInvoice'
export type MoneyPaymentMethod = 'bank_transfer' | 'cash' | 'cheque' | 'other'
export type MoneyDerivedStatus = 'open' | 'overdue' | 'paid' | 'voided'
export type InvoicePaymentStatus = 'paid' | 'partial' | 'unpaid'

export type InitialSalePaymentInput = {
  amountMinor: number
  bankName?: string
  chequeDate?: string
  chequeNumber?: string
  idempotencyKey: string
  otherDescription?: string
  otherReference?: string
  paymentMethod: MoneyPaymentMethod
  reference?: string
  transactionReference?: string
  transferDate?: string
}

export type SaleSettlementInput = {
  accountIdempotencyKey: string
  initialPayment?: InitialSalePaymentInput
  personId: string
}

export type InvoicePaymentSummary = {
  paidMinor: number
  personName?: string
  remainingMinor: number
  status: InvoicePaymentStatus
}

export type MoneyProductInput = {
  productId: string
  quantityMilliunits: number
  unitPriceMinor?: number
}

export type MoneyAccountInput = {
  direction: MoneyDirection
  dueDate?: string
  idempotencyKey: string
  invoiceId?: string
  kind: MoneyKind
  note?: string
  originalAmountMinor?: number
  personId: string
  products?: MoneyProductInput[]
  recordDate: string
  reference?: string
}

export type MoneyAccountUpdateInput = Omit<
  MoneyAccountInput,
  'direction' | 'idempotencyKey' | 'invoiceId'
>

export type MoneyPaymentInput = {
  accountId: string
  amountMinor: number
  bankName?: string
  chequeDate?: string
  chequeNumber?: string
  createReceiptVoucher?: boolean
  idempotencyKey: string
  note?: string
  otherDescription?: string
  otherReference?: string
  paymentDate: string
  paymentMethod: MoneyPaymentMethod
  reference?: string
  transactionReference?: string
  transferDate?: string
}

export type MoneyAccountView = {
  account: MoneyAccount
  derivedStatus: MoneyDerivedStatus
  paidMinor: number
  payments: MoneyPayment[]
  remainingMinor: number
}

export type MoneyPersonBalance = {
  openRecords: number
  person: MoneyPerson
  remainingMinor: number
}

export type MoneySummary = {
  openRecords: number
  overdueMinor: number
  paidMinor: number
  remainingMinor: number
}

export type MoneyDashboard = {
  accounts: MoneyAccountView[]
  market: MarketProfile
  people: MoneyPerson[]
  personBalances: MoneyPersonBalance[]
  summary: MoneySummary
}

export type MoneyInvoiceOption = {
  customerName?: string
  id: string
  invoiceNumber: string
  issuedAt: string
  totalMinor: number
}
