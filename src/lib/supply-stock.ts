import type { ExpensePaymentMethod, ExpensePaymentStatus } from './expense-types'
import type { SupplyPurchase } from '@/payload-types'

export const SUPPLY_CATALOG_PAGE_SIZE = 12
export const SUPPLY_HISTORY_PAGE_SIZE = 20

export type SupplyPurchaseInput = {
  name: string
  purchasedOn: string
  quantity: number
  unitCostMinor: number | null
  vendor?: string
  notes?: string
  expense?: {
    categoryId: string
    paymentStatus: ExpensePaymentStatus
    paymentMethod?: ExpensePaymentMethod
    paidAt?: string
    vatMinor: number
  }
}

export type SupplyPageParams = Record<string, string | string[] | undefined>
export type AvailableSupplyPurchase = Pick<SupplyPurchase,
  'id' | 'name' | 'purchasedOn' | 'remainingQuantity' | 'unitCostMinor' | 'costCurrencyCode' | 'vendor'
>
export type SupplyStockCount = { id: string; name: string; unopened: number; inUse: number }

export function supplyParam(params: SupplyPageParams, key: string) {
  const value = params[key]
  return typeof value === 'string' ? value : undefined
}

export function supplyPageNumber(value: string | undefined) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function paginateSupplies<T>(records: readonly T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize))
  const page = Math.min(requestedPage, totalPages)
  return { records: records.slice((page - 1) * pageSize, page * pageSize), page, totalPages }
}

export function supplyPageHref(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  return query.size ? `${path}?${query}` : path
}
