'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ProductSummary } from '@/lib/pos-types'
import {
  createProduct,
  setProductActive,
  updateProduct,
  type ProductInput,
} from '@/services/products'

const optionalText = z
  .string()
  .trim()
  .max(160)
  .transform((value) => value || undefined)
const productSchema = z.object({
  nameEnglish: z.string().trim().min(1, 'English name is required.').max(160),
  nameBangla: optionalText,
  nameArabic: z.string().trim().min(1, 'Arabic name is required.').max(160),
  sku: optionalText,
  priceMinor: z.number().int().min(0).max(100_000_000),
  vatCategory: z.enum(['standard', 'zero', 'exempt']),
  priceIncludesVat: z.boolean(),
})

export type ProductActionInput = z.input<typeof productSchema>
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

export async function createProductAction(
  input: ProductActionInput,
): Promise<ActionResult<ProductSummary>> {
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const product = await createProduct(parsed.data as ProductInput)
    revalidatePath('/products')
    revalidatePath('/checkout')
    return { ok: true, data: product }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}

export async function updateProductAction(
  id: string,
  input: ProductActionInput,
): Promise<ActionResult<ProductSummary>> {
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const product = await updateProduct(id, parsed.data as ProductInput)
    revalidatePath('/products')
    revalidatePath('/checkout')
    return { ok: true, data: product }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}

export async function setProductActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await setProductActive(id, active)
    revalidatePath('/products')
    revalidatePath('/checkout')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}
