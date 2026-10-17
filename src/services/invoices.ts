import config from '@payload-config'
import { getPayload } from 'payload'

import { nextInvoiceNumber } from '@/lib/invoice-number'
import { minorToDecimal } from '@/lib/money'
import type { FinalizeInvoiceInput } from '@/lib/pos-types'
import { saudiDateKey, toSaudiISOString } from '@/lib/saudi-time'
import { calculateInvoiceTotals, calculateLine } from '@/lib/vat'
import { encodeZatcaQr } from '@/lib/zatca-qr'
import type { Invoice, Product } from '@/payload-types'

import { areShopSettingsComplete, getShopSettings } from './settings'

async function findByIdempotencyKey(key: string): Promise<Invoice | null> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'invoices',
    limit: 1,
    where: { idempotencyKey: { equals: key } },
  })
  return result.docs[0] || null
}

async function allocateInvoiceNumber(issuedAt: Date): Promise<string> {
  const payload = await getPayload({ config })
  const prefix = `INV-${saudiDateKey(issuedAt)}-`
  const result = await payload.find({
    collection: 'invoices',
    limit: 1,
    sort: '-invoiceNumber',
    where: { invoiceNumber: { like: prefix } },
  })
  return nextInvoiceNumber(issuedAt, result.docs[0]?.invoiceNumber)
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /duplicate|unique|constraint/i.test(message)
}

async function resolveItem(item: FinalizeInvoiceInput['items'][number]) {
  let product: Product | null = null
  if (item.productId) {
    const payload = await getPayload({ config })
    product = await payload.findByID({ collection: 'products', id: item.productId })
  }

  const descriptionEnglish = product?.nameEnglish || item.descriptionEnglish?.trim()
  const descriptionArabic = product?.nameArabic || item.descriptionArabic?.trim()
  if (!descriptionEnglish || !descriptionArabic) {
    throw new Error('Every invoice item requires English and Arabic descriptions.')
  }

  const vatCategory = product?.vatCategory || item.vatCategory
  const priceIncludesVat = product?.priceIncludesVat ?? item.priceIncludesVat
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
    descriptionEnglish,
    descriptionBangla: product?.nameBangla || item.descriptionBangla?.trim() || undefined,
    descriptionArabic,
    ...calculated,
  }
}

export async function finalizeInvoice(input: FinalizeInvoiceInput): Promise<Invoice> {
  const existing = await findByIdempotencyKey(input.idempotencyKey)
  if (existing) return existing

  const settings = await getShopSettings()
  if (!areShopSettingsComplete(settings)) {
    throw new Error('Complete the shop settings before finalizing an invoice.')
  }

  if (input.invoiceType === 'standard') {
    const buyer = input.buyer
    if (!buyer?.name?.trim() || !buyer.address?.trim()) {
      throw new Error('Standard invoices require the buyer name and address.')
    }
    if (!buyer.vatNumber?.trim() && !buyer.identification?.trim()) {
      throw new Error('Standard invoices require a buyer VAT number or other identification.')
    }
    if (buyer.vatNumber?.trim() && !/^3\d{13}3$/.test(buyer.vatNumber.trim())) {
      throw new Error('Enter a valid 15-digit Saudi buyer VAT number.')
    }
  }

  const issuedAt = new Date()
  const items = await Promise.all(input.items.map(resolveItem))
  const totals = calculateInvoiceTotals(items)
  const seller = {
    nameArabic: settings.sellerNameArabic,
    nameEnglish: settings.sellerNameEnglish,
    vatNumber: settings.vatNumber,
    address: settings.businessAddress,
  }
  const qrPayload = encodeZatcaQr({
    sellerName: seller.nameArabic,
    vatNumber: seller.vatNumber,
    timestamp: toSaudiISOString(issuedAt),
    total: minorToDecimal(totals.totalMinor),
    vatTotal: minorToDecimal(totals.vatMinor),
  })

  const payload = await getPayload({ config })
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invoiceNumber = await allocateInvoiceNumber(issuedAt)
    try {
      return await payload.create({
        collection: 'invoices',
        data: {
          invoiceNumber,
          idempotencyKey: input.idempotencyKey,
          invoiceType: input.invoiceType,
          issuedAt: issuedAt.toISOString(),
          seller,
          buyer: input.invoiceType === 'standard' ? input.buyer : undefined,
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

export async function getInvoices(search?: string): Promise<Invoice[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'invoices',
    limit: 100,
    sort: '-issuedAt',
    where: search?.trim()
      ? { invoiceNumber: { contains: search.trim() } }
      : undefined,
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
