import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Dictionary, Locale } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import type { SupplyStockCount } from '@/lib/supply-stock'
import type { SupplyOverview } from '@/lib/supplies'

import { supplyCostTotalsLabel, supplyNumber } from './format'
import { SupplyFinishedByMonthChart } from './SupplyFinishedByMonthChart'
import { SupplyStockChart } from './SupplyStockChart'

export function SuppliesOverview({ overview, dictionary, locale, market, currentStock }: {
  overview: SupplyOverview
  dictionary: Dictionary
  locale: Locale
  market: MarketProfile
  currentStock: SupplyStockCount[]
}) {
  const labels = dictionary.supplyTracker
  const metrics = [
    { label: labels.activeSupplies, value: overview.activeSupplies },
    { label: labels.unitsInUse, value: overview.inUse },
    { label: labels.finishedThisMonth, value: overview.finishedThisMonth },
    { label: labels.pastEstimate, value: overview.pastEstimate, highlight: overview.pastEstimate > 0 },
  ]
  const topCount = overview.topSupplies[0]?.finished ?? 1
  const pricedUnits = overview.costsThisMonth.reduce((sum, total) => sum + total.units, 0)

  return (
    <section aria-labelledby="supplies-overview" className="space-y-3">
      <h2 id="supplies-overview" className="font-semibold">{labels.overview}</h2>
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {metrics.map(({ label, value, highlight }) => (
          <Card key={label} className="px-3 py-2">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className={`mt-0.5 text-xl font-semibold tabular-nums${highlight ? ' text-amber-700 dark:text-amber-300' : ''}`}>
              {supplyNumber(value, locale)}
            </dd>
          </Card>
        ))}
        <Card className="col-span-2 min-w-0 px-3 py-2 lg:col-span-1">
          <dt className="text-sm text-muted-foreground">{labels.monthlyOpenedCost}</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums wrap-anywhere">
            {supplyCostTotalsLabel(overview.costsThisMonth, market, locale)}
          </dd>
          {pricedUnits < overview.openedThisMonth && (
            <dd className="mt-0.5 text-xs text-muted-foreground">
              {labels.costCoverage
                .replace('{priced}', supplyNumber(pricedUnits, locale))
                .replace('{opened}', supplyNumber(overview.openedThisMonth, locale))}
            </dd>
          )}
        </Card>
      </dl>
      <SupplyStockChart counts={currentStock} dictionary={dictionary} locale={locale} />
      <div className="grid gap-3 md:grid-cols-2">
        <SupplyFinishedByMonthChart monthly={overview.monthly} labels={labels} locale={locale} />
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{labels.topSupplies}</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.topSupplies.length ? (
              <ol className="space-y-3">
                {overview.topSupplies.map(({ id, name, finished }) => (
                  <li key={id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <Link href={`/supplies/${id}`} className="min-w-0 font-medium underline-offset-4 wrap-anywhere hover:underline">
                        {name}
                      </Link>
                      <span className="shrink-0 font-medium tabular-nums">{supplyNumber(finished, locale)}</span>
                    </div>
                    <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-chart-2" style={{ width: `${(finished / topCount) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">{labels.noFinishesThisMonth}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
