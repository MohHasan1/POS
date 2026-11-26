'use client'

import { useState } from 'react'

import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { Dictionary, Locale } from '@/lib/localization'
import type { LockScreenIdentity, PosAccessStatus } from '@/lib/pos-access'
import { LockScreenCard } from './LockScreenCard'
import { LockScreenNavbar } from './LockScreenNavbar'
import { UnlockForm } from './UnlockForm'

type LockScreenPreferences = {
  dictionary: Dictionary
  identity: LockScreenIdentity
  locale: Locale
}

export function LockScreenContent({
  initialPreferences,
  dialog = false,
  checking = false,
  onLocaleChange,
  onUnlock,
}: {
  initialPreferences: LockScreenPreferences
  dialog?: boolean
  checking?: boolean
  onLocaleChange?: (locale: Locale) => void
  onUnlock: (access: PosAccessStatus) => void
}) {
  const [{ dictionary, identity, locale }, setPreferences] = useState(initialPreferences)
  const [localeError, setLocaleError] = useState(false)
  const labels = dictionary.posAccess

  async function changeLocale(next: Locale) {
    setLocaleError(false)
    try {
      const response = await fetch('/api/quickpos/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-QuickPOS-Locale': '1' },
        body: JSON.stringify({ locale: next }),
      })
      if (!response.ok) throw new Error('Locale update failed.')
      const preferences: LockScreenPreferences = await response.json()
      setPreferences(preferences)
      onLocaleChange?.(preferences.locale)
    } catch {
      setLocaleError(true)
    }
  }

  const title = dialog
    ? <DialogTitle className="text-xl tracking-tight">{labels.lockedTitle}</DialogTitle>
    : <h1 className="text-xl font-semibold tracking-tight">{labels.lockedTitle}</h1>
  const description = dialog
    ? <DialogDescription>{labels.lockedDescription}</DialogDescription>
    : <p className="text-sm text-muted-foreground">{labels.lockedDescription}</p>

  return (
    <div lang={locale}>
      <LockScreenNavbar dictionary={dictionary} locale={locale} onLocaleChange={changeLocale} />
      <div className="p-5 pt-6 sm:pt-12">
        <LockScreenCard identity={identity} title={title} description={description}>
          {localeError && <p className="mb-3 text-sm text-destructive" role="alert">{labels.errors.unavailable}</p>}
          {checking ? (
            <p className="text-sm text-muted-foreground" role="status">{labels.checking}</p>
          ) : (
            <UnlockForm dictionary={dictionary} onUnlock={onUnlock} />
          )}
        </LockScreenCard>
      </div>
    </div>
  )
}
