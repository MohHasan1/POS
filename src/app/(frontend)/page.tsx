import { ArrowRight, CalendarDays } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { appNavigation } from '@/lib/app-navigation'
import { getBusinessLogo } from '@/lib/business-information'
import { getDictionary } from '@/lib/localization'
import { formatMarketDateTime } from '@/lib/calendar'
import { localizedName, marketLocale, normalizedTranslations } from '@/lib/market'
import { formatMoney, formatQuantity } from '@/lib/money'
import type { SalesPeriodMetric } from '@/lib/service-board-types'
import { cn } from '@/lib/utils'
import { getInvoices } from '@/services/invoices'
import { getSalesDashboard } from '@/services/sales-reporting'
import { getShopSettings } from '@/services/settings'

export default async function HomePage() {
  const [{ dictionary, locale }, settings, recentInvoices, dashboard] = await Promise.all([
    getDictionary(),
    getShopSettings(),
    getInvoices(undefined, 4),
    getSalesDashboard(),
  ])
  const dateLocale = marketLocale(dashboard.market, locale)
  const currentDate = new Intl.DateTimeFormat(dateLocale, {
    dateStyle: 'full',
    timeZone: dashboard.market.timeZone,
  }).format(new Date())
  const shopName = settings.displayName || settings.sellerNameEnglish || dictionary.defaultShopName
  const businessLogo = getBusinessLogo(settings)
  const primaryActions = appNavigation.filter(({ primary }) => primary)
  const secondaryActions = appNavigation.filter(({ href, primary }) => href !== '/' && !primary)
  const periods: Array<{ label: string; metric: SalesPeriodMetric }> = [
    { label: dictionary.todaySales, metric: dashboard.today },
    { label: dictionary.monthSales, metric: dashboard.month },
    { label: dictionary.yearSales, metric: dashboard.year },
    { label: dictionary.allTimeSales, metric: dashboard.allTime },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center gap-4 border-b pb-5">
        {businessLogo?.url && (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-card p-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={businessLogo.url}
              alt={businessLogo.alt || shopName}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{dictionary.welcome}</p>
          <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight">{shopName}</h1>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {settings.crNumber?.trim() && <span>CR: {settings.crNumber.trim()}</span>}
            {settings.vatNumber?.trim() && <span>VAT: {settings.vatNumber.trim()}</span>}
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {currentDate}
            </span>
          </div>
        </div>
      </header>

      <section aria-labelledby="quick-actions-heading" className="space-y-3">
        <h2 id="quick-actions-heading" className="text-sm font-medium">
          {dictionary.quickActions}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {primaryActions.map(({ href, homeDescriptionKey, homeLabelKey, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex min-h-20 items-center gap-3 rounded-lg border p-4 text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                href === '/service-board'
                  ? 'border-violet-600 bg-violet-500 hover:bg-violet-600 focus-visible:ring-violet-500 dark:border-violet-300 dark:bg-violet-400 dark:text-violet-950 dark:hover:bg-violet-300'
                  : 'border-emerald-700 bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-600 dark:border-emerald-400 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400',
              )}
            >
              <Icon className="size-6 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{dictionary[homeLabelKey]}</span>
                <span className="mt-0.5 block text-sm text-white/80 dark:text-emerald-950/80">
                  {dictionary[homeDescriptionKey]}
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {secondaryActions.map(({ href, homeLabelKey, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex min-h-14 items-center gap-2 rounded-lg border bg-background p-3 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                href === '/receipt-vouchers' &&
                  'border-transparent bg-amber-100 text-amber-950 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{dictionary[homeLabelKey]}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="sales-dashboard-heading" className="space-y-3">
        <h2 id="sales-dashboard-heading" className="text-sm font-medium">
          {dictionary.salesDashboard}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {periods.map(({ label, metric }) => (
            <article key={label} className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatMoney(metric.totalMinor, dashboard.market, dateLocale)}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {dictionary.invoiceCount.replace(
                    '{count}',
                    new Intl.NumberFormat(dateLocale).format(metric.invoiceCount),
                  )}
                </span>
                <span>
                  {dictionary.averageSale.replace(
                    '{amount}',
                    formatMoney(metric.averageMinor, dashboard.market, dateLocale),
                  )}
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-lg border bg-background">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-medium">{dictionary.topServicesThisMonth}</h3>
          </div>
          {dashboard.topServices.length > 0 ? (
            <ol className="divide-y">
              {dashboard.topServices.map((service, index) => (
                <li
                  key={`${service.nameEnglish}:${service.nameArabic}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {service.nameEnglish}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground" dir="rtl">
                      {localizedName(normalizedTranslations(undefined, { ar: service.nameArabic, bn: service.nameBangla }), dashboard.secondaryLanguage)}
                    </span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    <span className="block font-medium">
                      {formatMoney(service.revenueMinor, dashboard.market, dateLocale)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      ×{formatQuantity(service.quantityMilliunits, dateLocale)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {dictionary.noSalesData}
            </p>
          )}
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
                  {formatMarketDateTime(invoice.issuedAt, dashboard.market, dateLocale)}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {formatMoney(invoice.totalMinor, dashboard.market, dateLocale)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
