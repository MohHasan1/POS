'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from './products'
import { updateShopSettings } from '@/services/settings'

const businessInformationSchema = z.object({
  displayName: z.string().trim().min(1, 'Shop display name is required.').max(120),
  sellerNameArabic: z.string().trim().min(1, 'Arabic seller name is required.').max(160),
  sellerNameEnglish: z.string().trim().min(1, 'English seller name is required.').max(160),
  vatNumber: z
    .string()
    .trim()
    .regex(/^3\d{13}3$/, 'Enter a valid 15-digit Saudi VAT number beginning and ending with 3.'),
  businessAddress: z.string().trim().min(1, 'Business address is required.').max(500),
})

export type BusinessInformationActionInput = z.input<typeof businessInformationSchema>

export async function updateBusinessInformationAction(
  input: BusinessInformationActionInput,
): Promise<ActionResult> {
  const parsed = businessInformationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    await updateShopSettings(parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to save business information.',
    }
  }
}
