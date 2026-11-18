'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from './products'
import { updateShopSettings } from '@/services/settings'

const settingsSchema = z.object({
  defaultPriceIncludesVat: z.boolean(),
})

const languageSettingsSchema = z.object({
  autoTranslateProducts: z.boolean(),
  secondaryLanguage: z.enum(['ar', 'bn', 'none']),
})

export type SettingsActionInput = z.input<typeof settingsSchema>
export type LanguageSettingsActionInput = z.input<typeof languageSettingsSchema>

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

export async function updateLanguagePreferencesAction(
  input: LanguageSettingsActionInput,
): Promise<ActionResult> {
  const parsed = languageSettingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    await updateShopSettings(parsed.data)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to save language preferences.',
    }
  }
}
