'use client'

import { useState, useTransition, type SubmitEvent } from 'react'

import { PasswordFields } from '@/components/access/PasswordFields'
import { RecoveryCode } from '@/components/access/RecoveryCode'
import { notifyPosAccessChanged, requestPosAccess } from '@/components/access/pos-access-client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Dictionary } from '@/lib/localization'
import { POS_TIMEOUT_OPTIONS, type PosAccessErrorCode, type PosAccessStatus } from '@/lib/pos-access'

export function PosAccessSettings({ dictionary, initialAccess }: {
  dictionary: Dictionary
  initialAccess: PosAccessStatus
}) {
  const labels = dictionary.posAccess
  const [access, setAccess] = useState(initialAccess)
  const [changing, setChanging] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState<string>()
  const [error, setError] = useState<PosAccessErrorCode>()
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()
  const options = POS_TIMEOUT_OPTIONS.map((minutes) => ({
    value: String(minutes),
    label: minutes === 1 ? labels.oneMinute : labels.minutes.replace('{count}', String(minutes)),
  }))

  function savePassword(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const fields = {
      password: String(form.get('password') ?? ''),
      confirmation: String(form.get('confirmation') ?? ''),
    }
    setError(undefined)
    setSaved(false)
    startTransition(async () => {
      const result = await requestPosAccess(access.configured
        ? { operation: 'change', currentPassword: String(form.get('currentPassword') ?? ''), ...fields }
        : { operation: 'setup', ...fields })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setAccess(result.status)
      notifyPosAccessChanged(result.status)
      setChanging(false)
      setRecoveryCode(result.recoveryCode)
      setSaved(true)
    })
  }

  function saveTimeout(value: string | null) {
    if (!value || Number(value) === access.timeoutMinutes) return
    setError(undefined)
    setSaved(false)
    startTransition(async () => {
      const result = await requestPosAccess({ operation: 'timeout', minutes: Number(value) })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setAccess(result.status)
      notifyPosAccessChanged(result.status)
      setSaved(true)
    })
  }

  if (recoveryCode) {
    return <RecoveryCode code={recoveryCode} dictionary={dictionary} onDone={() => setRecoveryCode(undefined)} />
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {access.configured ? labels.configuredDescription : labels.setupDescription}
      </p>
      {access.configured && (
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="pos-auto-lock">{labels.autoLock}</Label>
          <Select value={String(access.timeoutMinutes)} items={options} disabled={pending} onValueChange={saveTimeout}>
            <SelectTrigger id="pos-auto-lock" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {(!access.configured || changing) ? (
        <form className="max-w-sm space-y-3" onSubmit={savePassword}>
          <PasswordFields dictionary={dictionary} id="pos-settings" current={access.configured} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="success" disabled={pending}>
              {access.configured ? labels.changePassword : labels.setPassword}
            </Button>
            {changing && (
              <Button type="button" variant="cancel" disabled={pending} onClick={() => {
                setError(undefined)
                setChanging(false)
              }}>
                {dictionary.cancel}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => {
          setSaved(false)
          setChanging(true)
        }}>
          {labels.changePassword}
        </Button>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{labels.errors[error]}</p>}
      {saved && <p className="text-sm text-muted-foreground" role="status">{labels.saved}</p>}
    </div>
  )
}
