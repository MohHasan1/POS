'use server'

import { requirePosAccess } from '@/lib/require-pos-access'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createProductAction, type ActionResult, type ProductActionInput } from './products'
import { saleSettlementSchema } from '@/lib/sale-settlement-validation'
import {
  addServiceBoardColumn,
  createServiceBoardSale,
  moveServiceBoardColumn,
  removeServiceBoardColumn,
} from '@/services/service-board'

const productIdSchema = z.uuid('Select a valid product.')
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)

const serviceBoardSaleSchema = z
  .object({
    customerName: optionalText(160).optional(),
    customerPhone: optionalText(40).optional(),
    employeeId: z.uuid().nullable().optional(),
    idempotencyKey: z.uuid(),
    items: z
      .array(
        z.object({
          productId: productIdSchema,
          quantityMilliunits: z.number().int().min(1).max(100_000_000),
          unitPriceMinor: z.number().int().min(0).max(100_000_000),
        }),
      )
      .min(1, 'Add at least one service.')
      .max(50),
    note: optionalText(500).optional(),
    settlement: saleSettlementSchema.optional(),
  })
  .superRefine(({ items }, context) => {
    const seen = new Set<string>()
    for (const [index, item] of items.entries()) {
      if (seen.has(item.productId)) {
        context.addIssue({
          code: 'custom',
          message: 'Each service can only be added once. Change its quantity instead.',
          path: ['items', index, 'productId'],
        })
      }
      seen.add(item.productId)
    }
  })

export type ServiceBoardSaleInput = z.input<typeof serviceBoardSaleSchema>

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function revalidateBoardData() {
  revalidatePath('/service-board')
  revalidatePath('/')
  revalidatePath('/invoices')
  revalidatePath('/money/owed-to-us')
  revalidatePath('/reports')
}

export async function addServiceBoardColumnAction(productId: string): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = productIdSchema.safeParse(productId)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    await addServiceBoardColumn(parsed.data)
    revalidateBoardData()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}

export async function createServiceBoardProductAction(
  input: ProductActionInput,
): Promise<ActionResult> {
  await requirePosAccess()
  const result = await createProductAction(input)
  if (!result.ok) return result
  if (!result.data) return { ok: false, error: 'Unable to create the service.' }

  try {
    await addServiceBoardColumn(result.data.id)
    revalidateBoardData()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}

export async function removeServiceBoardColumnAction(productId: string): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = productIdSchema.safeParse(productId)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    await removeServiceBoardColumn(parsed.data)
    revalidateBoardData()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}

export async function moveServiceBoardColumnAction(
  productId: string,
  direction: 'left' | 'right',
): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = z
    .object({ productId: productIdSchema, direction: z.enum(['left', 'right']) })
    .safeParse({ productId, direction })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    await moveServiceBoardColumn(parsed.data.productId, parsed.data.direction)
    revalidateBoardData()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}

export async function createServiceBoardSaleAction(
  input: ServiceBoardSaleInput,
): Promise<ActionResult<{ id: string }>> {
  await requirePosAccess()
  const parsed = serviceBoardSaleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const invoice = await createServiceBoardSale(parsed.data)

    revalidateBoardData()
    return { ok: true, data: { id: invoice.id } }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}
