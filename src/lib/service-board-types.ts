import type { ProductSummary } from './pos-types'
import type { MarketProfile, SecondaryLanguage } from './market'
import type { InvoicePaymentStatus } from './money-types'

export type ServiceBoardCard = {
  customerName?: string
  customerPhone?: string
  employeeName?: string
  entrySource?: 'live' | 'paperBackfill'
  externalReference?: string
  invoiceId: string
  invoiceNumber: string
  issuedAt: string
  issuedAtPrecision?: 'dateOnly' | 'exact' | null
  note?: string
  paidMinor: number
  paymentStatus: InvoicePaymentStatus
  productId: string
  quantityMilliunits: number
  remainingMinor: number
  totalMinor: number
  unitPriceMinor: number
}

export type ServiceBoardColumn = {
  cards: ServiceBoardCard[]
  product: ProductSummary
  summary: {
    todayQuantityMilliunits: number
    todayRevenueMinor: number
  }
}

export type ServiceBoardSummary = {
  allSalesTodayMinor: number
  distinctVisits: number
  mostPopularService?: {
    nameArabic?: string
    nameBangla?: string
    nameEnglish: string
    productId: string
    quantityMilliunits: number
  }
  moneyReceivedMinor: number
  moneyToReceiveMinor: number
  visibleServiceRevenueMinor: number
}

export type ServiceBoardView = {
  columns: ServiceBoardColumn[]
  market: MarketProfile
  secondaryLanguage: SecondaryLanguage
  summary: ServiceBoardSummary
}

export type SalesPeriodMetric = {
  averageMinor: number
  invoiceCount: number
  totalMinor: number
}

export type TopServiceMetric = {
  nameArabic?: string
  nameBangla?: string
  nameEnglish: string
  quantityMilliunits: number
  revenueMinor: number
}

export type SalesDashboard = {
  allTime: SalesPeriodMetric
  month: SalesPeriodMetric
  today: SalesPeriodMetric
  topServices: TopServiceMetric[]
  year: SalesPeriodMetric
  market: MarketProfile
  secondaryLanguage: SecondaryLanguage
}
