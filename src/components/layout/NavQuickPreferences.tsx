'use client'

import { Languages, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useSyncExternalStore, useTransition } from 'react'

import { setLocaleAction } from '@/actions/locale'
import { Button } from '@/components/ui/button'
import type { Dictionary, Locale } from '@/lib/localization'

const subscribeToHydration = () => () => undefined

export function NavQuickPreferences({
  dictionary,
  locale,
}: {
  dictionary: Dictionary
  locale: Locale
}) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  )
  const [languagePending, startLanguageTransition] = useTransition()
  const dark = hydrated && resolvedTheme === 'dark'
  const nextThemeLabel = dark ? dictionary.lightTheme : dictionary.darkTheme
  const nextLocale = locale === 'en' ? 'bn' : 'en'
  const nextLocaleLabel = nextLocale === 'bn' ? dictionary.bangla : dictionary.english

  function toggleLanguage() {
    startLanguageTransition(async () => {
      await setLocaleAction(nextLocale)
      router.refresh()
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-1 border-l pl-2">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={!hydrated}
        aria-label={`${dictionary.appearance}: ${nextThemeLabel}`}
        title={`${dictionary.appearance}: ${nextThemeLabel}`}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
      >
        {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={languagePending}
        aria-label={`${dictionary.interfaceLanguage}: ${nextLocaleLabel}`}
        title={`${dictionary.interfaceLanguage}: ${nextLocaleLabel}`}
        onClick={toggleLanguage}
      >
        <Languages aria-hidden="true" />
      </Button>
    </div>
  )
}
