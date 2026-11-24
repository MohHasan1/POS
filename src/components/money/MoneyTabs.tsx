'use client'

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { buttonVariants } from '@/components/ui/button'
import type { Dictionary } from '@/lib/localization'
import { cn } from '@/lib/utils'

export function MoneyTabs({ dictionary }: { dictionary: Dictionary }) {
  const pathname = usePathname()
  const tabs = [
    { href: '/money/owed-to-us', icon: ArrowDownLeft, label: dictionary.owedToUs },
    { href: '/money/we-owe', icon: ArrowUpRight, label: dictionary.weOwe },
  ]
  return (
    <nav aria-label={dictionary.money} className="flex flex-wrap gap-2">
      {tabs.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? 'page' : undefined}
          className={cn(
            buttonVariants({ variant: pathname === href ? 'default' : 'outline' }),
            'min-w-36',
          )}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  )
}
