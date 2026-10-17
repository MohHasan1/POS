import { ArrowRight, CalendarDays } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { appNavigation } from '@/lib/app-navigation'
import { getDictionary } from '@/lib/localization'
import { formatSAR } from '@/lib/money'
import { formatSaudiDateTime } from '@/lib/saudi-time'
import { cn } from '@/lib/utils'
import { getInvoices } from '@/services/invoices'
import { getShopSettings } from '@/services/settings'

export default async function HomePage() {
  const [{ dictionary, locale }, settings, recentInvoices] = await Promise.all([
    getDictionary(),
    getShopSettings(),
    getInvoices(undefined, 4),
  ])
  const dateLocale = locale === 'bn' ? 'bn-BD' : 'en-SA'
  const currentDate = new Intl.DateTimeFormat(dateLocale, {
    dateStyle: 'full',
    timeZone: 'Asia/Riyadh',
  }).format(new Date())
  const shopName = settings.displayName || settings.sellerNameEnglish || dictionary.defaultShopName
  const checkoutAction = appNavigation.find(({ primary }) => primary)!
  const secondaryActions = appNavigation.filter(({ href, primary }) => href !== '/' && !primary)
  const CheckoutIcon = checkoutAction.icon

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="border-b pb-6">
        <div>
          <p className="text-sm text-muted-foreground">{dictionary.welcome}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{shopName}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            {currentDate}
          </p>
        </div>
      </header>

      <section aria-labelledby="quick-actions-heading" className="space-y-3">
        <h2 id="quick-actions-heading" className="text-sm font-medium">
          {dictionary.quickActions}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={checkoutAction.href}
            className="flex min-h-20 items-center gap-3 rounded-lg border border-primary bg-primary p-4 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:col-span-2 lg:col-span-4"
          >
            <CheckoutIcon className="size-6 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{dictionary[checkoutAction.homeLabelKey]}</span>
              <span className="mt-0.5 block text-sm text-primary-foreground/80">
                {dictionary[checkoutAction.homeDescriptionKey]}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
          </Link>
          {secondaryActions.map(({ href, homeDescriptionKey, homeLabelKey, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-24 items-start gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-medium">{dictionary[homeLabelKey]}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {dictionary[homeDescriptionKey]}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {recentInvoices.length > 0 && (
        <section aria-labelledby="recent-invoices-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-invoices-heading" className="text-sm font-medium">
              {dictionary.recentInvoices}
            </h2>
            <Link
              href="/invoices"
              className={cn(
                buttonVariants({ size: 'sm', variant: 'ghost' }),
                'text-muted-foreground',
              )}
            >
              {dictionary.viewAllInvoices}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="divide-y rounded-lg border bg-background">
            {recentInvoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="grid gap-1 p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
              >
                <span className="font-medium">{invoice.invoiceNumber}</span>
                <span className="text-sm text-muted-foreground">
                  {formatSaudiDateTime(invoice.issuedAt, dateLocale)}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {formatSAR(invoice.totalMinor, dateLocale)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
