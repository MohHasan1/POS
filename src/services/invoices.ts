import config from '@payload-config'
import { getPayload } from 'payload'

import { nextInvoiceNumber } from '@/lib/invoice-number'
import { marketDateKey } from '@/lib/calendar'
import {
  localizedName,
  normalizedTranslations,
  type MarketProfile,
} from '@/lib/market'
import { minorToDecimal } from '@/lib/money'
import { DEFAULT_INVOICE_ADDRESS, type FinalizeInvoiceInput } from '@/lib/pos-types'
import { toSaudiISOString } from '@/lib/saudi-time'
import { calculateInvoiceTotals, calculateLine } from '@/lib/vat'
import { encodeZatcaQr } from '@/lib/zatca-qr'
import type { Invoice, Product } from '@/payload-types'

import { getEmployee } from './employees'
import { areShopSettingsComplete, getShopSettings, marketContextFromSettings } from './settings'

export type FinalizeInvoiceOptions = {
  salesChannel?: Invoice['salesChannel']
  serviceBoardDetails?: {
    customerName?: string
    customerPhone?: string
    note?: string
  }
}

async function findByIdempotencyKey(key: string): Promise<Invoice | null> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'invoices',
    limit: 1,
    where: { idempotencyKey: { equals: key } },
  })
  return result.docs[0] || null
}

async function allocateInvoiceNumber(issuedAt: Date, profile: MarketProfile): Promise<string> {
  const payload = await getPayload({ config })
  const prefix = `INV-${marketDateKey(issuedAt, profile)}-`
  const result = await payload.find({
    collection: 'invoices',
    limit: 1,
    sort: '-invoiceNumber',
    where: { invoiceNumber: { like: prefix } },
  })
  return nextInvoiceNumber(issuedAt, result.docs[0]?.invoiceNumber, profile)
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /duplicate|unique|constraint/i.test(message)
}

async function resolveItem(
  item: FinalizeInvoiceInput['items'][number],
  profile: MarketProfile,
) {
  let product: Product | null = null
  if (item.productId) {
    const payload = await getPayload({ config })
    product = await payload.findByID({ collection: 'products', id: item.productId })
  }

  const descriptionEnglish = product?.nameEnglish || item.descriptionEnglish?.trim()
  if (!descriptionEnglish) throw new Error('Every invoice item requires an English description.')
  const translations = normalizedTranslations(product?.translations || item.translations, {
    ar: product?.nameArabic || item.descriptionArabic,
    bn: product?.nameBangla || item.descriptionBangla,
  })
  const descriptionArabic = localizedName(translations, 'ar') || descriptionEnglish
  const descriptionBangla = localizedName(translations, 'bn')

  const vatCategory = profile.taxMode === 'none' ? 'exempt' : product?.vatCategory || item.vatCategory
  const priceIncludesVat =
    profile.taxMode === 'none' ? false : product?.priceIncludesVat ?? item.priceIncludesVat
  if (!vatCategory || priceIncludesVat === undefined) {
    throw new Error('Every invoice item requires a VAT category and pricing mode.')
  }

  const calculated = calculateLine({
    priceIncludesVat,
    quantityMilliunits: item.quantityMilliunits,
    unitPriceMinor: item.unitPriceMinor,
    vatCategory,
  })

  return {
    product: product?.id,
    descriptionEnglish,
    descriptionBangla,
    descriptionArabic,
    translations,
    ...calculated,
  }
}

export async function finalizeInvoice(
  input: FinalizeInvoiceInput,
  options: FinalizeInvoiceOptions = {},
): Promise<Invoice> {
  const existing = await findByIdempotencyKey(input.idempotencyKey)
  if (existing) return existing

  const settings = await getShopSettings()
  if (!areShopSettingsComplete(settings)) {
    throw new Error('Complete the business information before finalizing an invoice.')
  }
  const market = marketContextFromSettings(settings)
  const { profile, secondaryLanguage } = market
  const expectedType = profile.taxMode === 'none' ? 'sales' : input.invoiceType
  if (profile.taxMode === 'none' && input.invoiceType !== 'sales') {
    throw new Error('Bangladesh uses the Sales Invoice type.')
  }
  if (profile.taxMode === 'saudiVat' && input.invoiceType === 'sales') {
    throw new Error('Choose a Saudi simplified or standard tax invoice.')
  }

  const employee = input.employeeId ? await getEmployee(input.employeeId) : null
  if (input.employeeId && !employee?.active) {
    throw new Error('The selected employee is missing or inactive.')
  }

  const buyer =
    expectedType === 'standard'
      ? {
          ...input.buyer,
          address: input.buyer?.address?.trim() || DEFAULT_INVOICE_ADDRESS,
        }
      : undefined

  if (expectedType === 'standard') {
    if (!buyer?.name?.trim()) {
      throw new Error('Standard invoices require the buyer name.')
    }
    if (buyer.vatNumber?.trim() && !/^3\d{13}3$/.test(buyer.vatNumber.trim())) {
      throw new Error('Enter a valid 15-digit Saudi buyer VAT number.')
    }
  }

  const issuedAt = new Date()
  issuedAt.setMilliseconds(0)
  const items = await Promise.all(
    input.items.map((item) => resolveItem(item, profile)),
  )
  const totals = calculateInvoiceTotals(items)
  const seller = {
    nameArabic: settings.sellerNameArabic || undefined,
    nameBangla: settings.sellerNameBangla || undefined,
    nameEnglish: settings.sellerNameEnglish,
    vatNumber: settings.vatNumber || undefined,
    address: settings.businessAddress,
    registrations: (settings.registrations || []).map(({ type, value }) => ({ type, value })),
  }
  const qrPayload =
    profile.taxMode === 'saudiVat'
      ? encodeZatcaQr({
          sellerName: seller.nameArabic!,
          vatNumber: seller.vatNumber!,
          timestamp: toSaudiISOString(issuedAt),
          total: minorToDecimal(totals.totalMinor, profile),
          vatTotal: minorToDecimal(totals.vatMinor, profile),
        })
      : undefined

  const payload = await getPayload({ config })
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invoiceNumber = await allocateInvoiceNumber(issuedAt, profile)
    try {
      return await payload.create({
        collection: 'invoices',
        data: {
          invoiceNumber,
          idempotencyKey: input.idempotencyKey,
          invoiceType: expectedType,
          countryCode: profile.countryCode,
          currencyCode: profile.currencyCode,
          currencyMinorUnitDigits: profile.minorUnitDigits,
          timeZone: profile.timeZone,
          taxMode: profile.taxMode,
          documentLanguage: profile.documentLanguage,
          secondaryLanguage,
          salesChannel: options.salesChannel || 'checkout',
          issuedAt: issuedAt.toISOString(),
          employee: employee?.id,
          employeeSnapshot: employee ? { name: employee.name } : undefined,
          seller,
          buyer,
          serviceBoardDetails: options.serviceBoardDetails,
          items,
          ...totals,
          qrPayload,
        },
      })
    } catch (error) {
      const duplicate = await findByIdempotencyKey(input.idempotencyKey)
      if (duplicate) return duplicate
      if (!isUniqueConstraintError(error) || attempt === 4) throw error
    }
  }

  throw new Error('Unable to allocate a unique invoice number.')
}

export async function getInvoices(search?: string, limit = 100): Promise<Invoice[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'invoices',
    limit,
    sort: '-issuedAt',
    where: search?.trim() ? { invoiceNumber: { contains: search.trim() } } : undefined,
  })
  return result.docs
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const payload = await getPayload({ config })
  try {
    return await payload.findByID({ collection: 'invoices', id })
  } catch {
    return null
  }
}
