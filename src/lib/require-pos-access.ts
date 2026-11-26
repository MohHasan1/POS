import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { getPosAccessStatus, POS_SESSION_COOKIE } from '@/services/pos-access'
import { safePosReturnPath } from './pos-access'

export const readPosAccess = cache(async () => {
  const cookieStore = await cookies()
  return getPosAccessStatus(cookieStore.get(POS_SESSION_COOKIE)?.value)
})

type SearchParams = Record<string, string | string[] | undefined>

export async function requirePosAccess(path = '/', query?: SearchParams) {
  const access = await readPosAccess()
  if (access.unlocked) return access

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, item)
    }
  }
  const target = safePosReturnPath(params.size ? `${path}?${params}` : path)
  redirect(`/unlock?returnTo=${encodeURIComponent(target)}`)
}
