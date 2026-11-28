import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import type { Dictionary } from '@/lib/localization'

export function ReportNavigation({ active, dictionary }: {
  active: 'business' | 'cash'
  dictionary: Dictionary
}) {
  const links = [
    { key: 'business', href: '/reports', label: dictionary.cashSummary.businessReport },
    { key: 'cash', href: '/reports/cash', label: dictionary.cashSummaryTitle },
  ]
  return (
    <nav className="flex flex-wrap gap-2" aria-label={dictionary.reports}>
      {links.map(({ key, href, label }) => (
        <Link key={key} href={href} aria-current={key === active ? 'page' : undefined}
          className={buttonVariants({ variant: key === active ? 'secondary' : 'ghost' })}>
          {label}
        </Link>
      ))}
    </nav>
  )
}
