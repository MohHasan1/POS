import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { Dictionary, Locale } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { supplyElapsedDays } from '@/lib/supplies'
import type { SupplyUsage } from '@/payload-types'

import {
  supplyCostLabel,
  supplyDateLabel,
  supplyDayLabel,
  supplyEstimateLabel,
  supplyLifespanComparison,
  supplyLifespanLabel,
} from './format'

export function SupplyUsageList({
  dictionary,
  finished,
  locale,
  market,
  today,
  usages,
  action,
  onEdit,
  onFinish,
}: {
  dictionary: Dictionary
  finished: boolean
  locale: Locale
  market: MarketProfile
  today: string
  usages: SupplyUsage[]
  action?: ReactNode
  onEdit: (usage: SupplyUsage) => void
  onFinish: (usage: SupplyUsage) => void
}) {
  const labels = dictionary.supplyTracker
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{finished ? labels.finished : labels.inUse}</h2>
        {action}
      </div>
      {usages.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {usages.map((usage) => {
            const { startedOn, finishedOn, expectedLifespanDays: expected } = usage
            const elapsed = Math.max(0, supplyElapsedDays(startedOn, finishedOn || today))

            return (
              <Card key={usage.id} className="flex min-w-0 flex-col">
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 pb-3">
                  <div className="min-w-0">
                    <CardTitle className="leading-snug wrap-anywhere">{usage.label || labels.unit}</CardTitle>
                    {usage.vendor && (
                      <p className="mt-1 text-sm text-muted-foreground wrap-anywhere">
                        {labels.vendor} · {usage.vendor}
                      </p>
                    )}
                  </div>
                  {!finishedOn && expected != null && (
                    <Badge variant="secondary" className="h-auto max-w-full whitespace-normal">
                      {supplyEstimateLabel(expected, elapsed, locale, labels)}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="flex-1 pb-3">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{labels.startedOn}</dt>
                      <dd><time dateTime={startedOn}>{supplyDateLabel(startedOn, locale)}</time></dd>
                    </div>
                    {usage.unitCostMinor != null && (
                      <div>
                        <dt className="text-muted-foreground">{dictionary.unitCost}</dt>
                        <dd className="font-medium tabular-nums">
                          {supplyCostLabel(usage.unitCostMinor, usage.costCurrencyCode, market, locale)}
                        </dd>
                      </div>
                    )}
                    {finishedOn && (
                      <div>
                        <dt className="text-muted-foreground">{labels.finishedOn}</dt>
                        <dd><time dateTime={finishedOn}>{supplyDateLabel(finishedOn, locale)}</time></dd>
                      </div>
                    )}
                    {expected != null && (
                      <div>
                        <dt className="text-muted-foreground">{labels.expected}</dt>
                        <dd className="tabular-nums">{supplyDayLabel(expected, locale, labels)}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-muted-foreground">{finishedOn ? labels.actualLifespan : labels.elapsed}</dt>
                      <dd className="font-semibold tabular-nums">
                        {finishedOn
                          ? supplyLifespanLabel(elapsed, locale, labels)
                          : supplyDayLabel(elapsed, locale, labels)}
                      </dd>
                    </div>
                    {usage.notes && (
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">{labels.notes}</dt>
                        <dd className="wrap-anywhere whitespace-pre-wrap">{usage.notes}</dd>
                      </div>
                    )}
                  </dl>
                  {finishedOn && expected != null && (
                    <p className="mt-3 text-sm font-medium">
                      {supplyLifespanComparison(expected, elapsed, locale, labels)}
                    </p>
                  )}
                </CardContent>
                <CardFooter className="flex-wrap gap-2">
                  {!finishedOn && (
                    <Button type="button" variant="success" onClick={() => onFinish(usage)}>
                      <Check aria-hidden="true" />
                      {labels.finish}
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => onEdit(usage)}>
                    {dictionary.edit}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          {finished ? labels.noFinished : labels.noOpen}
        </p>
      )}
    </section>
  )
}
