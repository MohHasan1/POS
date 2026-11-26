'use client'

import { useEffect } from 'react'

import type { Dictionary, Locale } from '@/lib/localization'
import { POS_ACCESS_EVENT, type LockScreenIdentity } from '@/lib/pos-access'
import { LockScreenContent } from './LockScreenContent'
import { requestPosAccess } from './pos-access-client'

export function UnlockScreen({ dictionary, identity, locale, returnTo }: {
  dictionary: Dictionary
  identity: LockScreenIdentity
  locale: Locale
  returnTo: string
}) {
  useEffect(() => {
    let disposed = false
    async function onStorage(event: StorageEvent) {
      if (event.key !== POS_ACCESS_EVENT) return
      const result = await requestPosAccess()
      if (!disposed && result.ok && result.status.unlocked) window.location.replace(returnTo)
    }
    window.addEventListener('storage', onStorage)
    return () => {
      disposed = true
      window.removeEventListener('storage', onStorage)
    }
  }, [returnTo])

  return (
    <main className="pos-lock-screen min-h-dvh">
      <LockScreenContent
        initialPreferences={{ dictionary, identity, locale }}
        onUnlock={() => window.location.replace(returnTo)}
      />
    </main>
  )
}
