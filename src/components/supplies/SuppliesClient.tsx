'use client'

import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Dictionary, Locale } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { SUPPLY_CATALOG_PAGE_SIZE, paginateSupplies, supplyPageHref, supplyPageNumber, type SupplyStockCount } from '@/lib/supply-stock'
import { matchesSupplyFilter, type SupplyCostTotals, type SupplyOverview, type SupplySummary } from '@/lib/supplies'
import type { Supply } from '@/payload-types'

import { supplyCostLabel, supplyCostTotalsLabel, supplyDayLabel, supplyLifespanLabel, supplyNumber } from './format'
import { SuppliesOverview } from './SuppliesOverview'
import { SupplyPagination } from './SupplyPagination'
import { SupplyPurchaseDialog } from './SupplyPurchaseDialog'
import { SupplySettingsDialog } from './SupplyDialogs'

export function SuppliesClient({ entries, currentStock, dictionary, locale, market, overview, today }: {
  entries: { supply: Supply; summary: SupplySummary; costs: SupplyCostTotals; unopened: number }[]
  currentStock: SupplyStockCount[]
  dictionary: Dictionary
  locale: Locale
  market: MarketProfile
  overview: SupplyOverview
  today: string
}) {
  const params = useSearchParams()
  const query = params.get('q') ?? ''
  const archiveFilter = params.get('status') === 'archived'
  const [filters, setFilters] = useState({ search: query, archived: archiveFilter, query, archiveFilter })
  if (filters.query !== query || filters.archiveFilter !== archiveFilter) {
    setFilters({ search: query, archived: archiveFilter, query, archiveFilter })
  }
  const { archived, search } = filters
  const [creating, setCreating] = useState(false)
  const [purchaseId, setPurchaseId] = useState<string>()
  const [purchaseSaved, setPurchaseSaved] = useState(false)
  const labels = dictionary.supplyTracker
  const activeSupplies = entries.filter(({ supply }) => !supply.archived).map(({ supply }) => ({ id: supply.id, name: supply.name }))
  const visible = paginateSupplies(
    entries.filter(({ supply }) => matchesSupplyFilter(supply, search, archived)),
    supplyPageNumber(params.get('page') ?? undefined),
    SUPPLY_CATALOG_PAGE_SIZE,
  )
  function catalogHref(q: string, archived: boolean, page = 1) {
    return supplyPageHref('/supplies', { q, status: archived ? 'archived' : undefined, page: page > 1 ? String(page) : undefined }) + '#supply-list'
  }
  function filterCatalog(q: string, archived: boolean) {
    setFilters({ search: q, archived, query, archiveFilter })
    if (q !== query || archived !== archiveFilter || params.has('page')) {
      window.history.replaceState(null, '', catalogHref(q, archived))
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{labels.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="#supply-list" className={buttonVariants({ variant: 'outline' })}>{labels.supplyList}</Link>
          {activeSupplies.length > 0 && (
            <Button type="button" variant="outline" onClick={() => {
              setPurchaseSaved(false)
              setPurchaseId(crypto.randomUUID())
            }}>{labels.addPurchase}</Button>
          )}
          <Button type="button" variant="success" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            {labels.add}
          </Button>
        </div>
      </header>

      {purchaseSaved && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{labels.purchaseSaved}</p>}
      <SuppliesOverview overview={overview} dictionary={dictionary} locale={locale} market={market} currentStock={currentStock} />
      <h2 id="supply-list" className="scroll-mt-20 font-semibold" tabIndex={-1}>{labels.supplyList}</h2>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            className="pl-8"
            aria-label={labels.search}
            placeholder={labels.search}
            value={search}
            onChange={(event) => filterCatalog(event.target.value, archived)}
          />
        </div>
        <Select value={archived ? 'archived' : 'active'} onValueChange={(value) => filterCatalog(search, value === 'archived')}>
          <SelectTrigger aria-label={dictionary.status} className="w-full">
            <SelectValue>{archived ? labels.archived : dictionary.active}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{dictionary.active}</SelectItem>
            <SelectItem value="archived">{labels.archived}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.records.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.records.map(({ supply, summary, costs, unopened }) => (
            <Link
              key={supply.id}
              href={`/supplies/${supply.id}`}
              className="group block min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${labels.viewUsage} · ${supply.name}`}
            >
              <Card className="h-full transition-colors group-hover:bg-accent/40">
                <CardHeader>
                  <CardTitle className="leading-snug wrap-anywhere underline-offset-4 group-hover:underline">
                    {supply.name}
                  </CardTitle>
                  {supply.expectedLifespanDays != null && (
                    <p className="text-xs text-muted-foreground">
                      {labels.defaultLifespan} · {supplyDayLabel(supply.expectedLifespanDays, locale, labels)}
                    </p>
                  )}
                  {supply.defaultUnitCostMinor != null && (
                    <p className="text-xs text-muted-foreground">
                      {labels.defaultUnitCost} · {supplyCostLabel(supply.defaultUnitCostMinor, market.currencyCode, market, locale)}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 xl:grid-cols-5">
                    <div>
                      <dt className="text-muted-foreground">{labels.unopened}</dt>
                      <dd className="font-semibold tabular-nums">{supplyNumber(unopened, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{labels.inUse}</dt>
                      <dd className="font-semibold tabular-nums">{supplyNumber(summary.inUse, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{labels.lastLifespan}</dt>
                      <dd className="font-semibold tabular-nums">
                        {summary.lastLifespan === null ? '—' : supplyLifespanLabel(summary.lastLifespan, locale, labels)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{labels.averageLifespan}</dt>
                      <dd className="font-semibold tabular-nums">
                        {summary.averageLifespan === null ? '—' : supplyDayLabel(summary.averageLifespan, locale, labels)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{labels.totalRecordedCost}</dt>
                      <dd className="font-semibold tabular-nums wrap-anywhere">{supplyCostTotalsLabel(costs, market, locale)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          {search.trim() ? labels.noMatches : archived ? labels.noArchived : labels.noActive}
        </p>
      )}
      <SupplyPagination dictionary={dictionary} locale={locale} page={visible.page} totalPages={visible.totalPages} href={(page) => catalogHref(search, archived, page)} />
      {creating && (
        <SupplySettingsDialog
          dictionary={dictionary}
          market={market}
          onClose={() => setCreating(false)}
          onSaved={() => filterCatalog('', false)}
        />
      )}
      {purchaseId && (
        <SupplyPurchaseDialog
          dictionary={dictionary} locale={locale} market={market} today={today} supplies={activeSupplies}
          requestId={purchaseId} onClose={() => setPurchaseId(undefined)} onSaved={() => setPurchaseSaved(true)}
        />
      )}
    </div>
  )
}
