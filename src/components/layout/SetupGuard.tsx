'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { buttonVariants } from '@/components/ui/button'
import type { Dictionary } from '@/lib/localization'

export function SetupGuard({
  children,
  configured,
  dictionary,
}: {
  children: ReactNode
  configured: boolean
  dictionary: Dictionary
}) {
  const pathname = usePathname()
  if (configured || pathname === '/business') return children

  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-lg border bg-background p-6 text-center">
      <h1 className="text-2xl font-semibold">{dictionary.completeSetup}</h1>
      <p className="text-muted-foreground">{dictionary.completeSetupDescription}</p>
      <Link href="/business" className={buttonVariants()}>
        {dictionary.businessInformation}
      </Link>
    </section>
  )
}

