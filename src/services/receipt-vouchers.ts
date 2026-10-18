import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { createBusinessInformationSnapshot } from '@/lib/business-information'
import {
  amountMinorToWords,
  nextReceiptVoucherNumber,
  saudiDateToISOString,
} from '@/lib/receipt-voucher'
import {
  createReceiptVoucherSchema,
  receiptVoucherDetailsSchema,
  type CreateReceiptVoucherInput,
  type ReceiptVoucherDetailsInput,
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

function paymentDetails(input: ReceiptVoucherDetailsInput) {
  const emptyDetails = {
    bankName: null,
    chequeDate: null,
    chequeNumber: null,
    otherDescription: null,
    otherReference: null,
    transactionReference: null,
    transferDate: null,
  }

  switch (input.paymentMethod) {
    case 'cash':
      return emptyDetails
    case 'bank_transfer':
      return {
        ...emptyDetails,
        bankName: input.bankName,
        transactionReference: input.transactionReference,
        transferDate: saudiDateToISOString(input.transferDate),
      }
    case 'cheque':
      return {
        ...emptyDetails,
        bankName: input.bankName,
        chequeDate: saudiDateToISOString(input.chequeDate),
        chequeNumber: input.chequeNumber,
      }
    case 'other':
      return {
        ...emptyDetails,
        otherDescription: input.otherDescription,
        otherReference: input.otherReference || null,
      }
  }
}

async function editableVoucherData(input: ReceiptVoucherDetailsInput) {
  const settings = await getShopSettings()
  if (
    !settings.sellerNameArabic?.trim() ||
    !settings.sellerNameEnglish?.trim() ||
    !settings.businessAddress?.trim()
  ) {
    throw new Error('Complete the business name and address before saving a receipt voucher.')
  }

  const snapshot = createBusinessInformationSnapshot(settings)
  const amountWords = amountMinorToWords(input.amountMinor)
  return {
    amountMinor: input.amountMinor,
    amountWordsArabic: amountWords.arabic,
    amountWordsEnglish: amountWords.english,
    business: {
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
    },
    notes: input.notes || null,
    paymentDetails: paymentDetails(input),
    paymentMethod: input.paymentMethod,
    purpose: input.purpose,
    receivedFrom: input.receivedFrom,
    voucherDate: saudiDateToISOString(input.voucherDate),
  }
}

export async function createReceiptVoucherDraft(
  untrustedInput: CreateReceiptVoucherInput,
): Promise<ReceiptVoucher> {
  const parsed = createReceiptVoucherSchema.safeParse(untrustedInput)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)
  const input = parsed.data

  const existing = await findByIdempotencyKey(input.idempotencyKey)
  if (existing) return existing

  const data = await editableVoucherData(input)
  const payload = await getPayload({ config })

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const voucherNumber = await allocateVoucherNumber()
    try {
      return await payload.create({
        collection: 'receipt-vouchers',
        data: {
          ...data,
          idempotencyKey: input.idempotencyKey,
          status: 'draft',
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

export async function updateReceiptVoucherDraft(
  id: string,
  untrustedInput: ReceiptVoucherDetailsInput,
): Promise<ReceiptVoucher> {
  const parsed = receiptVoucherDetailsSchema.safeParse(untrustedInput)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const voucher = await getReceiptVoucher(id)
  if (!voucher) throw new Error('Receipt voucher not found.')
  if (voucher.status !== 'draft') throw new Error('Only draft receipt vouchers can be edited.')

  const payload = await getPayload({ config })
  return payload.update({
    collection: 'receipt-vouchers',
    id,
    data: await editableVoucherData(parsed.data),
    overrideAccess: true,
  })
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
      or: [{ voucherNumber: { contains: search } }, { receivedFrom: { contains: search } }],
    })
  }
  try {
    if (filters.from) {
      clauses.push({ voucherDate: { greater_than_equal: saudiDateToISOString(filters.from) } })
    }
  } catch {
    // Ignore malformed URL filters rather than failing the page.
  }
  try {
    if (filters.to) {
      const nextDay = new Date(saudiDateToISOString(filters.to))
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      clauses.push({ voucherDate: { less_than: nextDay.toISOString() } })
    }
  } catch {
    // Ignore malformed URL filters rather than failing the page.
  }

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'receipt-vouchers',
    limit,
    sort: '-voucherDate,-createdAt',
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
  if (voucher.status === 'voided') throw new Error('This receipt voucher is already voided.')
  const normalizedReason = reason.trim()
  if (!normalizedReason) throw new Error('Void reason is required.')
  if (normalizedReason.length > 1_000) throw new Error('Void reason is too long.')

  return payload.update({
    collection: 'receipt-vouchers',
    id,
    data: {
      status: 'voided',
      voidedAt: new Date().toISOString(),
      voidReason: normalizedReason,
    },
    overrideAccess: true,
  })
}

export async function issueReceiptVoucher(id: string): Promise<ReceiptVoucher> {
  const payload = await getPayload({ config })
  const voucher = await getReceiptVoucher(id)
  if (!voucher) throw new Error('Receipt voucher not found.')
  if (voucher.status === 'issued') return voucher
  if (voucher.status === 'voided') throw new Error('A voided receipt voucher cannot be issued.')

  return payload.update({
    collection: 'receipt-vouchers',
    id,
    data: {
      issuedAt: new Date().toISOString(),
      status: 'issued',
    },
    overrideAccess: true,
  })
}
