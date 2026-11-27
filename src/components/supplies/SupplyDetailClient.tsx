'use client'

import { ArrowLeft, Check, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Dictionary, Locale } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import type { AvailableSupplyPurchase } from '@/lib/supply-stock'
import type { getSupplyUsageTrends, SupplyCostTotals, SupplySummary } from '@/lib/supplies'
import type { Supply, SupplyUsage } from '@/payload-types'

import { AvailableSupplyStock } from './AvailableSupplyStock'
import { supplyCostTotalsLabel, supplyDayLabel, supplyLifespanLabel, supplyNumber } from './format'
import { SupplyArchiveDialog, SupplySettingsDialog, SupplyUsageDialog, type UsageEditor } from './SupplyDialogs'
import { SupplyPagination } from './SupplyPagination'
import { SupplyPurchaseDialog } from './SupplyPurchaseDialog'
import { SupplyStockPanel, type SupplyPurchaseHistory } from './SupplyStockPanel'
import { SupplyUsageCharts } from './SupplyUsageCharts'
import { SupplyUsageList } from './SupplyUsageList'

type SupplyEditor = { kind: 'settings' | 'archive' } | { kind: 'purchase'; requestId: string } | UsageEditor

export function SupplyDetailClient({ active, availablePurchases, costs, dictionary, finished, includeOpened, locale, market, purchaseHistory, today, supply, summary, trends }: {
  active: SupplyUsage[]
  availablePurchases: AvailableSupplyPurchase[]
  costs: SupplyCostTotals
  dictionary: Dictionary
  finished: { records: SupplyUsage[]; page: number; totalPages: number }
  includeOpened: boolean
  locale: Locale
  market: MarketProfile
  purchaseHistory: SupplyPurchaseHistory | null
  today: string
  supply: Supply
  summary: SupplySummary
  trends: ReturnType<typeof getSupplyUsageTrends> | null
}) {
  const [editor, setEditor] = useState<SupplyEditor | null>(null)
  const [finishedLifespan, setFinishedLifespan] = useState<number | null>(null)
  const [purchaseSaved, setPurchaseSaved] = useState(false)
  const labels = dictionary.supplyTracker
  const path = `/supplies/${supply.id}`
  const stockHref = `${path}?tab=stock#supply-detail`
  const unopened = availablePurchases.reduce((sum, purchase) => sum + purchase.remainingQuantity, 0)
  const expected = supply.expectedLifespanDays
  const metrics = [
    { label: labels.unopened, value: supplyNumber(unopened, locale) },
    { label: labels.inUse, value: supplyNumber(summary.inUse, locale) },
    { label: labels.finishedUnits, value: supplyNumber(summary.finished, locale) },
    {
      label: labels.lastLifespan,
      value: summary.lastLifespan === null ? '—' : supplyLifespanLabel(summary.lastLifespan, locale, labels),
    },
    {
      label: labels.averageLifespan,
      value: summary.averageLifespan === null ? '—' : supplyDayLabel(summary.averageLifespan, locale, labels),
    },
    ...(expected == null ? [] : [{ label: labels.defaultLifespan, value: supplyDayLabel(expected, locale, labels) }]),
    {
      label: labels.totalRecordedCost,
      value: supplyCostTotalsLabel(costs, market, locale),
    },
    {
      label: labels.averageUnitCost,
      value: supplyCostTotalsLabel(costs, market, locale, ({ totalMinor, units }) => Math.round(totalMinor / units)),
    },
    {
      label: labels.lowestUnitCost,
      value: supplyCostTotalsLabel(costs, market, locale, ({ lowestMinor }) => lowestMinor),
    },
    {
      label: labels.highestUnitCost,
      value: supplyCostTotalsLabel(costs, market, locale, ({ highestMinor }) => highestMinor),
    },
  ]
  const dialogProps = { dictionary, supply, onClose: () => setEditor(null) }
  function openEditor(next: SupplyEditor) {
    setFinishedLifespan(null)
    setPurchaseSaved(false)
    setEditor(next)
  }
  function startStockUsage(purchaseId: string) {
    openEditor({ kind: 'start', requestId: crypto.randomUUID(), purchaseId })
  }

  const usageListProps = {
    dictionary,
    locale,
    market,
    today,
    onEdit: (usage: SupplyUsage) => openEditor({ kind: 'correct', usage }),
    onFinish: (usage: SupplyUsage) => openEditor({ kind: 'finish', usage }),
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Link href="/supplies" className={buttonVariants({ variant: 'ghost', size: 'sm', className: '-ml-2' })}>
          <ArrowLeft aria-hidden="true" />
          {labels.back}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-all text-2xl font-semibold tracking-tight">{supply.name}</h1>
            {supply.archived && <Badge variant="secondary">{labels.archived}</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => openEditor({ kind: 'settings' })}>
              {labels.edit}
            </Button>
            {!supply.archived && (
              <Button type="button" variant="outline" onClick={() => openEditor({ kind: 'purchase', requestId: crypto.randomUUID() })}>
                <Plus aria-hidden="true" />
                {labels.addPurchase}
              </Button>
            )}
            {!supply.archived && !purchaseHistory && (
              <Button type="button" variant="success" onClick={() => openEditor({ kind: 'start', requestId: crypto.randomUUID() })}>
                <Plus aria-hidden="true" />
                {labels.start}
              </Button>
            )}
            {(supply.archived || summary.inUse === 0) && (
              <Button type="button" variant="outline" onClick={() => openEditor({ kind: 'archive' })}>
                {supply.archived ? labels.restore : labels.archive}
              </Button>
            )}
          </div>
        </div>
      </header>

      <nav id="supply-detail" aria-label={labels.supplyViews} className="flex scroll-mt-20 flex-wrap gap-2 border-b pb-2">
        <Link href={`${path}#supply-detail`} aria-current={!purchaseHistory ? 'page' : undefined} className={buttonVariants({ variant: !purchaseHistory ? 'secondary' : 'ghost' })}>
          {labels.usageTab}
        </Link>
        <Link href={stockHref} aria-current={purchaseHistory ? 'page' : undefined} className={buttonVariants({ variant: purchaseHistory ? 'secondary' : 'ghost' })}>
          {labels.stockTab}
        </Link>
      </nav>
      {purchaseSaved && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{labels.purchaseSaved}</p>}
      <div className="space-y-3">
        {!purchaseHistory && <h2 className="font-semibold">{labels.overview}</h2>}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {(purchaseHistory ? metrics.slice(0, 2) : metrics).map(({ label, value }) => (
            <Card key={label} className="min-w-0 p-4">
              <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-2 text-xl font-semibold tabular-nums wrap-anywhere sm:text-2xl">{value}</dd>
            </Card>
          ))}
        </dl>
      </div>
      {!purchaseHistory && (
        <AvailableSupplyStock
          dictionary={dictionary}
          locale={locale}
          onStart={supply.archived ? undefined : startStockUsage}
          purchases={availablePurchases}
          stockHref={stockHref}
        />
      )}
      {finishedLifespan !== null && (
        <div role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p>{labels.finishSaved}</p>
            <p className="font-semibold">{labels.actualLifespan} · {supplyLifespanLabel(finishedLifespan, locale, labels)}</p>
          </div>
        </div>
      )}
      {purchaseHistory ? (
        <SupplyStockPanel
          dictionary={dictionary} history={purchaseHistory} includeOpened={includeOpened} locale={locale}
          market={market} supply={supply} onStart={startStockUsage}
        />
      ) : (
        <>
          <SupplyUsageList
            {...usageListProps}
            finished={false}
            usages={active}
          />
          {trends && trends.recent.length > 0 && <SupplyUsageCharts dictionary={dictionary} locale={locale} trends={trends} />}
          <div id="finished-usage" className="scroll-mt-20 space-y-3">
            <SupplyUsageList
              {...usageListProps}
              finished
              usages={finished.records}
              pagination={
                <SupplyPagination
                  dictionary={dictionary} locale={locale} page={finished.page} totalPages={finished.totalPages}
                  href={(page) => `${path}${page > 1 ? `?page=${page}` : ''}#finished-usage`}
                />
              }
            />
          </div>
        </>
      )}

      {editor?.kind === 'settings' && <SupplySettingsDialog {...dialogProps} market={market} />}
      {editor?.kind === 'archive' && <SupplyArchiveDialog {...dialogProps} />}
      {editor?.kind === 'purchase' && (
        <SupplyPurchaseDialog
          dictionary={dictionary} locale={locale} market={market} today={today}
          supplies={[supply]} requestId={editor.requestId} onClose={dialogProps.onClose}
          onSaved={() => setPurchaseSaved(true)}
        />
      )}
      {(editor?.kind === 'start' || editor?.kind === 'finish' || editor?.kind === 'correct') && (
        <SupplyUsageDialog
          {...dialogProps}
          availablePurchases={availablePurchases}
          editor={editor}
          locale={locale}
          market={market}
          today={today}
          onFinished={setFinishedLifespan}
        />
      )}
    </div>
  )
}
