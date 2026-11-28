'use client'

import { useId, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale, type MarketProfile } from '@/lib/market'
import { cashTenderResult, formatMoney, minorToDecimal } from '@/lib/money'

export function InvoiceCashCalculator({ totalMinor, market, dictionary, locale }: {
  totalMinor: number
  market: MarketProfile
  dictionary: Dictionary
  locale: Locale
}) {
  const id = useId()
  const [received, setReceived] = useState('')
  const result = cashTenderResult(received, totalMinor, market)
  const moneyLocale = marketLocale(market, locale)

  return (
    <Card className="no-print">
      <CardHeader className="flex-row flex-wrap items-baseline justify-between gap-x-4">
        <CardTitle className="text-sm">{dictionary.cashCalculator}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {dictionary.total} <strong className="text-foreground tabular-nums">{formatMoney(totalMinor, market, moneyLocale)}</strong>
        </p>
      </CardHeader>
      <CardContent className="grid items-end gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id}>{dictionary.cashCalculatorReceived}</Label>
          <Input id={id} inputMode="decimal" autoComplete="off"
            value={received} onChange={(event) => setReceived(event.target.value)}
            placeholder={minorToDecimal(totalMinor, market)}
            aria-invalid={result.status === 'invalid' || undefined}
            aria-describedby={id + '-result'} />
        </div>
        <div id={id + '-result'} aria-live="polite" className="space-y-1">
          {result.status === 'invalid' ? (
            <p className="text-sm text-destructive">{dictionary.cashSummary.amountError}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {result.status === 'short' ? dictionary.cashCalculatorStillDue : dictionary.cashCalculatorChange}
              </p>
              <p className="font-semibold tabular-nums">
                {result.status === 'blank' ? '—' : formatMoney(result.amountMinor, market, moneyLocale)}
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
