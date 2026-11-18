'use client'

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState, useTransition } from 'react'

import { updateBusinessInformationAction } from '@/actions/business'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getBusinessLogo } from '@/lib/business-information'
import type { Dictionary } from '@/lib/localization'
import type { ShopSetting } from '@/payload-types'

export function BusinessInformationForm({
  dictionary,
  settings,
  countryLocked = false,
}: {
  dictionary: Dictionary
  settings: ShopSetting
  countryLocked?: boolean
}) {
  const savedLogo = getBusinessLogo(settings)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [logoPreview, setLogoPreview] = useState(savedLogo?.url || '')
  const [removeLogo, setRemoveLogo] = useState(false)
  const [pending, startTransition] = useTransition()
  const [countryCode, setCountryCode] = useState<'BD' | 'SA'>(settings.countryCode || 'SA')

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = URL.createObjectURL(file)
    setLogoPreview(objectUrlRef.current)
    setRemoveLogo(false)
    setMessage('')
  }

  function removeSelectedLogo() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
    setLogoPreview('')
    setRemoveLogo(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('removeLogo', String(removeLogo))
    setMessage('')

    startTransition(async () => {
      const result = await updateBusinessInformationAction(formData)
      setIsError(!result.ok)
      setMessage(result.ok ? dictionary.saved : result.error)
    })
  }

  return (
    <form
      onSubmit={submit}
      encType="multipart/form-data"
      className="space-y-5 rounded-lg border bg-background p-4 sm:p-5"
    >
      <input type="hidden" name="currentCountryCode" value={settings.countryCode || ''} />
      {countryLocked && <input type="hidden" name="countryCode" value={countryCode} />}
      <section className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="countryCode">{dictionary.country}</Label>
          <Select
            name={countryLocked ? undefined : 'countryCode'}
            value={countryCode}
            disabled={countryLocked}
            onValueChange={(value) => {
              if (value !== 'SA' && value !== 'BD') return
              if (
                settings.countryCode &&
                value !== settings.countryCode &&
                !window.confirm('Changing country changes the currency and tax rules. Review all product prices before selling. Continue?')
              ) return
              setCountryCode(value)
            }}
          >
            <SelectTrigger id="countryCode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SA">{dictionary.saudiArabia}</SelectItem>
              <SelectItem value="BD">{dictionary.bangladesh}</SelectItem>
            </SelectContent>
          </Select>
          {countryLocked && <p className="text-xs text-muted-foreground">{dictionary.countryLocked}</p>}
        </div>
      </section>
      <Separator />
      <section className="space-y-4" aria-labelledby="business-identity-heading">
        <div>
          <h2 id="business-identity-heading" className="font-semibold">
            {dictionary.businessIdentity}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dictionary.businessIdentityDescription}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="displayName">{dictionary.shopDisplayName}</Label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={settings.displayName || settings.sellerNameEnglish || ''}
            maxLength={120}
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
              maxLength={160}
              required
            />
          </div>
          {countryCode === 'SA' ? (
            <div className="space-y-1.5">
              <Label htmlFor="sellerNameArabic">{dictionary.sellerNameArabic}</Label>
              <Input id="sellerNameArabic" name="sellerNameArabic" defaultValue={settings.sellerNameArabic || ''} dir="rtl" maxLength={160} required />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sellerNameBangla">{dictionary.sellerNameBangla}</Label>
              <Input id="sellerNameBangla" name="sellerNameBangla" defaultValue={settings.sellerNameBangla || ''} maxLength={160} />
              <p className="text-xs text-muted-foreground">{dictionary.optionalField}</p>
            </div>
          )}
        </div>
        {countryCode === 'SA' ? <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="crNumber">{dictionary.crNumber}</Label>
            <Input
              id="crNumber"
              name="crNumber"
              defaultValue={settings.crNumber || ''}
              inputMode="numeric"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">{dictionary.optionalField}</p>
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
        </div> : <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="tradeLicenseNumber">{dictionary.tradeLicenseNumber}</Label>
            <Input id="tradeLicenseNumber" name="tradeLicenseNumber" defaultValue={settings.tradeLicenseNumber || ''} maxLength={50} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tinNumber">{dictionary.tinNumber}</Label>
            <Input id="tinNumber" name="tinNumber" defaultValue={settings.tinNumber || ''} maxLength={50} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="binNumber">{dictionary.binNumber}</Label>
            <Input id="binNumber" name="binNumber" defaultValue={settings.binNumber || ''} maxLength={50} />
          </div>
        </div>}
        <div className="space-y-1.5">
          <Label htmlFor="businessAddress">{dictionary.businessAddress}</Label>
          <Textarea
            id="businessAddress"
            name="businessAddress"
            defaultValue={settings.businessAddress || ''}
            maxLength={500}
            rows={3}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="logo">{dictionary.businessLogo}</Label>
          {logoPreview && (
            <div className="flex min-h-24 items-center justify-center rounded-md border bg-muted/30 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreview}
                alt={dictionary.businessLogoPreview}
                className="max-h-24 max-w-full object-contain"
              />
            </div>
          )}
          <Input
            ref={fileInputRef}
            id="logo"
            name="logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selectLogo}
          />
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">{dictionary.businessLogoDescription}</p>
            {logoPreview && (
              <Button type="button" variant="outline" size="sm" onClick={removeSelectedLogo}>
                {dictionary.removeLogo}
              </Button>
            )}
          </div>
        </div>
      </section>
      <Separator />
      <section className="space-y-4" aria-labelledby="contact-information-heading">
        <div>
          <h2 id="contact-information-heading" className="font-semibold">
            {dictionary.contactInformation}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dictionary.contactInformationDescription}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="telephone">{dictionary.telephone}</Label>
            <Input
              id="telephone"
              name="telephone"
              type="tel"
              defaultValue={settings.telephone || ''}
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="additionalTelephone">{dictionary.additionalTelephone}</Label>
            <Input
              id="additionalTelephone"
              name="additionalTelephone"
              type="tel"
              defaultValue={settings.additionalTelephone || ''}
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">{dictionary.mobile}</Label>
            <Input
              id="mobile"
              name="mobile"
              type="tel"
              defaultValue={settings.mobile || ''}
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{dictionary.email}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={settings.email || ''}
              maxLength={254}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{dictionary.contactFieldsOptional}</p>
      </section>
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
