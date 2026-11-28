'use server'

import { requirePosAccess } from '@/lib/require-pos-access'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from './products'
import { dateInputToISOString, todayDateInput } from '@/lib/calendar'
import { marketSupports } from '@/lib/market'
import { saleSettlementSchema } from '@/lib/sale-settlement-validation'
import { finalizeInvoiceWithSettlement } from '@/services/sale-settlement'
import { getMarketContext } from '@/services/settings'

const optionalText = z.string().trim().max(500).optional()
const historicalSaleSchema = z.object({
  employeeId: z.uuid().nullable().optional(),
  externalReference: z
    .string()
    .trim()
    .max(80)
    .transform((value) => value || undefined)
    .optional(),
  idempotencyKey: z.uuid(),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid sale date.'),
  items: z
    .array(
      z.object({
        productId: z.uuid().optional(),
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

export type HistoricalSaleInput = z.input<typeof historicalSaleSchema>

export async function recordHistoricalSaleAction(
  input: HistoricalSaleInput,
): Promise<ActionResult<{ id: string }>> {
  await requirePosAccess()
  const parsed = historicalSaleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const market = await getMarketContext()
    if (!marketSupports(market.profile, 'historicalSales')) {
      throw new Error('Historical sales are not available for this market.')
    }
    if (parsed.data.saleDate > todayDateInput(market.profile)) {
      throw new Error('The original sale date cannot be in the future.')
    }
    const issuedAt = new Date(dateInputToISOString(parsed.data.saleDate, market.profile))
    const { invoice } = await finalizeInvoiceWithSettlement(
      {
        employeeId: parsed.data.employeeId,
        idempotencyKey: parsed.data.idempotencyKey,
        invoiceType: market.profile.taxMode === 'none' ? 'sales' : 'simplified',
        items: parsed.data.items,
      },
      {
        entrySource: 'paperBackfill',
        externalReference: parsed.data.externalReference,
        generateQr: false,
        issuedAt,
        issuedAtPrecision: 'dateOnly',
        salesChannel: 'checkout',
      },
      parsed.data.settlement,
    )

    revalidatePath('/')
    revalidatePath('/historical-sales')
    revalidatePath('/invoices')
    revalidatePath('/money/owed-to-us')
    revalidatePath('/reports')
    revalidatePath('/reports/cash')
    revalidatePath('/reports/print')
    revalidatePath('/service-board')
    return { ok: true, data: { id: invoice.id } }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to record the historical sale.',
    }
  }
}
