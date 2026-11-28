import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { CashAccount } from '@/lib/cash'
import type { Dictionary } from '@/lib/localization'

export function CashAccountSelector({ dictionary, value, onChange, bankPending, onBankPending }: {
  dictionary: Dictionary
  value: CashAccount
  onChange: (account: CashAccount) => void
  bankPending: boolean
  onBankPending: (pending: boolean) => void
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-sm font-medium">{dictionary.paymentMethod}</legend>
      <div className="flex gap-2">
        {(['cash', 'bank'] as const).map((account) => (
          <Button
            key={account}
            type="button"
            variant={value === account ? 'secondary' : 'outline'}
            aria-pressed={account === value}
            onClick={() => onChange(account)}
          >
            {account === 'cash' ? dictionary.payment_cash : dictionary.payrollBank}
          </Button>
        ))}
      </div>
      {value === 'bank' && (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={bankPending} onCheckedChange={(checked) => onBankPending(checked === true)} />
          <span>
            {dictionary.cashSummary.bankPending}
            <span className="block text-xs text-muted-foreground">{dictionary.cashSummary.bankPendingHelp}</span>
          </span>
        </label>
      )}
    </fieldset>
  )
}
