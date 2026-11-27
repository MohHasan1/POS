import Link from 'next/link'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { Dictionary, Locale } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { supplyPageHref } from '@/lib/supply-stock'
import type { Supply, SupplyPurchase } from '@/payload-types'

import { supplyCostLabel, supplyDateLabel, supplyNumber } from './format'
import { SupplyPagination } from './SupplyPagination'

export type SupplyPurchaseHistory = { records: SupplyPurchase[]; page: number; totalPages: number }

export function SupplyStockPanel({ dictionary, history, includeOpened, locale, market, onStart, supply }: {
  dictionary: Dictionary
  history: SupplyPurchaseHistory
  includeOpened: boolean
  locale: Locale
  market: MarketProfile
  onStart: (purchaseId: string) => void
  supply: Supply
}) {
  const labels = dictionary.supplyTracker
  const path = `/supplies/${supply.id}`
  const stockHref = (filter: boolean, page = 1) => supplyPageHref(path, {
    tab: 'stock', purchases: filter ? 'all' : undefined, page: page > 1 ? String(page) : undefined,
  }) + '#supply-detail'
  const pagination = (
    <SupplyPagination dictionary={dictionary} locale={locale} page={history.page} totalPages={history.totalPages} href={(page) => stockHref(includeOpened, page)} />
  )
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Link href={stockHref(false)} aria-current={!includeOpened ? 'page' : undefined} className={buttonVariants({ variant: !includeOpened ? 'secondary' : 'ghost' })}>
          {labels.availableStock}
        </Link>
        <Link href={stockHref(true)} aria-current={includeOpened ? 'page' : undefined} className={buttonVariants({ variant: includeOpened ? 'secondary' : 'ghost' })}>
          {labels.allPurchases}
        </Link>
      </div>
      {pagination}
      {history.records.length === 0 ? (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          {includeOpened ? labels.noPurchases : labels.noUnopenedStock}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {history.records.map((purchase) => {
            const expenseId = typeof purchase.expense === 'string' ? purchase.expense : purchase.expense?.id
            return (
              <Card key={purchase.id} className="flex min-w-0 flex-col">
                <CardHeader className="flex-row justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="leading-snug wrap-anywhere">{purchase.name}</CardTitle>
                    {purchase.vendor && <p className="mt-1 text-xs text-muted-foreground wrap-anywhere">{purchase.vendor}</p>}
                  </div>
                  <time dateTime={purchase.purchasedOn} className="shrink-0 text-xs text-muted-foreground">
                    {supplyDateLabel(purchase.purchasedOn, locale)}
                  </time>
                </CardHeader>
                <CardContent className="flex-1">
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div><dt className="text-muted-foreground">{labels.unopened}</dt><dd className="font-semibold tabular-nums">{supplyNumber(purchase.remainingQuantity, locale)}</dd></div>
                    <div><dt className="text-muted-foreground">{labels.unitsPurchased}</dt><dd className="font-semibold tabular-nums">{supplyNumber(purchase.quantity, locale)}</dd></div>
                    {purchase.unitCostMinor != null && (
                      <div><dt className="text-muted-foreground">{dictionary.unitCost}</dt><dd className="font-semibold tabular-nums">{supplyCostLabel(purchase.unitCostMinor, purchase.costCurrencyCode, market, locale)}</dd></div>
                    )}
                  </dl>
                  {purchase.notes && <p className="mt-3 text-sm text-muted-foreground wrap-anywhere whitespace-pre-wrap">{purchase.notes}</p>}
                </CardContent>
                {(!supply.archived && purchase.remainingQuantity > 0 || expenseId) && (
                  <CardFooter className="flex-wrap gap-2">
                    {!supply.archived && purchase.remainingQuantity > 0 && (
                      <Button type="button" variant="success" onClick={() => onStart(purchase.id)}>{labels.start}</Button>
                    )}
                    {expenseId && <Link href={`/expenses?expense=${encodeURIComponent(expenseId)}#expense-history`} className={buttonVariants({ variant: 'outline' })}>{labels.viewExpense}</Link>}
                  </CardFooter>
                )}
              </Card>
            )
          })}
        </div>
      )}
      {pagination}
    </section>
  )
}
