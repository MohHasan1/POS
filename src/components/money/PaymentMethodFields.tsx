'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Dictionary } from '@/lib/localization'
import type { MoneyPaymentMethod } from '@/lib/money-types'

export type PaymentMethodDraft = {
  bankName: string
  chequeDate: string
  chequeNumber: string
  otherDescription: string
  otherReference: string
  paymentMethod: MoneyPaymentMethod
  transactionReference: string
  transferDate: string
}

export function createPaymentMethodDraft(today: string): PaymentMethodDraft {
  return {
    bankName: '',
    chequeDate: today,
    chequeNumber: '',
    otherDescription: '',
    otherReference: '',
    paymentMethod: 'cash',
    transactionReference: '',
    transferDate: today,
  }
}

function methodLabel(method: MoneyPaymentMethod, dictionary: Dictionary) {
  return dictionary[`payment_${method}`]
}

export function PaymentMethodFields({
  dictionary,
  idPrefix,
  onChange,
  today,
  value,
}: {
  dictionary: Dictionary
  idPrefix: string
  onChange: (value: PaymentMethodDraft) => void
  today: string
  value: PaymentMethodDraft
}) {
  const update = (changes: Partial<PaymentMethodDraft>) => onChange({ ...value, ...changes })

  return (
    <>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-method`}>{dictionary.paymentMethod} *</Label>
        <Select
          value={value.paymentMethod}
          onValueChange={(paymentMethod) => update({ paymentMethod: paymentMethod as MoneyPaymentMethod })}
        >
          <SelectTrigger id={`${idPrefix}-method`} className="w-full bg-background">
            <SelectValue>{methodLabel(value.paymentMethod, dictionary)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(['cash', 'bank_transfer', 'cheque', 'other'] as const).map((method) => (
              <SelectItem key={method} value={method}>{methodLabel(method, dictionary)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value.paymentMethod === 'bank_transfer' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-bank`}>{dictionary.bankName} *</Label>
            <Input id={`${idPrefix}-bank`} required maxLength={200} value={value.bankName} onChange={(event) => update({ bankName: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-bank-reference`}>{dictionary.transactionReference} *</Label>
            <Input id={`${idPrefix}-bank-reference`} required maxLength={200} value={value.transactionReference} onChange={(event) => update({ transactionReference: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-transfer-date`}>{dictionary.transferDate} *</Label>
            <Input id={`${idPrefix}-transfer-date`} type="date" required max={today} value={value.transferDate} onChange={(event) => update({ transferDate: event.target.value })} />
          </div>
        </>
      )}
      {value.paymentMethod === 'cheque' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-cheque-bank`}>{dictionary.bankName} *</Label>
            <Input id={`${idPrefix}-cheque-bank`} required maxLength={200} value={value.bankName} onChange={(event) => update({ bankName: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-cheque-number`}>{dictionary.chequeNumber} *</Label>
            <Input id={`${idPrefix}-cheque-number`} required maxLength={200} value={value.chequeNumber} onChange={(event) => update({ chequeNumber: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-cheque-date`}>{dictionary.chequeDate} *</Label>
            <Input id={`${idPrefix}-cheque-date`} type="date" required value={value.chequeDate} onChange={(event) => update({ chequeDate: event.target.value })} />
          </div>
        </>
      )}
      {value.paymentMethod === 'other' && (
        <>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-other`}>{dictionary.paymentDescription} *</Label>
            <Input id={`${idPrefix}-other`} required maxLength={500} value={value.otherDescription} onChange={(event) => update({ otherDescription: event.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-other-reference`}>{dictionary.referenceNumberOptional}</Label>
            <Input id={`${idPrefix}-other-reference`} maxLength={200} value={value.otherReference} onChange={(event) => update({ otherReference: event.target.value })} />
          </div>
        </>
      )}
    </>
  )
}
