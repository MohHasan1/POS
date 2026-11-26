import { ArrowRight, CalendarDays } from 'lucide-react'
import { cookies } from 'next/headers'
import Link from 'next/link'

import {
  SalesOverviewSection,
  SalesOverviewValue,
  SalesPrivacyProvider,
} from '@/components/dashboard/SalesOverviewSection'
import { buttonVariants } from '@/components/ui/button'
import { getAppNavigation } from '@/lib/app-navigation'
import { getBusinessLogo } from '@/lib/business-information'
import { getDictionary } from '@/lib/localization'
import { requirePosAccess } from '@/lib/require-pos-access'
import { formatMarketDateTime } from '@/lib/calendar'
import { localizedName, marketLocale, normalizedTranslations } from '@/lib/market'
import { formatMoney, formatQuantity } from '@/lib/money'
import type { SalesPeriodMetric } from '@/lib/service-board-types'
import { cn } from '@/lib/utils'
import { getInvoices } from '@/services/invoices'
import { getSalesDashboard } from '@/services/sales-reporting'
import { getShopSettings } from '@/services/settings'

const salesPrivacyCookie = 'pos-hide-sales-amounts'

export default async function HomePage() {
  await requirePosAccess('/')
  const cookieStore = await cookies()
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
  const availableNavigation = getAppNavigation(dashboard.market)
  const primaryActions = availableNavigation.filter(({ primary }) => primary)
  const secondaryActions = availableNavigation.filter((item) =>
    item.href !== '/' && !item.primary && (!('homeVisible' in item) || item.homeVisible !== false),
  )
  const periods: Array<{ label: string; metric: SalesPeriodMetric }> = [
    { label: dictionary.todaySales, metric: dashboard.today },
    { label: dictionary.monthSales, metric: dashboard.month },
    { label: dictionary.yearSales, metric: dashboard.year },
    { label: dictionary.allTimeSales, metric: dashboard.allTime },
  ]

  return (
    <SalesPrivacyProvider
      className="mx-auto max-w-6xl space-y-6"
      cookieName={salesPrivacyCookie}
      hiddenValueLabel={dictionary.salesValueHidden}
      initiallyHidden={cookieStore.get(salesPrivacyCookie)?.value !== '0'}
    >
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8">
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

      <SalesOverviewSection
        heading={dictionary.salesDashboard}
        hideLabel={dictionary.hideSalesOverview}
        showLabel={dictionary.showSalesOverview}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {periods.map(({ label, metric }) => (
            <article key={label} className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                <SalesOverviewValue>
                  {formatMoney(metric.totalMinor, dashboard.market, dateLocale)}
                </SalesOverviewValue>
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <SalesOverviewValue>
                    {dictionary.invoiceCount.replace(
                      '{count}',
                      new Intl.NumberFormat(dateLocale).format(metric.invoiceCount),
                    )}
                  </SalesOverviewValue>
                </span>
                <span>
                  <SalesOverviewValue>
                    {dictionary.averageSale.replace(
                      '{amount}',
                      formatMoney(metric.averageMinor, dashboard.market, dateLocale),
                    )}
                  </SalesOverviewValue>
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">{dictionary.money}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                dictionary.invoiceMoneyToReceive,
                formatMoney(dashboard.moneyToReceiveMinor, dashboard.market, dateLocale),
              ],
              [
                dictionary.moneyReceivedToday,
                formatMoney(dashboard.moneyReceivedMinor, dashboard.market, dateLocale),
              ],
              [
                dictionary.weOwe,
                formatMoney(dashboard.moneyToPayMinor, dashboard.market, dateLocale),
              ],
              [
                dictionary.moneyPaidToday,
                formatMoney(dashboard.moneyPaidMinor, dashboard.market, dateLocale),
              ],
            ].map(([label, value]) => (
              <article
                key={label}
                className="rounded-lg bg-amber-50/80 p-4 shadow-sm dark:bg-amber-950/25"
              >
                <p className="text-xs font-medium text-amber-900/75 dark:text-amber-100/75">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  <SalesOverviewValue>{value}</SalesOverviewValue>
                </p>
              </article>
            ))}
          </div>
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
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-sm font-medium">
                      {service.nameEnglish}
                    </span>
                    <span
                      className="block truncate text-left text-xs text-muted-foreground"
                      dir={dashboard.secondaryLanguage === 'ar' ? 'rtl' : 'ltr'}
                    >
                      {localizedName(
                        normalizedTranslations(undefined, {
                          ar: service.nameArabic,
                          bn: service.nameBangla,
                        }),
                        dashboard.secondaryLanguage,
                      )}
                    </span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    <span className="block font-medium">
                      <SalesOverviewValue>
                        {formatMoney(service.revenueMinor, dashboard.market, dateLocale)}
                      </SalesOverviewValue>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      <SalesOverviewValue>
                        {`×${formatQuantity(service.quantityMilliunits, dateLocale)}`}
                      </SalesOverviewValue>
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
      </SalesOverviewSection>

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
                  <SalesOverviewValue>
                    {formatMoney(invoice.totalMinor, dashboard.market, dateLocale)}
                  </SalesOverviewValue>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </SalesPrivacyProvider>
  )
}
