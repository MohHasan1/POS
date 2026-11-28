'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'

import { closeCashDayAction } from '@/actions/cash'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cashClosingSchema, type CashBalances } from '@/lib/cash'
import type { Dictionary } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { decimalToMinor, minorToDecimal, signedDecimalToMinor } from '@/lib/money'
import type { CashClosing } from '@/payload-types'

import { CashClosingAccountFields, type ClosingAccountInput } from './CashClosingAccountFields'

const emptyAccount = { counted: '', withdrawal: '' }

export function CashCloseDayDialog({ businessDate, balances, closing, dictionary, market, money, onClose, onSaved }: {
  businessDate: string
  balances: CashBalances
  closing: CashClosing | null
  dictionary: Dictionary
  market: MarketProfile
  money: (amount: number) => string
  onClose: () => void
  onSaved: () => void
}) {
  const copy = dictionary.cashSummary
  const id = useId()
  const amountInput = (amount?: number | null) => amount == null ? '' : minorToDecimal(amount, market)
  const [requestId] = useState(() => crypto.randomUUID())
  const [expected, setExpected] = useState(balances)
  const [cash, setCash] = useState<ClosingAccountInput>(() => closing
    ? { counted: amountInput(closing.actualCashMinor), withdrawal: amountInput(closing.ownerPickupMinor) }
    : emptyAccount)
  const [bank, setBank] = useState<ClosingAccountInput>(() => closing
    ? { counted: amountInput(closing.actualBankMinor), withdrawal: amountInput(closing.bankPickupMinor) }
    : emptyAccount)
  const [cashForTomorrow, setCashForTomorrow] = useState(() => amountInput(closing?.nextDayCashMinor))
  const [error, setError] = useState('')
  const [loading, startTransition] = useTransition()
  const actualCashMinor = decimalToMinor(cash.counted, market)
  const countsBank = Boolean(bank.counted.trim())
  const actualBankMinor = countsBank ? signedDecimalToMinor(bank.counted, market) : null
  const ownerPickupMinor = cash.withdrawal.trim() ? decimalToMinor(cash.withdrawal, market) : 0
  const bankPickupMinor = bank.withdrawal.trim() ? decimalToMinor(bank.withdrawal, market) : 0
  const nextDayCashMinor = cashForTomorrow.trim() ? decimalToMinor(cashForTomorrow, market)
    : closing && closing.nextDayCashMinor == null ? undefined : 0
  const remainingCash = actualCashMinor === null || ownerPickupMinor === null ? 0 : Math.max(0, actualCashMinor - ownerPickupMinor)
  const hasDifference = (actualCashMinor !== null && actualCashMinor !== expected.cashMinor) ||
    (actualBankMinor !== null && actualBankMinor !== expected.bankMinor)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = cashClosingSchema.safeParse({
      businessDate, requestId, expectedCashMinor: expected.cashMinor, actualCashMinor, ownerPickupMinor, nextDayCashMinor,
      revision: closing?.lastEditRequestId ?? closing?.requestId,
      expectedBankMinor: countsBank ? expected.bankMinor : undefined,
      actualBankMinor: countsBank ? actualBankMinor : undefined,
      bankPickupMinor: countsBank || bank.withdrawal.trim() ? bankPickupMinor : undefined,
      note: new FormData(event.currentTarget).get('note'),
    })
    if (!parsed.success) {
      setError(copy.closingErrors.invalid)
      return
    }
    setError('')
    startTransition(async () => {
      const result = await closeCashDayAction(parsed.data)
      if (result.status === 'saved' || result.status === 'alreadyClosed') {
        onSaved()
      } else if (result.status === 'drawerChanged') {
        setExpected(result.balances)
        setError(copy.closingErrors.drawerChanged)
      } else {
        setError(copy.closingErrors[result.status])
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !loading) onClose() }}>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{closing ? copy.editClosing : copy.closeDay}</DialogTitle>
          <DialogDescription>{copy.closeDayHelp}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" aria-busy={loading}>
          <fieldset disabled={loading} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <CashClosingAccountFields account="cash" id={id + 'cash'} expected={expected.cashMinor}
                actual={actualCashMinor} withdrawal={ownerPickupMinor} reserved={nextDayCashMinor ?? 0} values={cash}
                onChange={setCash} market={market} money={money} dictionary={dictionary} />
              <CashClosingAccountFields account="bank" id={id + 'bank'} expected={expected.bankMinor}
                actual={actualBankMinor} withdrawal={bankPickupMinor} values={bank}
                onChange={setBank} market={market} money={money} dictionary={dictionary} />
            </div>
            <fieldset className="space-y-2 rounded-lg bg-muted/40 p-3">
              <legend className="px-1 text-sm font-semibold">{copy.cashForTomorrow}</legend>
              <p className="text-sm text-muted-foreground">{copy.cashForTomorrowHelp}</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-28 flex-1 space-y-1.5">
                  <Label htmlFor={id + 'cashForTomorrow'}>{dictionary.amount} · {market.currencyCode}</Label>
                  <Input id={id + 'cashForTomorrow'} inputMode="decimal" placeholder="0" value={cashForTomorrow}
                    onChange={(event) => setCashForTomorrow(event.target.value)} />
                </div>
                <Button type="button" variant="outline" disabled={remainingCash <= 0}
                  onClick={() => setCashForTomorrow(minorToDecimal(remainingCash, market))}>
                  {copy.useRemainingCash}
                </Button>
              </div>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor={id + 'note'}>{hasDifference ? dictionary.reason : dictionary.note}</Label>
              <Textarea id={id + 'note'} name="note" maxLength={500} rows={2} required={hasDifference}
                defaultValue={closing?.note ?? ''} />
            </div>
          </fieldset>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="cancel" disabled={loading} onClick={onClose}>{dictionary.cancel}</Button>
            <Button type="submit" variant="success" disabled={loading}>{loading ? dictionary.saving : copy.saveClosing}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
