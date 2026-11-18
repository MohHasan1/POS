import type { ProductSummary } from './pos-types'
import type { MarketProfile, SecondaryLanguage } from './market'

export type ServiceBoardCard = {
  customerName?: string
  customerPhone?: string
  employeeName?: string
  invoiceId: string
  invoiceNumber: string
  issuedAt: string
  note?: string
  productId: string
  quantityMilliunits: number
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
