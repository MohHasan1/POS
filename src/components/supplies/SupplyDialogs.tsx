'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react'

import {
  archiveSupplyAction,
  correctSupplyUsageAction,
  finishSupplyUsageAction,
  saveSupplyAction,
  startSupplyUsageAction,
  type SupplyActionResult,
} from '@/actions/supplies'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary, Locale } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { decimalToMinor, minorToDecimal } from '@/lib/money'
import type { AvailableSupplyPurchase } from '@/lib/supply-stock'
import {
  SUPPLY_LABEL_LIMIT,
  SUPPLY_NAME_LIMIT,
  SUPPLY_NOTES_LIMIT,
  SUPPLY_VENDOR_LIMIT,
  supplyElapsedDays,
} from '@/lib/supplies'
import type { Supply, SupplyUsage } from '@/payload-types'

import { supplyCostLabel, supplyCostMarket, supplyLifespanLabel } from './format'
import { MANUAL_SUPPLY_ENTRY, SupplyPurchaseSelector } from './SupplyPurchaseSelector'

type DialogProps = {
  dictionary: Dictionary
  onClose: () => void
  onSaved?: () => void
}

export function SupplyDialog({
  dictionary,
  onClose,
  onSaved,
  title,
  description,
  submitLabel,
  action,
  children,
}: DialogProps & {
  title: string
  description?: string
  submitLabel: string
  action: (data: FormData) => Promise<SupplyActionResult>
  children?: ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError('')
    startTransition(async () => {
      const result = await action(data)
      if (!result.ok) {
        setError(dictionary.supplyTracker.errors[result.error])
        return
      }
      onSaved?.()
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit} aria-busy={pending}>
          {children && <fieldset className="space-y-3" disabled={pending}>{children}</fieldset>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="cancel" disabled={pending} onClick={onClose}>
              {dictionary.cancel}
            </Button>
            <Button type="submit" variant="success" disabled={pending}>
              {pending ? dictionary.saving : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function readSupplyCost(data: FormData, market: MarketProfile) {
  const value = String(data.get('unitCost') ?? '').trim()
  return value ? decimalToMinor(value, market) ?? undefined : null
}

function SupplyCostInput({ id, label, market, value }: {
  id: string
  label: string
  market: MarketProfile
  value?: number | null
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label} · {market.currencyCode}</Label>
      <Input
        id={id}
        name="unitCost"
        inputMode="decimal"
        defaultValue={value == null ? '' : minorToDecimal(value, market)}
        placeholder={minorToDecimal(0, market)}
      />
    </div>
  )
}

export function SupplySettingsDialog({
  market,
  supply,
  ...props
}: DialogProps & { market: MarketProfile; supply?: Supply }) {
  const id = useId()
  const labels = props.dictionary.supplyTracker

  return (
    <SupplyDialog
      {...props}
      title={supply ? labels.edit : labels.add}
      submitLabel={supply ? props.dictionary.save : labels.add}
      action={async (data) => {
        const expected = data.get('expected')
        const defaultUnitCostMinor = readSupplyCost(data, market)
        if (defaultUnitCostMinor === undefined) return { ok: false, error: 'invalidCost' }
        return saveSupplyAction({
          name: String(data.get('name') ?? ''),
          expectedLifespanDays: expected ? Number(expected) : null,
          defaultUnitCostMinor,
        }, supply?.id)
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`}>{labels.name}</Label>
        <Input id={`${id}-name`} name="name" defaultValue={supply?.name} maxLength={SUPPLY_NAME_LIMIT} required />
      </div>
      <SupplyCostInput
        id={`${id}-cost`}
        label={labels.defaultUnitCostOptional}
        market={market}
        value={supply?.defaultUnitCostMinor}
      />
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-expected`}>{labels.defaultLifespanOptional}</Label>
        <Input
          id={`${id}-expected`}
          name="expected"
          type="number"
          min={1}
          step={1}
          aria-describedby={`${id}-estimate-help`}
          defaultValue={supply?.expectedLifespanDays ?? undefined}
        />
        <p id={`${id}-estimate-help`} className="text-xs text-muted-foreground">{labels.estimateHelp}</p>
      </div>
    </SupplyDialog>
  )
}

export function SupplyArchiveDialog({ supply, ...props }: DialogProps & { supply: Supply }) {
  const labels = props.dictionary.supplyTracker
  const title = supply.archived ? labels.restore : labels.archive
  return (
    <SupplyDialog
      {...props}
      title={title}
      description={supply.archived ? labels.restoreDescription : labels.archiveDescription}
      submitLabel={title}
      action={() => archiveSupplyAction(supply.id, !supply.archived)}
    />
  )
}

export type UsageEditor =
  | { kind: 'start'; requestId: string; purchaseId?: string }
  | { kind: 'finish' | 'correct'; usage: SupplyUsage }

export function SupplyUsageDialog({
  availablePurchases,
  editor,
  locale,
  market,
  onFinished,
  onSaved,
  supply,
  today,
  ...props
}: DialogProps & {
  availablePurchases: AvailableSupplyPurchase[]
  editor: UsageEditor
  locale: Locale
  market: MarketProfile
  onFinished: (days: number) => void
  supply: Supply
  today: string
}) {
  const id = useId()
  const labels = props.dictionary.supplyTracker
  const usage = editor.kind === 'start' ? undefined : editor.usage
  const chooseStock = editor.kind === 'start' && availablePurchases.length > 0
  const [source, setSource] = useState<string | null>(
    editor.kind === 'start' ? editor.purchaseId ?? (chooseStock ? null : MANUAL_SUPPLY_ENTRY) : MANUAL_SUPPLY_ENTRY,
  )
  const purchase = availablePurchases.find(({ id }) => id === source)
  const hasRecordedCost = Boolean(usage?.purchase || purchase)
  const initialEstimate = editor.kind === 'start' ? supply.expectedLifespanDays : usage?.expectedLifespanDays
  const initialCost = editor.kind === 'start' ? supply.defaultUnitCostMinor : usage?.unitCostMinor
  const costMarket = supplyCostMarket(usage?.costCurrencyCode, market)
  const [startedOn, setStartedOn] = useState(usage?.startedOn ?? today)
  const [finishedOn, setFinishedOn] = useState(editor.kind === 'finish' ? today : usage?.finishedOn ?? '')
  const lifespan = startedOn && finishedOn && finishedOn >= startedOn && finishedOn <= today
    ? supplyElapsedDays(startedOn, finishedOn)
    : null
  const title = { start: labels.start, finish: labels.finish, correct: labels.correct }[editor.kind]
  const showFinishDate = editor.kind !== 'start'
  const finishRequired = editor.kind === 'finish' || supply.archived

  async function save(data: FormData): Promise<SupplyActionResult> {
    if (editor.kind === 'finish') return finishSupplyUsageAction(supply.id, editor.usage.id, finishedOn)
    if ((chooseStock || source !== null) && !purchase && source !== MANUAL_SUPPLY_ENTRY) {
      return { ok: false, error: 'stockUnavailable' }
    }
    const estimate = data.get('estimate')
    const unitCostMinor = hasRecordedCost ? undefined : readSupplyCost(data, costMarket)
    if (!hasRecordedCost && unitCostMinor === undefined) return { ok: false, error: 'invalidCost' }
    const details = {
      startedOn,
      label: String(data.get('label') ?? '') || null,
      vendor: String(data.get('vendor') ?? '') || null,
      notes: String(data.get('notes') ?? '') || null,
      expectedLifespanDays: estimate ? Number(estimate) : null,
      unitCostMinor,
    }
    if (editor.kind === 'start') return startSupplyUsageAction(supply.id, editor.requestId, { ...details, purchaseId: purchase?.id })
    return correctSupplyUsageAction(supply.id, editor.usage.id, { ...details, finishedOn: finishedOn || null })
  }

  return (
    <SupplyDialog
      {...props}
      title={title}
      submitLabel={editor.kind === 'correct' ? props.dictionary.save : title}
      action={save}
      onSaved={() => {
        if (editor.kind === 'finish' && lifespan !== null) onFinished(lifespan)
        onSaved?.()
      }}
    >
      {chooseStock && (
        <SupplyPurchaseSelector
          dictionary={props.dictionary} id={`${id}-stock`} locale={locale}
          onChange={setSource} purchases={availablePurchases} value={source}
        />
      )}
      {editor.kind !== 'finish' && (
        <>
          {purchase ? (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              {[
                purchase.vendor,
                purchase.unitCostMinor == null ? null : supplyCostLabel(purchase.unitCostMinor, purchase.costCurrencyCode, market, locale),
              ].filter(Boolean).join(' · ') || labels.unopenedCount.replace('{count}', String(purchase.remainingQuantity))}
            </p>
          ) : (!chooseStock || source === MANUAL_SUPPLY_ENTRY) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-label`}>{labels.labelOptional}</Label>
                <Input
                  id={`${id}-label`}
                  name="label"
                  defaultValue={usage?.label ?? ''}
                  placeholder={labels.labelPlaceholder}
                  maxLength={SUPPLY_LABEL_LIMIT}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-vendor`}>{labels.vendorOptional}</Label>
                <Input
                  id={`${id}-vendor`}
                  name="vendor"
                  defaultValue={usage?.vendor ?? ''}
                  maxLength={SUPPLY_VENDOR_LIMIT}
                />
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-started`}>{labels.startedOn}</Label>
              <Input
                id={`${id}-started`}
                type="date"
                min={purchase?.purchasedOn}
                max={today}
                value={startedOn}
                onChange={(event) => setStartedOn(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-estimate`}>{labels.expectedOptional}</Label>
              <Input
                id={`${id}-estimate`}
                name="estimate"
                type="number"
                min={1}
                step={1}
                defaultValue={initialEstimate ?? undefined}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {!hasRecordedCost && (!chooseStock || source === MANUAL_SUPPLY_ENTRY) && (
              <SupplyCostInput id={`${id}-cost`} label={labels.unitCostOptional} market={costMarket} value={initialCost} />
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-notes`}>{labels.notesOptional}</Label>
              <Textarea
                id={`${id}-notes`}
                name="notes"
                rows={2}
                defaultValue={usage?.notes ?? ''}
                maxLength={SUPPLY_NOTES_LIMIT}
              />
            </div>
          </div>
        </>
      )}
      {showFinishDate && (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-finished`}>{finishRequired ? labels.finishedOn : labels.finishedOptional}</Label>
          <Input
            id={`${id}-finished`}
            type="date"
            min={startedOn || undefined}
            max={today}
            value={finishedOn}
            onChange={(event) => setFinishedOn(event.target.value)}
            required={finishRequired}
            aria-describedby={!finishRequired && usage?.finishedOn ? `${id}-reopen-help` : undefined}
          />
          {!finishRequired && usage?.finishedOn && (
            <p id={`${id}-reopen-help`} className="text-xs text-muted-foreground">{labels.reopenHelp}</p>
          )}
        </div>
      )}
      {showFinishDate && lifespan !== null && Number.isFinite(lifespan) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
          <span>{labels.actualLifespan}</span>
          <strong className="tabular-nums">{supplyLifespanLabel(lifespan, locale, labels)}</strong>
        </div>
      )}
    </SupplyDialog>
  )
}
