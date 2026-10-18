import { ArrowRight, CalendarDays } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { appNavigation } from '@/lib/app-navigation'
import { getBusinessLogo } from '@/lib/business-information'
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
  const businessLogo = getBusinessLogo(settings)
  const checkoutAction = appNavigation.find(({ primary }) => primary)!
  const receiptVoucherAction = appNavigation.find(({ href }) => href === '/receipt-vouchers')!
  const secondaryActions = appNavigation.filter(
    ({ href, primary }) => href !== '/' && href !== receiptVoucherAction.href && !primary,
  )
  const actionsBeforeVoucher = secondaryActions.slice(0, 3)
  const actionsAfterVoucher = secondaryActions.slice(3)
  const CheckoutIcon = checkoutAction.icon
  const ReceiptVoucherIcon = receiptVoucherAction.icon

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="border-b pb-6">
        <div className="flex items-center gap-4">
          {businessLogo?.url && (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border bg-card p-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={businessLogo.url}
                alt={businessLogo.alt || shopName}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{dictionary.welcome}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{shopName}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {settings.crNumber?.trim() && (
                <span>
                  <span className="font-medium text-foreground">CR:</span>{' '}
                  {settings.crNumber.trim()}
                </span>
              )}
              {settings.vatNumber?.trim() && (
                <span>
                  <span className="font-medium text-foreground">VAT:</span>{' '}
                  {settings.vatNumber.trim()}
                </span>
              )}
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden="true" />
              {currentDate}
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="quick-actions-heading" className="space-y-3">
        <h2 id="quick-actions-heading" className="text-sm font-medium">
          {dictionary.quickActions}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href={checkoutAction.href}
            className="flex min-h-20 items-center gap-3 rounded-lg border border-emerald-700 bg-emerald-600 p-4 text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:col-span-2 lg:col-span-3 dark:border-emerald-400 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
          >
            <CheckoutIcon className="size-6 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{dictionary[checkoutAction.homeLabelKey]}</span>
              <span className="mt-0.5 block text-sm text-white/80 dark:text-emerald-950/80">
                {dictionary[checkoutAction.homeDescriptionKey]}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
          </Link>
          {actionsBeforeVoucher.map(({ href, homeDescriptionKey, homeLabelKey, icon: Icon }) => (
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
          <Link
            href={receiptVoucherAction.href}
            className="flex min-h-20 items-center gap-3 rounded-lg bg-amber-100 p-4 text-amber-950 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 sm:col-span-2 lg:col-span-3 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
          >
            <ReceiptVoucherIcon className="size-6 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {dictionary[receiptVoucherAction.homeLabelKey]}
              </span>
              <span className="mt-0.5 block text-sm text-amber-900/75 dark:text-amber-200/80">
                {dictionary[receiptVoucherAction.homeDescriptionKey]}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
          </Link>
          {actionsAfterVoucher.map(({ href, homeDescriptionKey, homeLabelKey, icon: Icon }) => (
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
