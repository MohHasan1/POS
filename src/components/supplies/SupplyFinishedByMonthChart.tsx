'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import type { Dictionary, Locale } from '@/lib/localization'
import type { SupplyFinishedMonth } from '@/lib/supplies'

import { supplyNumber } from './format'

export function SupplyFinishedByMonthChart({ monthly, labels, locale }: {
  monthly: SupplyFinishedMonth[]
  labels: Dictionary['supplyTracker']
  locale: Locale
}) {
  const shortMonth = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  const fullMonth = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const formatNumber = (value: number) => supplyNumber(value, locale)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{labels.finishedByMonth}</CardTitle>
      </CardHeader>
      <CardContent>
        {monthly.some(({ finished }) => finished > 0) ? (
          <ChartContainer className="h-52" role="group" aria-label={labels.finishedByMonth}>
            <BarChart data={monthly} margin={{ left: 0, right: 6, top: 4 }} accessibilityLayer>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="month"
                tickFormatter={(month) => shortMonth.format(new Date(`${month}-01`))}
                minTickGap={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis width={35} tickFormatter={formatNumber} allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as SupplyFinishedMonth | undefined
                  if (!active || !point) return null
                  return (
                    <div className="rounded-lg border bg-popover p-2.5 text-xs text-popover-foreground shadow-md">
                      <p className="font-medium">{fullMonth.format(new Date(`${point.month}-01`))}</p>
                      <p className="text-muted-foreground">{labels.finishedUnits} · {formatNumber(point.finished)}</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="finished" name={labels.finishedUnits} fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="text-sm text-muted-foreground">{labels.noFinishesInSixMonths}</p>
        )}
      </CardContent>
    </Card>
  )
}
