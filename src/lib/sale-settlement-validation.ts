import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max).optional()

export const initialSalePaymentSchema = z
  .object({
    amountMinor: z.number().int().positive().max(99_999_999_999),
    bankName: optionalText(200),
    chequeDate: z.iso.date().optional(),
    chequeNumber: optionalText(200),
    idempotencyKey: z.uuid(),
    otherDescription: optionalText(500),
    otherReference: optionalText(200),
    paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque', 'other']),
    reference: optionalText(120),
    transactionReference: optionalText(200),
    transferDate: z.iso.date().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.paymentMethod === 'bank_transfer' &&
      (!value.bankName || !value.transactionReference || !value.transferDate)
    ) {
      context.addIssue({ code: 'custom', message: 'Bank name, transfer date and reference are required.' })
    }
    if (
      value.paymentMethod === 'cheque' &&
      (!value.bankName || !value.chequeDate || !value.chequeNumber)
    ) {
      context.addIssue({ code: 'custom', message: 'Bank name, cheque date and cheque number are required.' })
    }
    if (value.paymentMethod === 'other' && !value.otherDescription) {
      context.addIssue({ code: 'custom', message: 'Describe the payment method.' })
    }
  })

export const saleSettlementSchema = z.object({
  accountIdempotencyKey: z.uuid(),
  initialPayment: initialSalePaymentSchema.optional(),
  personId: z.uuid(),
})
