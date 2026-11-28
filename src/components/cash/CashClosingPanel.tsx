'use client'

import { Pencil } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CashBalances } from '@/lib/cash'
import { bankClosingFigures, cashClosingFigures } from '@/lib/cash-summary-view'
import type { Dictionary } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import type { CashClosingReport } from '@/services/cash-closing'

import { CashCloseDayDialog } from './CashCloseDayDialog'

export function CashClosingPanel({ report, balances, dictionary, market, money, date, onSaved }: {
  dictionary: Dictionary
  money: (amount: number) => string
  onSaved: () => void
  report: CashClosingReport
  balances?: CashBalances
  market: MarketProfile
  date: (value: string) => string
}) {
  const copy = dictionary.cashSummary
  const [dialog, setDialog] = useState(false)
  const { businessDate, closing } = report
  const nextDayCash = closing?.nextDayCashMinor
  const expectedBalances = closing
    ? { cashMinor: closing.expectedCashMinor, bankMinor: closing.expectedBankMinor ?? 0 }
    : balances

  if (!expectedBalances) return null

  return (
    <>
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{copy.dailyClosing}</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            {closing && <p className="text-sm text-muted-foreground">{copy.closedAt.replace('{date}', date(closing.closedAt))}</p>}
            <Button variant="outline" onClick={() => setDialog(true)}>
              {closing && <Pencil aria-hidden="true" />}
              {closing ? copy.editClosing : copy.closeDay}
            </Button>
          </div>
        </CardHeader>
        {closing && (
          <CardContent className="space-y-3">
            {([
              ['cash', cashClosingFigures(closing, copy)],
              ['bank', bankClosingFigures(closing, copy)],
            ] as const).map(([account, figures]) => figures.length > 0 && (
              <dl key={account} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {figures.map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="font-semibold tabular-nums">{money(value)}</dd>
                  </div>
                ))}
              </dl>
            ))}
            {closing.note && <p className="text-sm text-muted-foreground">{closing.note}</p>}
          </CardContent>
        )}
        {dialog && (
          <CashCloseDayDialog businessDate={businessDate} balances={expectedBalances} closing={closing} dictionary={dictionary} market={market}
            money={money} onClose={() => setDialog(false)} onSaved={() => { setDialog(false); onSaved() }} />
        )}
      </Card>
      {(!closing || nextDayCash != null) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{copy.cashForTomorrow}</CardTitle>
          </CardHeader>
          <CardContent>
            {nextDayCash == null
              ? <p className="text-sm text-muted-foreground">{copy.cashForTomorrowPending}</p>
              : <p className="font-semibold tabular-nums">{money(nextDayCash)}</p>}
          </CardContent>
        </Card>
      )}
    </>
  )
}
