import type { Employee, Product } from '@/payload-types'

export const DEFAULT_INVOICE_ADDRESS = 'Riyadh, Saudi Arabia'

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
  | 'translations'
  | 'vatCategory'
>

export type EmployeeSummary = Pick<
  Employee,
  'active' | 'compensationType' | 'employeeCode' | 'id' | 'name' | 'role'
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
  translations?: Array<{ language: string; name: string }>
}

export type FinalizeInvoiceInput = {
  buyer?: BuyerInput
  employeeId?: string | null
  idempotencyKey: string
  invoiceType: 'sales' | 'simplified' | 'standard'
  items: CheckoutItemInput[]
}
