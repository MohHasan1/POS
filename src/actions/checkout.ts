'use server'

import { requirePosAccess } from '@/lib/require-pos-access'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from './products'
import type { FinalizeInvoiceInput } from '@/lib/pos-types'
import type { SaleSettlementInput } from '@/lib/money-types'
import { saleSettlementSchema } from '@/lib/sale-settlement-validation'
import { finalizeInvoiceWithSettlement } from '@/services/sale-settlement'

const optionalText = z.string().trim().max(500).optional()
const checkoutSchema = z.object({
  employeeId: z.uuid().nullable().optional(),
  idempotencyKey: z.uuid(),
  invoiceType: z.enum(['sales', 'simplified', 'standard']),
  buyer: z
    .object({
      name: optionalText,
      address: optionalText,
      vatNumber: optionalText,
      identification: optionalText,
    })
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional(),
        descriptionEnglish: optionalText,
        descriptionBangla: optionalText,
        descriptionArabic: optionalText,
        unitPriceMinor: z.number().int().min(0).max(100_000_000),
        quantityMilliunits: z.number().int().min(1).max(100_000_000),
        vatCategory: z.enum(['standard', 'zero', 'exempt']).optional(),
        priceIncludesVat: z.boolean().optional(),
        translations: z
          .array(
            z.object({
              language: z.string().trim().min(2).max(16),
              name: z.string().trim().min(1).max(160),
            }),
          )
          .optional(),
      }),
    )
    .min(1, 'Add at least one item.'),
  settlement: saleSettlementSchema.optional(),
})

export type CheckoutSaleInput = FinalizeInvoiceInput & { settlement?: SaleSettlementInput }

export async function finalizeInvoiceAction(
  input: CheckoutSaleInput,
): Promise<ActionResult<{ id: string }>> {
  await requirePosAccess()
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const { settlement, ...invoiceInput } = parsed.data
    const { invoice } = await finalizeInvoiceWithSettlement(
      invoiceInput as FinalizeInvoiceInput,
      {},
      settlement,
    )
    revalidatePath('/')
    revalidatePath('/invoices')
    revalidatePath('/money/owed-to-us')
    revalidatePath('/reports')
    revalidatePath('/service-board')
    return { ok: true, data: { id: invoice.id } }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to finalize the invoice.',
    }
  }
}
