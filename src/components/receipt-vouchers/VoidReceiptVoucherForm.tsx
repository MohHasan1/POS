'use client'

import { type FormEvent, useState, useTransition } from 'react'

import { voidReceiptVoucherAction } from '@/actions/receipt-vouchers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Dictionary } from '@/lib/localization'

export function VoidReceiptVoucherForm({
  dictionary,
  id,
}: {
  dictionary: Dictionary
  id: string
}) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await voidReceiptVoucherAction({
        id,
        reason: String(form.get('reason') || ''),
      })
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <form onSubmit={submit} className="no-print flex flex-wrap items-start justify-end gap-2">
      <div>
        <Input
          aria-label={dictionary.voidReason}
          name="reason"
          placeholder={dictionary.voidReason}
          maxLength={1000}
          required
          className="w-64"
        />
        {error && <p className="mt-1 text-xs text-destructive" role="alert">{error}</p>}
      </div>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? dictionary.voidingVoucher : dictionary.voidVoucher}
      </Button>
    </form>
  )
}
