import type { Metadata } from 'next'
import React from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { PwaRegistration } from '@/components/layout/PwaRegistration'
import { getDictionary } from '@/lib/localization'

import './styles.css'

export const metadata: Metadata = {
  title: {
    default: 'Counter POS',
    template: '%s | Counter POS',
  },
  description: 'A lightweight Saudi Arabia retail point of sale application.',
  applicationName: 'Counter POS',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { dictionary, locale } = await getDictionary()

  return (
    <html lang={locale}>
      <body>
        <AppShell dictionary={dictionary}>{children}</AppShell>
        <PwaRegistration />
      </body>
    </html>
  )
}
