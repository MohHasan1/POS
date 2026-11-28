'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cashAmountSchema, type CashAccount, type CashBalances, type CashMovementInput } from '@/lib/cash'
import type { Dictionary } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { minorToDecimal } from '@/lib/money'

type MovementAccount = { value: CashAccount; label: string; balanceKey: keyof CashBalances }

function MovementAmountField({ id, name, label, market, fullAmountLabel, balance, required }: {
  id: string
  name: string
  label: string
  market: MarketProfile
  fullAmountLabel?: string
  balance?: number | null
  required?: boolean
}) {
  const [amount, setAmount] = useState('')
  const fullAmount = cashAmountSchema.positive().safeParse(balance)

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label} · {market.currencyCode}</Label>
      <Input id={id} name={name} inputMode="decimal" required={required} value={amount}
        onChange={(event) => setAmount(event.target.value)} />
      {fullAmountLabel && (
        <Button type="button" size="sm" variant="outline" disabled={!fullAmount.success}
          aria-label={`${fullAmountLabel} · ${label}`} onClick={() => {
            if (fullAmount.success) setAmount(minorToDecimal(fullAmount.data, market))
          }}>
          {fullAmountLabel}
        </Button>
      )}
    </div>
  )
}

export function CashMovementFields({ accounts, balances, dictionary, id, kind, market, transferFrom, onTransferFromChange }: {
  accounts: readonly [MovementAccount, MovementAccount]
  balances: CashBalances | null | undefined
  dictionary: Dictionary
  id: string
  kind: CashMovementInput['kind']
  market: MarketProfile
  transferFrom: CashAccount
  onTransferFromChange: (account: CashAccount) => void
}) {
  const copy = dictionary.cashSummary
  if (kind === 'transfer') {
    const [cash, bank] = accounts
    return (
      <>
        <div className="space-y-1.5 sm:col-span-2" role="group" aria-labelledby={id + 'from'}>
          <p id={id + 'from'} className="text-sm font-medium">{copy.fromAccount}</p>
          <div className="flex flex-wrap gap-2">
            {([[cash, bank], [bank, cash]] as const).map(([from, to]) => (
              <Button key={from.value} type="button" aria-pressed={transferFrom === from.value}
                variant={transferFrom === from.value ? 'secondary' : 'outline'}
                onClick={() => onTransferFromChange(from.value)}>
                {from.label} → {to.label}
              </Button>
            ))}
          </div>
        </div>
        <MovementAmountField key={transferFrom} id={id + 'amount'} name="amount" label={dictionary.amount}
          market={market} fullAmountLabel={copy.useFullAmount}
          balance={balances?.[transferFrom === 'cash' ? 'cashMinor' : 'bankMinor']} required />
      </>
    )
  }

  return (
    <>
      {accounts.map(({ value, label, balanceKey }) => (
        <MovementAmountField key={`${kind}:${value}`} id={id + value} name={value} label={label} market={market}
          fullAmountLabel={kind === 'outflow' ? copy.useFullAmount : undefined} balance={balances?.[balanceKey]} />
      ))}
      <p className="text-sm text-muted-foreground sm:col-span-2">
        {kind === 'reconcile' ? copy.reconcileHelp : copy.cashOrBankAmountHelp}
      </p>
    </>
  )
}
