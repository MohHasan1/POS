import Link from 'next/link'

import { Button, buttonVariants } from '@/components/ui/button'
import type { Dictionary, Locale } from '@/lib/localization'

import { supplyNumber } from './format'

export function SupplyPagination({ dictionary, href, locale, page, totalPages }: {
  dictionary: Dictionary
  href: (page: number) => string
  locale: Locale
  page: number
  totalPages: number
}) {
  if (totalPages <= 1) return null
  const linkClass = buttonVariants({ variant: 'outline', size: 'sm' })
  return (
    <nav aria-label={dictionary.supplyTracker.pagination} className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        {dictionary.pageOf
          .replace('{page}', supplyNumber(page, locale))
          .replace('{total}', supplyNumber(totalPages, locale))}
      </p>
      <div className="flex gap-2">
        {page > 1
          ? <Link className={linkClass} href={href(page - 1)}>{dictionary.previous}</Link>
          : <Button size="sm" variant="outline" disabled>{dictionary.previous}</Button>}
        {page < totalPages
          ? <Link className={linkClass} href={href(page + 1)}>{dictionary.next}</Link>
          : <Button size="sm" variant="outline" disabled>{dictionary.next}</Button>}
      </div>
    </nav>
  )
}
