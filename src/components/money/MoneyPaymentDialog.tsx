'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState, useTransition } from 'react'

import { createMoneyPaymentAction } from '@/actions/money'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import type { MoneyAccountView } from '@/lib/money-types'
import { decimalToMinor, formatMoney, minorToDecimal } from '@/lib/money'
import { createPaymentMethodDraft, PaymentMethodFields } from './PaymentMethodFields'

export function MoneyPaymentDialog({
  dictionary,
  full,
  market,
  onClose,
  today,
  view,
}: {
  dictionary: Dictionary
  full: boolean
  market: MarketProfile
  onClose: () => void
  today: string
  view: MoneyAccountView | null
}) {
  const router = useRouter()
  const [amount, setAmount] = useState(view ? minorToDecimal(full ? view.remainingMinor : 0, market) : '')
  const [paymentDate, setPaymentDate] = useState(today)
  const [payment, setPayment] = useState(() => createPaymentMethodDraft(today))
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [createVoucher, setCreateVoucher] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!view) return
    const amountMinor = decimalToMinor(amount, market)
    if (!amountMinor || amountMinor > view.remainingMinor) return setError(dictionary.moneyAmountError)
    setError('')
    startTransition(async () => {
      const result = await createMoneyPaymentAction({
        accountId: view.account.id,
        amountMinor,
        bankName: payment.bankName || undefined,
        chequeDate: payment.paymentMethod === 'cheque' ? payment.chequeDate : undefined,
        chequeNumber: payment.chequeNumber || undefined,
        createReceiptVoucher: view.account.direction === 'owedToUs' && createVoucher,
        idempotencyKey: crypto.randomUUID(),
        note: note || undefined,
        otherDescription: payment.otherDescription || undefined,
        otherReference: payment.otherReference || undefined,
        paymentDate,
        paymentMethod: payment.paymentMethod,
        reference: reference || undefined,
        transactionReference: payment.transactionReference || undefined,
        transferDate: payment.paymentMethod === 'bank_transfer' ? payment.transferDate : undefined,
      })
      if (!result.ok) return setError(result.error)
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open={Boolean(view)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{full ? dictionary.payFullAmount : dictionary.addPayment}</DialogTitle>
          {view && <DialogDescription>{view.account.personSnapshot.name} · {dictionary.amountRemaining}: {formatMoney(view.remainingMinor, market)}</DialogDescription>}
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="space-y-1.5"><Label htmlFor="payment-amount">{dictionary.originalAmount} *</Label><Input id="payment-amount" inputMode="decimal" required disabled={full} value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="payment-date">{dictionary.paymentDate} *</Label><Input id="payment-date" type="date" required max={today} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></div>
          <PaymentMethodFields dictionary={dictionary} idPrefix="payment" today={today} value={payment} onChange={setPayment} />
          <div className="space-y-1.5"><Label htmlFor="payment-reference">{dictionary.reference}</Label><Input id="payment-reference" maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="payment-note">{dictionary.note}</Label><Textarea id="payment-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></div>
          {view?.account.direction === 'owedToUs' && <label className="flex items-center gap-2 sm:col-span-2"><Checkbox checked={createVoucher} onCheckedChange={(checked) => setCreateVoucher(checked === true)} /><span className="text-sm">{dictionary.createIssuedVoucher}</span></label>}
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2" role="alert">{error}</p>}
          <DialogFooter className="sm:col-span-2"><Button type="button" variant="cancel" onClick={onClose}>{dictionary.cancel}</Button><Button type="submit" variant="success" disabled={pending}>{pending ? dictionary.saving : dictionary.recordPayment}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
