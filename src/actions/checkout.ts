'use server'

import { z } from 'zod'

import type { ActionResult } from './products'
import type { FinalizeInvoiceInput } from '@/lib/pos-types'
import { finalizeInvoice } from '@/services/invoices'

const optionalText = z.string().trim().max(500).optional()
const checkoutSchema = z.object({
  idempotencyKey: z.uuid(),
  invoiceType: z.enum(['simplified', 'standard']),
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
      }),
    )
    .min(1, 'Add at least one item.'),
})

export async function finalizeInvoiceAction(
  input: FinalizeInvoiceInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const invoice = await finalizeInvoice(parsed.data)
    return { ok: true, data: { id: invoice.id } }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to finalize the invoice.',
    }
  }
}
