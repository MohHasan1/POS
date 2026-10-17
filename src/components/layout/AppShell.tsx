import { Boxes, FileText, Home, Settings, ShoppingCart, Store } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import type { Dictionary } from '@/lib/localization'

export function AppShell({
  children,
  dictionary,
}: {
  children: ReactNode
  dictionary: Dictionary
}) {
  const links = [
    { href: '/', label: dictionary.home, icon: Home },
    { href: '/checkout', label: dictionary.checkout, icon: ShoppingCart },
    { href: '/products', label: dictionary.products, icon: Boxes },
    { href: '/invoices', label: dictionary.invoices, icon: FileText },
    { href: '/settings', label: dictionary.settings, icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="no-print sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Store className="size-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">{dictionary.appName} POS</span>
          </Link>
          <nav aria-label="Primary" className="ml-auto flex items-center gap-1 overflow-x-auto">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            ))}
            <LanguageSwitcher label={dictionary.language} />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">{children}</main>
    </div>
  )
}
