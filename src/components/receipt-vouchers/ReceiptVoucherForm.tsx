'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useRef, useState, useTransition } from 'react'

import {
  createReceiptVoucherDraftAction,
  updateReceiptVoucherDraftAction,
} from '@/actions/receipt-vouchers'
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
import { decimalToMinor, minorToDecimal } from '@/lib/money'
import { amountMinorToWords, toSaudiDateInput, type PaymentMethod } from '@/lib/receipt-voucher'
import type { ReceiptVoucher } from '@/payload-types'

export function ReceiptVoucherForm({
  defaultDate,
  dictionary,
  voucher,
}: {
  defaultDate: string
  dictionary: Dictionary
  voucher?: ReceiptVoucher
}) {
  const router = useRouter()
  const idempotencyKey = useRef(crypto.randomUUID())
  const [amount, setAmount] = useState(voucher ? minorToDecimal(voucher.amountMinor) : '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    voucher?.paymentMethod || 'cash',
  )
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const previewAmountMinor = decimalToMinor(amount)
  const amountWords =
    previewAmountMinor && previewAmountMinor > 0 ? amountMinorToWords(previewAmountMinor) : null

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
      notes: String(form.get('notes') || '').trim() || undefined,
      purpose: String(form.get('purpose') || ''),
      receivedFrom: String(form.get('receivedFrom') || ''),
      voucherDate: String(form.get('voucherDate') || ''),
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
      const result = voucher
        ? await updateReceiptVoucherDraftAction(voucher.id, input)
        : await createReceiptVoucherDraftAction({
            ...input,
            idempotencyKey: idempotencyKey.current,
          })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/receipt-vouchers/${result.data!.id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="voucherDate">{dictionary.voucherDate}</Label>
          <Input
            id="voucherDate"
            name="voucherDate"
            type="date"
            defaultValue={defaultDate}
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
          <Label htmlFor="receivedFrom">{dictionary.receivedFrom}</Label>
          <Input
            id="receivedFrom"
            name="receivedFrom"
            defaultValue={voucher?.receivedFrom}
            maxLength={200}
            required
          />
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
          <p className="mt-1" dir="ltr">
            {amountWords.english}
          </p>
          <p className="mt-1 text-right" dir="rtl">
            {amountWords.arabic}
          </p>
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
              <Input
                id="bankName"
                name="bankName"
                defaultValue={voucher?.paymentDetails?.bankName || ''}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transactionReference">{dictionary.transactionReference}</Label>
              <Input
                id="transactionReference"
                name="transactionReference"
                defaultValue={voucher?.paymentDetails?.transactionReference || ''}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transferDate">{dictionary.transferDate}</Label>
              <Input
                id="transferDate"
                name="transferDate"
                type="date"
                defaultValue={
                  voucher?.paymentDetails?.transferDate
                    ? toSaudiDateInput(voucher.paymentDetails.transferDate)
                    : undefined
                }
                required
              />
            </div>
          </div>
        )}

        {paymentMethod === 'cheque' && (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="chequeNumber">{dictionary.chequeNumber}</Label>
              <Input
                id="chequeNumber"
                name="chequeNumber"
                defaultValue={voucher?.paymentDetails?.chequeNumber || ''}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankName">{dictionary.bankName}</Label>
              <Input
                id="bankName"
                name="bankName"
                defaultValue={voucher?.paymentDetails?.bankName || ''}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chequeDate">{dictionary.chequeDate}</Label>
              <Input
                id="chequeDate"
                name="chequeDate"
                type="date"
                defaultValue={
                  voucher?.paymentDetails?.chequeDate
                    ? toSaudiDateInput(voucher.paymentDetails.chequeDate)
                    : undefined
                }
                required
              />
            </div>
          </div>
        )}

        {paymentMethod === 'other' && (
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="otherDescription">{dictionary.paymentDescription}</Label>
              <Input
                id="otherDescription"
                name="otherDescription"
                defaultValue={voucher?.paymentDetails?.otherDescription || ''}
                maxLength={500}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="otherReference">{dictionary.referenceNumberOptional}</Label>
              <Input
                id="otherReference"
                name="otherReference"
                defaultValue={voucher?.paymentDetails?.otherReference || ''}
                maxLength={200}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="purpose">{dictionary.paymentPurpose}</Label>
        <Textarea
          id="purpose"
          name="purpose"
          defaultValue={voucher?.purpose}
          maxLength={2000}
          rows={2}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{dictionary.notesOptional}</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={voucher?.notes || ''}
          maxLength={2000}
          rows={2}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending
            ? voucher
              ? dictionary.updatingDraft
              : dictionary.savingDraft
            : voucher
              ? dictionary.updateDraft
              : dictionary.saveDraft}
        </Button>
      </div>
    </form>
  )
}
