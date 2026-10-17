'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from './products'
import { updateShopSettings } from '@/services/settings'

const settingsSchema = z.object({
  defaultPriceIncludesVat: z.boolean(),
})

export type SettingsActionInput = z.input<typeof settingsSchema>

export async function updateInvoicingPreferencesAction(
  input: SettingsActionInput,
): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    await updateShopSettings(parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to save invoicing preferences.',
    }
  }
}
