import Link from 'next/link'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Dictionary, Locale } from '@/lib/localization'
import type { AvailableSupplyPurchase } from '@/lib/supply-stock'

import { supplyDateLabel, supplyNumber } from './format'

const STOCK_PREVIEW_LIMIT = 4

export function AvailableSupplyStock({ dictionary, locale, onStart, purchases, stockHref }: {
  dictionary: Dictionary
  locale: Locale
  onStart?: (purchaseId: string) => void
  purchases: AvailableSupplyPurchase[]
  stockHref: string
}) {
  const labels = dictionary.supplyTracker

  return (
    <Card>
      <section aria-labelledby="available-supply-stock">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <h2 id="available-supply-stock" className="font-semibold">{labels.availableStock}</h2>
          <Link href={stockHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {labels.viewStock}
          </Link>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noUnopenedStock}</p>
          ) : (
            <ul className="divide-y">
              {purchases.slice(0, STOCK_PREVIEW_LIMIT).map((purchase) => (
                <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1 basis-32">
                    <p className="text-sm font-medium wrap-anywhere">{purchase.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground wrap-anywhere">
                      {purchase.vendor && `${purchase.vendor} · `}
                      <time dateTime={purchase.purchasedOn}>{supplyDateLabel(purchase.purchasedOn, locale)}</time>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm tabular-nums">
                      {labels.unopenedCount.replace('{count}', supplyNumber(purchase.remainingQuantity, locale))}
                    </span>
                    {onStart && (
                      <Button
                        type="button"
                        size="sm"
                        variant="success"
                        aria-label={`${labels.start} · ${purchase.name}`}
                        onClick={() => onStart(purchase.id)}
                      >
                        {labels.start}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </section>
    </Card>
  )
}
