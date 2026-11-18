'use client'

import { type FormEvent, useState, useTransition } from 'react'

import { updateLanguagePreferencesAction } from '@/actions/settings'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Dictionary } from '@/lib/localization'
import type { SecondaryLanguage } from '@/lib/market'

export function ProductLanguagePreferences({
  autoTranslateProducts,
  dictionary,
  secondaryLanguage,
}: {
  autoTranslateProducts: boolean
  dictionary: Dictionary
  secondaryLanguage: SecondaryLanguage
}) {
  const [language, setLanguage] = useState(secondaryLanguage)
  const [autoTranslate, setAutoTranslate] = useState(autoTranslateProducts)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await updateLanguagePreferencesAction({
        autoTranslateProducts: autoTranslate,
        secondaryLanguage: language,
      })
      setIsError(!result.ok)
      setMessage(result.ok ? dictionary.saved : result.error)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-background p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">{dictionary.productLanguagePreferences}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {dictionary.productLanguageDescription}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="secondary-product-language">{dictionary.secondaryProductLanguage}</Label>
        <Select value={language} onValueChange={(value) => setLanguage(value as SecondaryLanguage)}>
          <SelectTrigger id="secondary-product-language" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ar">{dictionary.nameArabic}</SelectItem>
            <SelectItem value="bn">{dictionary.nameBangla}</SelectItem>
            <SelectItem value="none">{dictionary.noSecondaryLanguage}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={autoTranslate}
          disabled={language === 'none'}
          onCheckedChange={setAutoTranslate}
        />
        {dictionary.autoTranslateProducts}
      </label>
      {message && (
        <p className={isError ? 'text-sm text-destructive' : 'text-sm text-green-700'} role="status">
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

