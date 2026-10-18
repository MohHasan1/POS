import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { createBusinessInformationSnapshot } from '@/lib/business-information'
import {
  amountMinorToWords,
  nextReceiptVoucherNumber,
  saudiDateToISOString,
} from '@/lib/receipt-voucher'
import {
  finalizeReceiptVoucherSchema,
  type FinalizeReceiptVoucherInput,
} from '@/lib/receipt-voucher-validation'
import type { ReceiptVoucher } from '@/payload-types'

import { getShopSettings } from './settings'

async function findByIdempotencyKey(key: string): Promise<ReceiptVoucher | null> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'receipt-vouchers',
    limit: 1,
    where: { idempotencyKey: { equals: key } },
  })
  return result.docs[0] || null
}

async function allocateVoucherNumber(): Promise<string> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'receipt-vouchers',
    limit: 1,
    sort: '-voucherNumber',
  })
  return nextReceiptVoucherNumber(result.docs[0]?.voucherNumber)
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /duplicate|unique|constraint/i.test(message)
}

function paymentDetails(input: FinalizeReceiptVoucherInput) {
  switch (input.paymentMethod) {
    case 'cash':
      return {}
    case 'bank_transfer':
      return {
        bankName: input.bankName,
        transactionReference: input.transactionReference,
        transferDate: saudiDateToISOString(input.transferDate),
      }
    case 'cheque':
      return {
        bankName: input.bankName,
        chequeDate: saudiDateToISOString(input.chequeDate),
        chequeNumber: input.chequeNumber,
      }
    case 'other':
      return {
        otherDescription: input.otherDescription,
        otherReference: input.otherReference || undefined,
      }
  }
}

export async function finalizeReceiptVoucher(
  untrustedInput: FinalizeReceiptVoucherInput,
): Promise<ReceiptVoucher> {
  const parsed = finalizeReceiptVoucherSchema.safeParse(untrustedInput)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)
  const input = parsed.data

  const existing = await findByIdempotencyKey(input.idempotencyKey)
  if (existing) return existing

  const settings = await getShopSettings()
  if (
    !settings.sellerNameArabic?.trim() ||
    !settings.sellerNameEnglish?.trim() ||
    !settings.businessAddress?.trim()
  ) {
    throw new Error('Complete the business name and address before finalizing a receipt voucher.')
  }

  const snapshot = createBusinessInformationSnapshot(settings)
  const amountWords = amountMinorToWords(input.amountMinor)
  const business = {
    ...snapshot,
    logo: snapshot.logo
      ? {
          filename: snapshot.logo.filename,
          height: snapshot.logo.height,
          mediaId: snapshot.logo.id,
          mimeType: snapshot.logo.mimeType,
          url: snapshot.logo.url,
          width: snapshot.logo.width,
        }
      : undefined,
  }
  const issuedAt = saudiDateToISOString(input.issuedAt)
  const payload = await getPayload({ config })

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const voucherNumber = await allocateVoucherNumber()
    try {
      return await payload.create({
        collection: 'receipt-vouchers',
        data: {
          amountMinor: input.amountMinor,
          amountWordsArabic: amountWords.arabic,
          amountWordsEnglish: amountWords.english,
          business,
          idempotencyKey: input.idempotencyKey,
          issuedAt,
          notes: input.notes || undefined,
          paymentDetails: paymentDetails(input),
          paymentMethod: input.paymentMethod,
          purpose: input.purpose,
          receivedFrom: input.receivedFrom,
          status: 'active',
          voucherNumber,
        },
      })
    } catch (error) {
      const duplicate = await findByIdempotencyKey(input.idempotencyKey)
      if (duplicate) return duplicate
      if (!isUniqueConstraintError(error) || attempt === 4) throw error
    }
  }

  throw new Error('Unable to allocate a unique receipt voucher number.')
}

export type ReceiptVoucherFilters = {
  from?: string
  search?: string
  to?: string
}

export async function getReceiptVouchers(
  filters: ReceiptVoucherFilters = {},
  limit = 100,
): Promise<ReceiptVoucher[]> {
  const clauses: Where[] = []
  const search = filters.search?.trim()
  if (search) {
    clauses.push({
      or: [
        { voucherNumber: { contains: search } },
        { receivedFrom: { contains: search } },
      ],
    })
  }
  try {
    if (filters.from) {
      clauses.push({ issuedAt: { greater_than_equal: saudiDateToISOString(filters.from) } })
    }
  } catch {
    // Ignore malformed URL filters rather than failing the page.
  }
  try {
    if (filters.to) {
      const nextDay = new Date(saudiDateToISOString(filters.to))
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      clauses.push({ issuedAt: { less_than: nextDay.toISOString() } })
    }
  } catch {
    // Ignore malformed URL filters rather than failing the page.
  }

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'receipt-vouchers',
    limit,
    sort: '-issuedAt,-createdAt',
    where: clauses.length ? { and: clauses } : undefined,
  })
  return result.docs
}

export async function getReceiptVoucher(id: string): Promise<ReceiptVoucher | null> {
  const payload = await getPayload({ config })
  try {
    return await payload.findByID({ collection: 'receipt-vouchers', id })
  } catch {
    return null
  }
}

export async function voidReceiptVoucher(id: string, reason: string): Promise<ReceiptVoucher> {
  const payload = await getPayload({ config })
  const voucher = await getReceiptVoucher(id)
  if (!voucher) throw new Error('Receipt voucher not found.')
  if (voucher.status === 'void') throw new Error('This receipt voucher is already void.')
  const normalizedReason = reason.trim()
  if (!normalizedReason) throw new Error('Void reason is required.')
  if (normalizedReason.length > 1_000) throw new Error('Void reason is too long.')

  return payload.update({
    collection: 'receipt-vouchers',
    id,
    data: {
      status: 'void',
      voidedAt: new Date().toISOString(),
      voidReason: normalizedReason,
    },
    overrideAccess: true,
  })
}
