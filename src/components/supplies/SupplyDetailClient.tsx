'use client'

import { ArrowLeft, Check, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Dictionary, Locale } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { supplyElapsedDays, type SupplyCostTotals, type SupplySummary } from '@/lib/supplies'
import type { Supply, SupplyUsage } from '@/payload-types'

import { supplyCostTotalsLabel, supplyDayLabel, supplyLifespanLabel, supplyNumber } from './format'
import { SupplyArchiveDialog, SupplySettingsDialog, SupplyUsageDialog, type UsageEditor } from './SupplyDialogs'
import { SupplyUsageCharts } from './SupplyUsageCharts'
import { SupplyUsageList } from './SupplyUsageList'

type SupplyEditor = { kind: 'settings' | 'archive' } | UsageEditor

export function SupplyDetailClient({ costs, dictionary, locale, market, today, supply, summary, usages }: {
  costs: SupplyCostTotals
  dictionary: Dictionary
  locale: Locale
  market: MarketProfile
  today: string
  supply: Supply
  summary: SupplySummary
  usages: SupplyUsage[]
}) {
  const [editor, setEditor] = useState<SupplyEditor | null>(null)
  const [lastFinishedId, setLastFinishedId] = useState<string>()
  const labels = dictionary.supplyTracker
  const active = usages.filter((usage) => !usage.finishedOn)
  const finished = usages.filter((usage) => usage.finishedOn)
  const expected = supply.expectedLifespanDays
  const lastFinished = finished.find((usage) => usage.id === lastFinishedId)
  const finishedLifespan = lastFinished?.finishedOn
    ? supplyElapsedDays(lastFinished.startedOn, lastFinished.finishedOn)
    : null
  const metrics = [
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
    setLastFinishedId(undefined)
    setEditor(next)
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
            {(supply.archived || summary.inUse === 0) && (
              <Button type="button" variant="outline" onClick={() => openEditor({ kind: 'archive' })}>
                {supply.archived ? labels.restore : labels.archive}
              </Button>
            )}
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {metrics.map(({ label, value }) => (
          <Card key={label} className="min-w-0 p-4">
            <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-xl font-semibold tabular-nums wrap-anywhere sm:text-2xl">{value}</dd>
          </Card>
        ))}
      </dl>

      {finishedLifespan !== null && (
        <div role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p>{labels.finishSaved}</p>
            <p className="font-semibold">{labels.actualLifespan} · {supplyLifespanLabel(finishedLifespan, locale, labels)}</p>
          </div>
        </div>
      )}
      <SupplyUsageList
        {...usageListProps}
        finished={false}
        usages={active}
        action={!supply.archived && (
          <Button
            type="button"
            variant="success"
            onClick={() => openEditor({ kind: 'start', requestId: crypto.randomUUID() })}
          >
            <Plus aria-hidden="true" />
            {labels.start}
          </Button>
        )}
      />
      {finished.length > 0 && (
        <SupplyUsageCharts dictionary={dictionary} locale={locale} today={today} usages={usages} />
      )}
      <SupplyUsageList {...usageListProps} finished usages={finished} />

      {editor?.kind === 'settings' && <SupplySettingsDialog {...dialogProps} market={market} />}
      {editor?.kind === 'archive' && <SupplyArchiveDialog {...dialogProps} />}
      {(editor?.kind === 'start' || editor?.kind === 'finish' || editor?.kind === 'correct') && (
        <SupplyUsageDialog
          {...dialogProps}
          editor={editor}
          locale={locale}
          market={market}
          today={today}
          onSaved={() => { if (editor.kind === 'finish') setLastFinishedId(editor.usage.id) }}
        />
      )}
    </div>
  )
}
