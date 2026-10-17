import { Store } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { appNavigation } from '@/lib/app-navigation'
import type { Dictionary } from '@/lib/localization'

export function AppShell({
  children,
  dictionary,
}: {
  children: ReactNode
  dictionary: Dictionary
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="no-print sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Store className="size-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">{dictionary.appName}</span>
          </Link>
          <nav aria-label="Primary" className="ml-auto flex items-center gap-1 overflow-x-auto">
            {appNavigation.map(({ href, labelKey, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="hidden md:inline">{dictionary[labelKey]}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">{children}</main>
    </div>
  )
}
