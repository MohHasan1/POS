import Image from 'next/image'

import { NavQuickPreferences } from '@/components/layout/NavQuickPreferences'
import type { Dictionary, Locale } from '@/lib/localization'

export function LockScreenNavbar({ dictionary, locale, onLocaleChange }: {
  dictionary: Dictionary
  locale: Locale
  onLocaleChange: (locale: Locale) => Promise<void>
}) {
  return (
    <header className="border-b border-foreground/10">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <Image src="/web-app-manifest-192x192.png" alt="" width={32} height={32} className="rounded-md" />
          <span>{dictionary.appName}</span>
        </div>
        <NavQuickPreferences
          dictionary={dictionary}
          locale={locale}
          onLocaleChange={onLocaleChange}
          className="border-0 pl-0"
        />
      </div>
    </header>
  )
}
