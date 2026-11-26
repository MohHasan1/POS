'use client'

import { LockKeyhole } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { Dictionary, Locale } from '@/lib/localization'
import { POS_ACCESS_EVENT, type LockScreenIdentity, type PosAccessStatus } from '@/lib/pos-access'
import { LockScreenContent } from './LockScreenContent'
import { notifyPosAccessChanged, requestPosAccess } from './pos-access-client'

const ACTIVITY_INTERVAL = 5_000
const STATUS_INTERVAL = 10_000
const AccessContext = createContext<{
  configured: boolean
  lockNow: () => void
  canRefresh: () => boolean
}>({
  configured: false,
  lockNow: () => {},
  canRefresh: () => true,
})

export function useCanRefreshPos() {
  return useContext(AccessContext).canRefresh
}

export function LockNowButton({ dictionary }: { dictionary: Dictionary }) {
  const { configured, lockNow } = useContext(AccessContext)
  if (!configured) return null

  return (
    <Button type="button" size="icon-sm" variant="ghost" aria-label={dictionary.posAccess.lockNow} title={dictionary.posAccess.lockNow} onClick={lockNow}>
      <LockKeyhole aria-hidden="true" />
    </Button>
  )
}

export function PosAccessBoundary({ children, dictionary, identity, initialAccess, locale }: {
  children: ReactNode
  dictionary: Dictionary
  identity: LockScreenIdentity
  initialAccess: PosAccessStatus
  locale: Locale
}) {
  const router = useRouter()
  const [access, setAccess] = useState(initialAccess)
  const [checking, setChecking] = useState(false)
  const current = useRef(initialAccess)
  const requestVersion = useRef(0)
  const manualLock = useRef(false)
  const refreshLanguageOnUnlock = useRef(false)
  const canRefresh = useCallback(() => {
    const { unlocked, expiresAt } = current.current
    return unlocked && !manualLock.current && (expiresAt === null || expiresAt > Date.now())
  }, [])

  const apply = useCallback((next: PosAccessStatus) => {
    current.current = next
    setAccess(next)
    setChecking(false)
    if (next.unlocked && refreshLanguageOnUnlock.current) {
      refreshLanguageOnUnlock.current = false
      router.refresh()
    }
  }, [router])

  const synchronize = useCallback(async (activity = false, conceal = false) => {
    if (manualLock.current) return
    const version = ++requestVersion.current
    if (conceal) setChecking(true)
    const result = await requestPosAccess(activity ? { operation: 'activity' } : undefined)
    if (version !== requestVersion.current) return
    if (result.ok) {
      apply(result.status)
    } else if (result.error === 'locked' || conceal || (
      current.current.expiresAt !== null && current.current.expiresAt <= Date.now()
    )) {
      apply({ ...current.current, unlocked: false, expiresAt: null })
    }
  }, [apply])

  async function lockNow() {
    if (manualLock.current) return
    manualLock.current = true
    requestVersion.current += 1
    setChecking(true)
    const result = await requestPosAccess({ operation: 'lock' })
    manualLock.current = false
    if (result.ok) notifyPosAccessChanged(result.status)
    else apply({ ...current.current, unlocked: false, expiresAt: null })
  }

  useEffect(() => {
    let lastActivitySent = 0
    let trailingActivity: number | undefined

    function sendActivity() {
      window.clearTimeout(trailingActivity)
      trailingActivity = undefined
      if (!current.current.configured || !current.current.unlocked || document.hidden) return
      lastActivitySent = Date.now()
      void synchronize(true)
    }

    function onActivity(event: Event) {
      if (!event.isTrusted || !current.current.configured || !current.current.unlocked || document.hidden) return
      if (current.current.expiresAt !== null && current.current.expiresAt <= Date.now()) {
        void synchronize(false, true)
        return
      }
      const wait = ACTIVITY_INTERVAL - (Date.now() - lastActivitySent)
      if (wait <= 0) sendActivity()
      else trailingActivity ??= window.setTimeout(sendActivity, wait)
    }

    function onFocus() {
      if (document.hidden || !current.current.unlocked) return
      const expiresAt = current.current.expiresAt
      void synchronize(false, expiresAt !== null && expiresAt <= Date.now())
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void synchronize(false, true)
    }

    function onStorage(event: StorageEvent) {
      if (event.key === POS_ACCESS_EVENT) void synchronize(false, true)
    }

    function onAccessChanged(event: Event) {
      requestVersion.current += 1
      apply((event as CustomEvent<PosAccessStatus>).detail)
    }

    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    for (const event of events) window.addEventListener(event, onActivity, { passive: true })
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('storage', onStorage)
    window.addEventListener(POS_ACCESS_EVENT, onAccessChanged)
    document.addEventListener('visibilitychange', onFocus)
    const timer = window.setInterval(onFocus, STATUS_INTERVAL)

    return () => {
      window.clearTimeout(trailingActivity)
      window.clearInterval(timer)
      for (const event of events) window.removeEventListener(event, onActivity)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(POS_ACCESS_EVENT, onAccessChanged)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [apply, synchronize])

  useEffect(() => {
    if (access.expiresAt === null) return
    const timeout = window.setTimeout(
      () => void synchronize(false, true),
      Math.max(0, access.expiresAt - Date.now()),
    )
    return () => window.clearTimeout(timeout)
  }, [access.expiresAt, synchronize])

  const blocked = checking || !access.unlocked
  return (
    <AccessContext.Provider value={{ configured: access.configured, lockNow, canRefresh }}>
      <div hidden={blocked} inert={blocked}>
        {children}
      </div>
      <Dialog open={blocked}>
        <DialogContent
          showCloseButton={false}
          className="pos-lock-screen top-0 left-0 z-[100] block h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none p-0 sm:max-w-none data-open:animate-none data-closed:animate-none"
        >
          <LockScreenContent
            initialPreferences={{ dictionary, identity, locale }}
            dialog
            checking={checking}
            onLocaleChange={(nextLocale) => { refreshLanguageOnUnlock.current = nextLocale !== locale }}
            onUnlock={apply}
          />
        </DialogContent>
      </Dialog>
    </AccessContext.Provider>
  )
}
