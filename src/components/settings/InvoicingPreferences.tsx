'use client'

import { type FormEvent, useState, useTransition } from 'react'

import { updateInvoicingPreferencesAction } from '@/actions/settings'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { Dictionary } from '@/lib/localization'

export function InvoicingPreferences({
  defaultPriceIncludesVat,
  dictionary,
}: {
  defaultPriceIncludesVat: boolean
  dictionary: Dictionary
}) {
  const [includesVat, setIncludesVat] = useState(defaultPriceIncludesVat)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    startTransition(async () => {
      const result = await updateInvoicingPreferencesAction({
        defaultPriceIncludesVat: includesVat,
      })
      setIsError(!result.ok)
      setMessage(result.ok ? dictionary.saved : result.error)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-background p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">{dictionary.invoicingPreferences}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {dictionary.invoicingPreferencesDescription}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={includesVat} onCheckedChange={setIncludesVat} />
        {dictionary.defaultPricing}
      </label>
      {message && (
        <p
          className={isError ? 'text-sm text-destructive' : 'text-sm text-green-700'}
          role="status"
        >
          {message}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? dictionary.saving : dictionary.save}
        </Button>
      </div>
    </form>
  )
}
