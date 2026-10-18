import { z } from 'zod'

import { saudiDateToISOString } from '@/lib/receipt-voucher'

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`)

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
  .refine((value) => {
    try {
      saudiDateToISOString(value)
      return true
    } catch {
      return false
    }
  }, 'Use a valid date.')
const baseFields = {
  amountMinor: z.number().int().positive().max(99_999_999_999),
  idempotencyKey: z.string().uuid(),
  issuedAt: dateOnly,
  notes: z.string().trim().max(2_000).optional(),
  purpose: requiredText('Purpose', 2_000),
  receivedFrom: requiredText('Received from', 200),
}

export const finalizeReceiptVoucherSchema = z.discriminatedUnion('paymentMethod', [
  z.object({
    ...baseFields,
    paymentMethod: z.literal('cash'),
  }),
  z.object({
    ...baseFields,
    bankName: requiredText('Bank name', 200),
    paymentMethod: z.literal('bank_transfer'),
    transactionReference: requiredText('Transaction reference', 200),
    transferDate: dateOnly,
  }),
  z.object({
    ...baseFields,
    bankName: requiredText('Bank name', 200),
    chequeDate: dateOnly,
    chequeNumber: requiredText('Cheque number', 200),
    paymentMethod: z.literal('cheque'),
  }),
  z.object({
    ...baseFields,
    otherDescription: requiredText('Payment description', 500),
    otherReference: z.string().trim().max(200).optional(),
    paymentMethod: z.literal('other'),
  }),
])

export const voidReceiptVoucherSchema = z.object({
  id: z.string().uuid(),
  reason: requiredText('Void reason', 1_000),
})

export type FinalizeReceiptVoucherInput = z.infer<typeof finalizeReceiptVoucherSchema>
