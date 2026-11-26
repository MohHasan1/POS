'use client'

import { useState, useTransition, type SubmitEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/localization'
import { POS_PASSWORD_MAX, type PosAccessErrorCode, type PosAccessStatus } from '@/lib/pos-access'
import { PasswordFields } from './PasswordFields'
import { RecoveryCode } from './RecoveryCode'
import { notifyPosAccessChanged, requestPosAccess } from './pos-access-client'

export function UnlockForm({ dictionary, onUnlock }: {
  dictionary: Dictionary
  onUnlock: (access: PosAccessStatus) => void
}) {
  const labels = dictionary.posAccess
  const [recovering, setRecovering] = useState(false)
  const [recovery, setRecovery] = useState<{ code: string; status: PosAccessStatus }>()
  const [error, setError] = useState<PosAccessErrorCode>()
  const [pending, startTransition] = useTransition()

  function finish(access: PosAccessStatus) {
    notifyPosAccessChanged(access)
    onUnlock(access)
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    setError(undefined)
    startTransition(async () => {
      const result = await requestPosAccess(recovering
        ? {
            operation: 'recover',
            code: String(form.get('code') ?? ''),
            confirmation: String(form.get('confirmation') ?? ''),
            password,
          }
        : { operation: 'unlock', password })
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (result.recoveryCode) {
        setRecovery({ code: result.recoveryCode, status: result.status })
        return
      }
      finish(result.status)
    })
  }

  if (recovery) {
    return <RecoveryCode code={recovery.code} dictionary={dictionary} onDone={() => finish(recovery.status)} />
  }

  return (
    <div className="space-y-2">
      <form key={String(recovering)} onSubmit={submit} className="space-y-4 [&_input]:h-11 [&_input]:px-3">
        {recovering ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="pos-recovery-code">{labels.recoveryCode}</Label>
              <Input id="pos-recovery-code" name="code" autoComplete="off" maxLength={100} required spellCheck={false} />
            </div>
            <PasswordFields dictionary={dictionary} id="pos-recover" />
          </>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="pos-unlock-password">{labels.password}</Label>
            <Input
              id="pos-unlock-password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={POS_PASSWORD_MAX}
              aria-invalid={error === 'invalidPassword' || undefined}
              aria-describedby={error ? 'pos-unlock-error' : undefined}
              required
            />
          </div>
        )}
        {error && <p id="pos-unlock-error" className="text-sm text-destructive" role="alert">{labels.errors[error]}</p>}
        <Button className="h-11 w-full" type="submit" disabled={pending}>
          {recovering ? labels.resetPassword : labels.unlock}
        </Button>
      </form>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0 text-muted-foreground hover:text-foreground"
          disabled={pending}
          onClick={() => {
            setError(undefined)
            setRecovering(!recovering)
          }}
        >
          {recovering ? labels.backToUnlock : labels.forgotPassword}
        </Button>
      </div>
    </div>
  )
}
