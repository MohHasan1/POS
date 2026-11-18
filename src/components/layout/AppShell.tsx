import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import type { Dictionary, Locale } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { NavQuickPreferences } from './NavQuickPreferences'
import { PrimaryNavigation } from './PrimaryNavigation'
import { SetupGuard } from './SetupGuard'

export function AppShell({
  children,
  dictionary,
  locale,
  marketConfigured,
  marketProfile,
}: {
  children: ReactNode
  dictionary: Dictionary
  locale: Locale
  marketConfigured: boolean
  marketProfile: MarketProfile
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="no-print sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <Link
            href="/"
            aria-label={dictionary.appName}
            className="flex items-center gap-2 font-semibold"
          >
            <Image
              src="/web-app-manifest-192x192.png"
              alt=""
              width={32}
              height={32}
              priority
              className="size-8 shrink-0 rounded-md"
            />
            <span className="hidden sm:inline">{dictionary.appName}</span>
          </Link>
          <PrimaryNavigation
            dictionary={dictionary}
            marketConfigured={marketConfigured}
            marketProfile={marketProfile}
          />
          <NavQuickPreferences dictionary={dictionary} locale={locale} />
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
        <SetupGuard configured={marketConfigured} dictionary={dictionary}>{children}</SetupGuard>
      </main>
    </div>
  )
}
