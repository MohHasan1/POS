'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'

import { getPreviousClosingCashAction, saveDailyCashOpeningAction } from '@/actions/cash'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dailyCashOpeningSchema, type CashBalances } from '@/lib/cash'
import type { Dictionary } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { minorToDecimal, signedDecimalToMinor } from '@/lib/money'

export function CashOpeningDialog({ date, today, balances, dictionary, market, onClose, onSaved }: {
  date: string
  today: string
  balances: CashBalances
  dictionary: Dictionary
  market: MarketProfile
  onClose: () => void
  onSaved: () => void
}) {
  const id = useId()
  const copy = dictionary.cashSummary
  const [pending, startTransition] = useTransition()
  const [syncing, startSync] = useTransition()
  const [cash, setCash] = useState(() => minorToDecimal(balances.cashMinor, market))
  const [synced, setSynced] = useState(false)
  const [error, setError] = useState('')
  const busy = pending || syncing

  function syncCash() {
    setSynced(false)
    setError('')
    startSync(async () => {
      const result = await getPreviousClosingCashAction(date)
      if (!result.ok) setError(result.error)
      else if (result.data == null) setError(copy.noPreviousClosing)
      else {
        setCash(minorToDecimal(result.data, market))
        setSynced(true)
      }
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const input = dailyCashOpeningSchema.safeParse({
      date,
      cashMinor: signedDecimalToMinor(String(data.get('cash') || ''), market),
      bankMinor: signedDecimalToMinor(String(data.get('bank') || ''), market),
    })
    if (!input.success) return setError(copy.amountError)
    setError('')
    startTransition(async () => {
      const result = await saveDailyCashOpeningAction(input.data)
      if (result.ok) onSaved()
      else setError(result.error)
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{copy.editOpeningBalances}</DialogTitle>
          <DialogDescription>{copy.editOpeningDescription.replace('{date}', date)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={id + 'cash'}>{copy.hand} · {market.currencyCode}</Label>
              <Input id={id + 'cash'} name="cash" inputMode="decimal" required value={cash}
                onChange={(event) => { setCash(event.target.value); setSynced(false) }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id + 'bank'}>{dictionary.payrollBank} · {market.currencyCode}</Label>
              <Input id={id + 'bank'} name="bank" inputMode="decimal" required defaultValue={minorToDecimal(balances.bankMinor, market)} />
            </div>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={syncCash}>
              {syncing ? dictionary.loading : date === today ? copy.syncFromYesterday : copy.syncFromPreviousDay}
            </Button>
          </fieldset>
          {synced && <p role="status" className="text-sm text-muted-foreground">{copy.openingCashSynced}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="cancel" onClick={onClose} disabled={busy}>{dictionary.cancel}</Button>
            <Button type="submit" variant="success" disabled={busy}>{pending ? dictionary.saving : dictionary.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
