'use server'

import { requirePosAccess } from '@/lib/require-pos-access'

import { saveLocale, type Locale } from '@/lib/localization'

export async function setLocaleAction(locale: Locale): Promise<void> {
  await requirePosAccess()
  await saveLocale(locale)
}
