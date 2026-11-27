import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Dictionary, Locale } from '@/lib/localization'
import type { SupplyStockCount } from '@/lib/supply-stock'

import { supplyNumber } from './format'

export function SupplyStockChart({ counts, dictionary, locale }: {
  counts: SupplyStockCount[]
  dictionary: Dictionary
  locale: Locale
}) {
  const labels = dictionary.supplyTracker
  const max = counts.reduce((current, row) => Math.max(current, row.unopened + row.inUse), 1)
  return (
    <Card>
      <CardHeader><CardTitle>{labels.currentStock}</CardTitle></CardHeader>
      <CardContent>
        {counts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.noActive}</p>
        ) : (
          <ul className="max-h-72 space-y-3 overflow-y-auto pr-1" tabIndex={0} aria-label={labels.currentStock}>
            {counts.map(({ id, name, unopened, inUse }) => (
              <li key={id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                  <Link href={`/supplies/${id}?tab=stock`} className="font-medium wrap-anywhere hover:underline">{name}</Link>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-chart-2" aria-hidden="true" />
                      {labels.unopened} {supplyNumber(unopened, locale)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                      {labels.inUse} {supplyNumber(inUse, locale)}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="bg-chart-2" style={{ width: `${unopened * 100 / max}%` }} />
                  <div className="bg-primary" style={{ width: `${inUse * 100 / max}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
