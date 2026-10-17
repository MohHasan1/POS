import { cookies } from 'next/headers'

import bn from '@/messages/bn.json'
import en from '@/messages/en.json'

export type Locale = 'bn' | 'en'
export type Dictionary = typeof en

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  return cookieStore.get('pos-locale')?.value === 'bn' ? 'bn' : 'en'
}

export async function getDictionary(): Promise<{ dictionary: Dictionary; locale: Locale }> {
  const locale = await getLocale()
  return { dictionary: locale === 'bn' ? bn : en, locale }
}
