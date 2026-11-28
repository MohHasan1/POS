import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import { minorToDecimal } from '@/lib/money'

export type ClosingAccountInput = { counted: string; withdrawal: string }

export function CashClosingAccountFields({ id, account, expected, actual, withdrawal, reserved = 0, values, onChange, market, money, dictionary }: {
  id: string
  account: 'cash' | 'bank'
  expected: number
  actual: number | null
  withdrawal: number | null
  reserved?: number
  values: ClosingAccountInput
  onChange: (values: ClosingAccountInput) => void
  market: MarketProfile
  money: (amount: number) => string
  dictionary: Dictionary
}) {
  const copy = dictionary.cashSummary
  const isCash = account === 'cash'
  const limit = Math.max(0, (actual ?? 0) - reserved)
  const balanceLeft = actual === null || withdrawal === null || withdrawal > limit ? null : actual - withdrawal

  return (
    <fieldset className="min-w-0 space-y-3 rounded-lg bg-muted/40 p-3">
      <legend className="px-1 text-sm font-semibold">{isCash ? copy.hand : dictionary.payrollBank}</legend>
      <div className="flex justify-between gap-2 text-sm">
        <span>{isCash ? copy.expectedCash : copy.expectedBank}</span>
        <strong className="tabular-nums">{money(expected)}</strong>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id + 'count'}>{isCash ? copy.actualCash : copy.actualBankOptional}</Label>
        <Input id={id + 'count'} inputMode="decimal" required={isCash} value={values.counted}
          onChange={(event) => onChange({ ...values, counted: event.target.value })} />
      </div>
      <div className="flex justify-between gap-2 text-sm" aria-live="polite">
        <span>{copy.difference}</span>
        <strong className="tabular-nums">{actual === null ? '—' : money(actual - expected)}</strong>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id + 'withdrawal'}>{isCash ? copy.ownerPickup : copy.bankWithdrawal}</Label>
        <Input id={id + 'withdrawal'} inputMode="decimal" value={values.withdrawal}
          onChange={(event) => onChange({ ...values, withdrawal: event.target.value })} />
        <Button type="button" variant="outline" size="sm" disabled={limit <= 0}
          aria-label={`${copy.useFullAmount} · ${isCash ? copy.hand : dictionary.payrollBank}`}
          onClick={() => onChange({ ...values, withdrawal: minorToDecimal(limit, market) })}>
          {copy.useFullAmount}
        </Button>
      </div>
      <div className="flex justify-between gap-2 text-sm" aria-live="polite">
        <span>{isCash ? copy.cashLeftInDrawer : copy.bankBalanceLeft}</span>
        <strong className="tabular-nums">{balanceLeft === null ? '—' : money(balanceLeft)}</strong>
      </div>
    </fieldset>
  )
}
