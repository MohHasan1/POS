import { Fragment, type CSSProperties } from 'react'

import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cashBalanceRows, combinedAmount } from '@/lib/cash-summary-view'
import type { Dictionary } from '@/lib/localization'
import type { CashReport } from '@/services/cash-report'

export function CashBalanceEquations({ cash, dictionary, money }: {
  cash: CashReport
  dictionary: Dictionary
  money: (value: number) => string
}) {
  const copy = dictionary.cashSummary
  const { balances, activity } = cash
  const { moneyIn, moneyOut, breakdown } = balances ?? activity
  const closing = balances?.closing ?? activity.net
  const opening = balances?.carried

  return (
    <div className="space-y-2">
      {([
        { account: 'cashMinor', label: copy.hand },
        { account: 'bankMinor', label: dictionary.payrollBank },
      ] as const).map(({ account, label }) => {
        const expenses = breakdown.expensesPaid[account]
        const figures: { label: string; value: number | null; operator?: string; detail?: string }[] = [
          ...(opening ? [{ label: copy.opening, value: opening[account] }] : []),
          { label: copy.income, value: moneyIn[account], operator: opening ? '+' : undefined },
          { label: copy.outflow, value: moneyOut[account], operator: '−', detail: expenses ? `${copy.expensesPaid} ${money(-expenses)}` : undefined },
          { label: balances ? (balances.current ? copy.current : copy.closing) : copy.netActivity, value: closing[account], operator: '=' },
        ]

        return (
          <Card key={account} className="space-y-2 p-3">
            <h3 className="text-sm font-semibold">{label}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[var(--equation-columns)]"
              style={{ '--equation-columns': figures.map(() => 'minmax(0,1fr)').join(' auto ') } as CSSProperties}>
              {figures.map((figure) => (
                <Fragment key={figure.label}>
                  {figure.operator && (
                    <span aria-hidden="true" className="hidden self-center px-1 text-muted-foreground sm:block">{figure.operator}</span>
                  )}
                  <dl className="rounded-md bg-muted/50 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{figure.label}</dt>
                    <dd className="font-semibold tabular-nums">{figure.value === null ? '—' : money(figure.value)}</dd>
                    {figure.detail && <dd className="text-xs text-muted-foreground">{figure.detail}</dd>}
                  </dl>
                </Fragment>
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function CashBalanceBreakdown({ cash, dictionary, money }: {
  cash: CashReport
  dictionary: Dictionary
  money: (value: number) => string
}) {
  const copy = dictionary.cashSummary
  const rows = cashBalanceRows(cash, copy)

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{copy.balanceBreakdown}</h3>
      {cash.activity.includesBeforeOpening && <p className="text-sm text-muted-foreground">{copy.balanceStartsAtCount}</p>}
      <Card>
        <Table aria-label={copy.balanceBreakdown}>
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">{copy.balanceCalculation}</TableHead>
              <TableHead className="px-3 text-right">{dictionary.total}</TableHead>
              <TableHead className="px-3 text-right">{copy.hand}</TableHead>
              <TableHead className="px-3 text-right">{dictionary.payrollBank}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ label, amounts, signed, total }) => (
              <TableRow key={label} className={total ? 'bg-muted/50 font-semibold' : undefined}>
                <TableHead scope="row" className="h-auto px-3 py-2 whitespace-normal">{label}</TableHead>
                {([['total', combinedAmount(amounts)], ['cash', amounts.cashMinor], ['bank', amounts.bankMinor]] as const)
                  .map(([key, value]) => (
                    <TableCell key={key} className="px-3 text-right tabular-nums">
                      {value === null ? '—' : (signed && value > 0 ? '+' : '') + money(value || 0)}
                    </TableCell>
                  ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
