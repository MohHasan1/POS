'use client'

import { type FormEvent, useState, useTransition } from 'react'

import { updateBusinessInformationAction } from '@/actions/business'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary } from '@/lib/localization'
import type { ShopSetting } from '@/payload-types'

export function BusinessInformationForm({
  dictionary,
  settings,
}: {
  dictionary: Dictionary
  settings: ShopSetting
}) {
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setMessage('')

    startTransition(async () => {
      const result = await updateBusinessInformationAction({
        displayName: String(formData.get('displayName') || ''),
        sellerNameEnglish: String(formData.get('sellerNameEnglish') || ''),
        sellerNameArabic: String(formData.get('sellerNameArabic') || ''),
        vatNumber: String(formData.get('vatNumber') || ''),
        businessAddress: String(formData.get('businessAddress') || ''),
      })
      setIsError(!result.ok)
      setMessage(result.ok ? dictionary.saved : result.error)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border bg-background p-4 sm:p-5">
      <div className="space-y-1.5">
        <Label htmlFor="displayName">{dictionary.shopDisplayName}</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={settings.displayName || settings.sellerNameEnglish || ''}
          required
        />
        <p className="text-xs text-muted-foreground">{dictionary.shopDisplayNameDescription}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sellerNameEnglish">{dictionary.sellerNameEnglish}</Label>
          <Input
            id="sellerNameEnglish"
            name="sellerNameEnglish"
            defaultValue={settings.sellerNameEnglish || ''}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sellerNameArabic">{dictionary.sellerNameArabic}</Label>
          <Input
            id="sellerNameArabic"
            name="sellerNameArabic"
            defaultValue={settings.sellerNameArabic || ''}
            dir="rtl"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vatNumber">{dictionary.vatNumber}</Label>
        <Input
          id="vatNumber"
          name="vatNumber"
          defaultValue={settings.vatNumber || ''}
          inputMode="numeric"
          maxLength={15}
          pattern="3[0-9]{13}3"
          required
        />
        <p className="text-xs text-muted-foreground">{dictionary.vatNumberDescription}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="businessAddress">{dictionary.businessAddress}</Label>
        <Textarea
          id="businessAddress"
          name="businessAddress"
          defaultValue={settings.businessAddress || ''}
          rows={3}
          required
        />
      </div>
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
