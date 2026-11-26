import { cookies } from 'next/headers'

import bn from '@/messages/bn.json'
import en from '@/messages/en.json'

export type Locale = 'bn' | 'en'
export type Dictionary = typeof en

const localeCookieName = 'pos-locale'

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  return cookieStore.get(localeCookieName)?.value === 'bn' ? 'bn' : 'en'
}

export async function saveLocale(locale: Locale) {
  const cookieStore = await cookies()
  cookieStore.set(localeCookieName, locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  })
}

export function dictionaryForLocale(locale: Locale): Dictionary {
  return locale === 'bn' ? bn : en
}

export async function getDictionary(): Promise<{ dictionary: Dictionary; locale: Locale }> {
  const locale = await getLocale()
  return { dictionary: dictionaryForLocale(locale), locale }
}
