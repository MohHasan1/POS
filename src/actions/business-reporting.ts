'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from '@/actions/products'
import { upsertInvoiceCostOverride } from '@/services/business-reporting'

export async function correctInvoiceCostAction(input: {
  invoiceId: string
  invoiceItemId: string
  note?: string
  unitCostMinor: number
}): Promise<ActionResult> {
  const parsed = z
    .object({
      invoiceId: z.uuid(),
      invoiceItemId: z.string().trim().min(1).max(100),
      note: z.string().trim().max(500).optional(),
      unitCostMinor: z.number().int().min(0).max(100_000_000),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await upsertInvoiceCostOverride(parsed.data)
    revalidatePath('/reports')
    revalidatePath('/reports/costs')
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to correct the invoice cost.',
    }
  }
}
