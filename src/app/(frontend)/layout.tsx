import type { Metadata } from 'next'
import React from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { PwaRegistration } from '@/components/layout/PwaRegistration'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { getDictionary } from '@/lib/localization'
import { getShopSettings, marketContextFromSettings } from '@/services/settings'

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
  const [{ dictionary, locale }, settings] = await Promise.all([
    getDictionary(),
    getShopSettings(),
  ])
  const market = marketContextFromSettings(settings)

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="counter-pos-theme"
        >
          <AppShell dictionary={dictionary} locale={locale} marketConfigured={market.configured}>
            {children}
          </AppShell>
          <PwaRegistration />
        </ThemeProvider>
      </body>
    </html>
  )
}
