'use client'

import { useEffect, useId, useState, useTransition, type FormEvent } from 'react'

import { getCashMovementBalancesAction, recordCashMovementAction } from '@/actions/cash'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cashMovementSchema, type CashAccount, type CashBalances, type CashMovementInput } from '@/lib/cash'
import type { Dictionary } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { signedDecimalToMinor } from '@/lib/money'

import { CashMovementFields } from './CashMovementFields'

type MovementKind = CashMovementInput['kind']

export function CashMovementDialog({ canReconcile, dictionary, market, money, today, onClose, onSaved }: {
  canReconcile: boolean
  dictionary: Dictionary
  market: MarketProfile
  money: (minor: number) => string
  today: string
  onClose: () => void
  onSaved: () => void
}) {
  const copy = dictionary.cashSummary
  const id = useId()
  const [requestId] = useState(() => crypto.randomUUID())
  const [kind, setKind] = useState<MovementKind>('income')
  const [transferFrom, setTransferFrom] = useState<CashAccount>('cash')
  const [date, setDate] = useState(today)
  const [loadedBalance, setLoadedBalance] = useState<{ date: string; balances: CashBalances | null }>()
  const [error, setError] = useState('')
  const [loading, startTransition] = useTransition()
  const reconciles = kind === 'reconcile'
  const balanceDate = reconciles ? today : date
  const balances = loadedBalance?.date === balanceDate ? loadedBalance.balances : undefined
  const options: { value: MovementKind; label: string }[] = (['income', 'outflow', 'transfer', 'reconcile'] as const)
    .filter((value) => value !== 'reconcile' || canReconcile)
    .map((value) => ({ value, label: copy[value] }))
  const accounts = [
    { value: 'cash', label: copy.hand, balanceKey: 'cashMinor' },
    { value: 'bank', label: dictionary.payrollBank, balanceKey: 'bankMinor' },
  ] as const

  useEffect(() => {
    let active = true
    void getCashMovementBalancesAction(balanceDate).then(
      (result) => { if (active) setLoadedBalance({ date: balanceDate, balances: result.ok ? result.data ?? null : null }) },
      () => { if (active) setLoadedBalance({ date: balanceDate, balances: null }) },
    )
    return () => { active = false }
  }, [balanceDate])

  async function save(data: FormData) {
    const amount = (name: string) => {
      const value = String(data.get(name) || '').trim()
      return value ? signedDecimalToMinor(value, market) : undefined
    }
    const amounts = kind === 'transfer'
      ? { account: transferFrom, amountMinor: amount('amount') }
      : { cashMinor: amount('cash'), bankMinor: amount('bank') }
    const parsed = cashMovementSchema.safeParse({
      id: requestId, kind, ...amounts,
      date: reconciles ? today : data.get('date'), note: data.get('note') ?? '',
    })
    if (!parsed.success) return { ok: false, error: copy.amountError }
    return recordCashMovementAction(parsed.data)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError('')
    startTransition(async () => {
      const result = await save(data)
      if (!result.ok) setError(result.error)
      else onSaved()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !loading) onClose() }}>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{copy.movement}</DialogTitle>
          <DialogDescription>{copy.movementDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" aria-busy={loading}>
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm font-medium">
              {copy.movementBalances}
            </p>
            {balances ? (
              <Card className="grid grid-cols-2 gap-3 p-3">
                {accounts.map(({ value, label, balanceKey }) => (
                  <dl key={value}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {money(balances[balanceKey])}
                    </dd>
                  </dl>
                ))}
              </Card>
            ) : <p className="text-sm text-muted-foreground">{balances === undefined ? dictionary.loading : copy.movementBalancesUnavailable}</p>}
          </div>
          <fieldset disabled={loading} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={id + 'kind'}>{copy.kind}</Label>
              <Select items={options} value={kind} onValueChange={(value) => { if (value) setKind(value) }}>
                <SelectTrigger id={id + 'kind'} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{options.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <CashMovementFields accounts={accounts} balances={balances} dictionary={dictionary} id={id}
              kind={kind} market={market} transferFrom={transferFrom} onTransferFromChange={setTransferFrom} />
            {!reconciles && (
              <div className="space-y-1.5">
                <Label htmlFor={id + 'date'}>{dictionary.date}</Label>
                <Input id={id + 'date'} name="date" type="date" value={date} max={today} required
                  onChange={(event) => setDate(event.target.value)} />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={id + 'note'}>{reconciles ? dictionary.reason : dictionary.note}</Label>
              <Textarea name="note" id={id + 'note'} maxLength={500} rows={2} required={reconciles} />
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="cancel" disabled={loading} onClick={onClose}>{dictionary.cancel}</Button>
            <Button type="submit" variant="success" disabled={loading}>{loading ? dictionary.saving : dictionary.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
