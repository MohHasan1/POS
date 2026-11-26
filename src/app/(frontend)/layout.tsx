import type { Metadata } from 'next'
import React from 'react'

import { PosAccessBoundary } from '@/components/access/PosAccessBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { PwaRegistration } from '@/components/layout/PwaRegistration'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { getDictionary } from '@/lib/localization'
import { readPosAccess } from '@/lib/require-pos-access'
import { getShopSettings, lockScreenIdentity, marketContextFromSettings } from '@/services/settings'

import './styles.css'

export const metadata: Metadata = {
  title: {
    default: 'QuickPOS',
    template: '%s | QuickPOS',
  },
  description: 'A lightweight multi-country retail and service point of sale application.',
  applicationName: 'QuickPOS',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [access, { dictionary, locale }] = await Promise.all([
    readPosAccess(),
    getDictionary(),
  ])
  const settings = access.unlocked ? await getShopSettings() : undefined
  const market = settings ? marketContextFromSettings(settings) : undefined

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider
          defaultTheme="system"
          disableTransitionOnChange
          storageKey="counter-pos-theme"
        >
          {market && settings ? (
            <PosAccessBoundary
              dictionary={dictionary}
              identity={lockScreenIdentity(settings, locale, dictionary.defaultShopName)}
              initialAccess={access}
              locale={locale}
            >
              <AppShell
                dictionary={dictionary}
                locale={locale}
                marketConfigured={market.configured}
                marketProfile={market.profile}
              >
                {children}
              </AppShell>
            </PosAccessBoundary>
          ) : children}
          <PwaRegistration />
        </ThemeProvider>
      </body>
    </html>
  )
}
