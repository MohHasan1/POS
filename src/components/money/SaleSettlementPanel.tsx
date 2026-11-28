'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import type { SaleSettlementInput } from '@/lib/money-types'
import { decimalToMinor, formatMoney } from '@/lib/money'
import type { MoneyPerson } from '@/payload-types'

import { MoneyPersonSelector } from './MoneyPersonSelector'
import { createPaymentMethodDraft, PaymentMethodFields, type PaymentMethodDraft } from './PaymentMethodFields'

export type SaleSettlementDraft = {
  accountIdempotencyKey: string
  enabled: boolean
  paidNow: string
  payment: PaymentMethodDraft
  paymentIdempotencyKey: string
  personId: string
}

export function createSaleSettlementDraft(today: string): SaleSettlementDraft {
  return {
    accountIdempotencyKey: crypto.randomUUID(),
    enabled: false,
    paidNow: '',
    payment: createPaymentMethodDraft(today),
    paymentIdempotencyKey: crypto.randomUUID(),
    personId: '',
  }
}

export function saleSettlementInput(
  draft: SaleSettlementDraft,
  totalMinor: number,
  market: MarketProfile,
  dictionary: Dictionary,
): { error?: string; settlement?: SaleSettlementInput } {
  if (!draft.enabled) return {}
  if (!draft.personId) return { error: dictionary.selectPersonRequired }
  const paidNowMinor = draft.paidNow.trim() ? decimalToMinor(draft.paidNow, market) : 0
  if (paidNowMinor === null || paidNowMinor < 0 || paidNowMinor >= totalMinor) {
    return { error: dictionary.paidNowLessThanTotal }
  }
  if (
    paidNowMinor > 0 &&
    ((draft.payment.paymentMethod === 'bank_transfer' &&
      (!draft.payment.bankName.trim() || !draft.payment.transactionReference.trim() || !draft.payment.transferDate)) ||
      (draft.payment.paymentMethod === 'cheque' &&
        (!draft.payment.bankName.trim() || !draft.payment.chequeNumber.trim() || !draft.payment.chequeDate)) ||
      (draft.payment.paymentMethod === 'other' && !draft.payment.otherDescription.trim()))
  ) {
    return { error: dictionary.completePaymentDetails }
  }
  return {
    settlement: {
      accountIdempotencyKey: draft.accountIdempotencyKey,
      personId: draft.personId,
      initialPayment: paidNowMinor > 0
        ? {
            amountMinor: paidNowMinor,
            bankName: draft.payment.bankName || undefined,
            chequeDate: draft.payment.paymentMethod === 'cheque' ? draft.payment.chequeDate : undefined,
            chequeNumber: draft.payment.chequeNumber || undefined,
            idempotencyKey: draft.paymentIdempotencyKey,
            otherDescription: draft.payment.otherDescription || undefined,
            otherReference: draft.payment.otherReference || undefined,
            paymentMethod: draft.payment.paymentMethod,
            transactionReference: draft.payment.transactionReference || undefined,
            transferDate: draft.payment.paymentMethod === 'bank_transfer' ? draft.payment.transferDate : undefined,
          }
        : undefined,
    },
  }
}

export function SaleSettlementPanel({
  cashAndBankOnly,
  dictionary,
  idPrefix,
  market,
  onChange,
  onPersonSelected,
  paidAmountLabel,
  people,
  today,
  totalMinor,
  value,
}: {
  cashAndBankOnly?: boolean
  dictionary: Dictionary
  idPrefix: string
  market: MarketProfile
  onChange: (value: SaleSettlementDraft) => void
  onPersonSelected?: (person: MoneyPerson) => void
  paidAmountLabel?: string
  people: MoneyPerson[]
  today: string
  totalMinor: number
  value: SaleSettlementDraft
}) {
  const paidNowMinor = value.paidNow.trim() ? decimalToMinor(value.paidNow, market) : 0
  const remainingMinor = paidNowMinor === null ? totalMinor : Math.max(0, totalMinor - paidNowMinor)

  return (
    <section className="space-y-3 rounded-lg bg-amber-50/80 p-3 dark:bg-amber-950/25">
      <label className="flex cursor-pointer items-start gap-2">
        <Checkbox checked={value.enabled} onCheckedChange={(checked) => onChange({ ...value, enabled: checked === true })} />
        <span><span className="block text-sm font-medium">{dictionary.notFullyPaid}</span><span className="block text-xs text-muted-foreground">{dictionary.notFullyPaidDescription}</span></span>
      </label>
      {value.enabled && (
        <div className="grid gap-3 border-t border-amber-200/70 pt-3 sm:grid-cols-2 dark:border-amber-900/60">
          <MoneyPersonSelector
            dictionary={dictionary}
            idPrefix={idPrefix}
            people={people}
            value={value.personId}
            onValueChange={(person) => {
              onChange({ ...value, personId: person.id })
              onPersonSelected?.(person)
            }}
          />
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-paid-now`}>{paidAmountLabel ?? dictionary.paidNowOptional}</Label>
            <Input id={`${idPrefix}-paid-now`} inputMode="decimal" value={value.paidNow} placeholder="0" onChange={(event) => onChange({ ...value, paidNow: event.target.value })} />
          </div>
          <div className="rounded-lg bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">{dictionary.amountRemaining}</p>
            <p className="mt-1 font-semibold tabular-nums">{formatMoney(remainingMinor, market, market.locale)}</p>
          </div>
          {paidNowMinor !== null && paidNowMinor > 0 && (
            <PaymentMethodFields cashAndBankOnly={cashAndBankOnly} dictionary={dictionary} idPrefix={`${idPrefix}-initial-payment`} today={today} value={value.payment} onChange={(payment) => onChange({ ...value, payment })} />
          )}
        </div>
      )}
    </section>
  )
}
