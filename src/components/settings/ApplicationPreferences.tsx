'use client'

import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useSyncExternalStore, useTransition } from 'react'

import { setLocaleAction } from '@/actions/locale'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Dictionary, Locale } from '@/lib/localization'

const subscribeToHydration = () => () => undefined

export function ApplicationPreferences({
  dictionary,
  locale,
}: {
  dictionary: Dictionary
  locale: Locale
}) {
  const router = useRouter()
  const { setTheme, theme } = useTheme()
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  )
  const [languagePending, startLanguageTransition] = useTransition()

  function changeLanguage(value: string | null) {
    if ((value !== 'en' && value !== 'bn') || value === locale) return

    startLanguageTransition(async () => {
      await setLocaleAction(value)
      router.refresh()
    })
  }

  function changeTheme(value: string | null) {
    if (value === 'light' || value === 'dark' || value === 'system') setTheme(value)
  }

  return (
    <section className="space-y-4 rounded-lg border bg-background p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">{dictionary.interfacePreferences}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {dictionary.interfacePreferencesDescription}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="interface-language">{dictionary.interfaceLanguage}</Label>
          <Select value={locale} onValueChange={changeLanguage} disabled={languagePending}>
            <SelectTrigger id="interface-language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="en">{dictionary.english}</SelectItem>
              <SelectItem value="bn">{dictionary.bangla}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="appearance">{dictionary.appearance}</Label>
          <Select
            value={hydrated ? theme || 'system' : 'system'}
            onValueChange={changeTheme}
            disabled={!hydrated}
          >
            <SelectTrigger id="appearance" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="light">{dictionary.lightTheme}</SelectItem>
              <SelectItem value="dark">{dictionary.darkTheme}</SelectItem>
              <SelectItem value="system">{dictionary.systemTheme}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  )
}
