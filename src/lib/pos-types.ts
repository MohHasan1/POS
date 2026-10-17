import type { Product } from '@/payload-types'

export type ProductSummary = Pick<
  Product,
  | 'active'
  | 'id'
  | 'nameArabic'
  | 'nameBangla'
  | 'nameEnglish'
  | 'priceIncludesVat'
  | 'priceMinor'
  | 'sku'
  | 'vatCategory'
>

export type BuyerInput = {
  address?: string
  identification?: string
  name?: string
  vatNumber?: string
}

export type CheckoutItemInput = {
  descriptionArabic?: string
  descriptionBangla?: string
  descriptionEnglish?: string
  priceIncludesVat?: boolean
  productId?: string
  quantityMilliunits: number
  unitPriceMinor: number
  vatCategory?: Product['vatCategory']
}

export type FinalizeInvoiceInput = {
  buyer?: BuyerInput
  idempotencyKey: string
  invoiceType: 'simplified' | 'standard'
  items: CheckoutItemInput[]
}
