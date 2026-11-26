import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { UnlockScreen } from '@/components/access/UnlockScreen'
import { getDictionary } from '@/lib/localization'
import { safePosReturnPath } from '@/lib/pos-access'
import { readPosAccess } from '@/lib/require-pos-access'
import { getLockScreenIdentity } from '@/services/settings'

export const metadata: Metadata = { title: 'Unlock' }

export default async function UnlockPage({ searchParams }: {
  searchParams: Promise<{ returnTo?: string | string[] }>
}) {
  const { returnTo } = await searchParams
  const target = safePosReturnPath(typeof returnTo === 'string' ? returnTo : undefined)
  if ((await readPosAccess()).unlocked) redirect(target)
  const { dictionary, locale } = await getDictionary()
  const identity = await getLockScreenIdentity(locale, dictionary.defaultShopName)
  return <UnlockScreen dictionary={dictionary} identity={identity} locale={locale} returnTo={target} />
}
