'use server'

import { cookies } from 'next/headers'

import type { Locale } from '@/lib/localization'

export async function setLocaleAction(locale: Locale): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('pos-locale', locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  })
}
