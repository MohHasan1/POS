'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useRef, useState, useTransition } from 'react'

import { finalizeReceiptVoucherAction } from '@/actions/receipt-vouchers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary } from '@/lib/localization'
import { decimalToMinor } from '@/lib/money'
import { amountMinorToWords, type PaymentMethod } from '@/lib/receipt-voucher'

export function ReceiptVoucherForm({
  defaultDate,
  dictionary,
}: {
  defaultDate: string
  dictionary: Dictionary
}) {
  const router = useRouter()
  const idempotencyKey = useRef(crypto.randomUUID())
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const previewAmountMinor = decimalToMinor(amount)
  const amountWords = previewAmountMinor && previewAmountMinor > 0
    ? amountMinorToWords(previewAmountMinor)
    : null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const amountMinor = decimalToMinor(String(form.get('amount') || ''))
    if (!amountMinor || amountMinor <= 0) {
      setError(dictionary.receiptVoucherAmountError)
      return
    }

    const base = {
      amountMinor,
      idempotencyKey: idempotencyKey.current,
      issuedAt: String(form.get('issuedAt') || ''),
      notes: String(form.get('notes') || '').trim() || undefined,
      purpose: String(form.get('purpose') || ''),
      receivedFrom: String(form.get('receivedFrom') || ''),
    }
    const input =
      paymentMethod === 'bank_transfer'
        ? {
            ...base,
            bankName: String(form.get('bankName') || ''),
            paymentMethod,
            transactionReference: String(form.get('transactionReference') || ''),
            transferDate: String(form.get('transferDate') || ''),
          }
        : paymentMethod === 'cheque'
          ? {
              ...base,
              bankName: String(form.get('bankName') || ''),
              chequeDate: String(form.get('chequeDate') || ''),
              chequeNumber: String(form.get('chequeNumber') || ''),
              paymentMethod,
            }
          : paymentMethod === 'other'
            ? {
                ...base,
                otherDescription: String(form.get('otherDescription') || ''),
                otherReference: String(form.get('otherReference') || '').trim() || undefined,
                paymentMethod,
              }
            : { ...base, paymentMethod }

    startTransition(async () => {
      const result = await finalizeReceiptVoucherAction(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/receipt-vouchers/${result.data!.id}`)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="issuedAt">{dictionary.issueDate}</Label>
          <Input id="issuedAt" name="issuedAt" type="date" defaultValue={defaultDate} required />
        </div>
        <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
          <Label htmlFor="receivedFrom">{dictionary.receivedFrom}</Label>
          <Input id="receivedFrom" name="receivedFrom" maxLength={200} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">{dictionary.amountSar}</Label>
          <Input
            id="amount"
            name="amount"
            type="text"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            pattern="[0-9]+([.][0-9]{1,2})?"
            required
          />
        </div>
      </div>

      {amountWords && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <p className="font-medium">{dictionary.amountInWords}</p>
          <p className="mt-1" dir="ltr">{amountWords.english}</p>
          <p className="mt-1 text-right" dir="rtl">{amountWords.arabic}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="payment-method">{dictionary.paymentMethod}</Label>
          <Select
            value={paymentMethod}
            onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
          >
            <SelectTrigger id="payment-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{dictionary.paymentCash}</SelectItem>
              <SelectItem value="bank_transfer">{dictionary.paymentBankTransfer}</SelectItem>
              <SelectItem value="cheque">{dictionary.paymentCheque}</SelectItem>
              <SelectItem value="other">{dictionary.paymentOther}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentMethod === 'bank_transfer' && (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="bankName">{dictionary.bankName}</Label>
              <Input id="bankName" name="bankName" maxLength={200} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transactionReference">{dictionary.transactionReference}</Label>
              <Input
                id="transactionReference"
                name="transactionReference"
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transferDate">{dictionary.transferDate}</Label>
              <Input id="transferDate" name="transferDate" type="date" required />
            </div>
          </div>
        )}

        {paymentMethod === 'cheque' && (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="chequeNumber">{dictionary.chequeNumber}</Label>
              <Input id="chequeNumber" name="chequeNumber" maxLength={200} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankName">{dictionary.bankName}</Label>
              <Input id="bankName" name="bankName" maxLength={200} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chequeDate">{dictionary.chequeDate}</Label>
              <Input id="chequeDate" name="chequeDate" type="date" required />
            </div>
          </div>
        )}

        {paymentMethod === 'other' && (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="otherDescription">{dictionary.paymentDescription}</Label>
              <Input id="otherDescription" name="otherDescription" maxLength={500} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="otherReference">{dictionary.referenceNumberOptional}</Label>
              <Input id="otherReference" name="otherReference" maxLength={200} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="purpose">{dictionary.paymentPurpose}</Label>
        <Textarea id="purpose" name="purpose" maxLength={2000} rows={2} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{dictionary.notesOptional}</Label>
        <Textarea id="notes" name="notes" maxLength={2000} rows={2} />
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? dictionary.finalizingVoucher : dictionary.createReceiptVoucher}
        </Button>
      </div>
    </form>
  )
}
