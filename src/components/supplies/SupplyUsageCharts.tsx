'use client'

import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import type { Dictionary, Locale } from '@/lib/localization'
import type { getSupplyUsageTrends } from '@/lib/supplies'

import { supplyDateLabel, supplyDayLabel, supplyLifespanLabel, supplyNumber } from './format'
import { SupplyFinishedByMonthChart } from './SupplyFinishedByMonthChart'

export function SupplyUsageCharts({
  dictionary,
  locale,
  trends,
}: {
  dictionary: Dictionary
  locale: Locale
  trends: ReturnType<typeof getSupplyUsageTrends>
}) {
  const labels = dictionary.supplyTracker
  const { recent, monthly } = trends
  const shortDate = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const shortDates = new Map(recent.map((point) => [point.id, shortDate.format(new Date(point.finishedOn))]))
  const formatNumber = (value: number) => supplyNumber(value, locale)

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{labels.usageTrends}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{labels.expectedVsActual}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer className="h-52" role="group" aria-label={labels.expectedVsActual}>
              <BarChart data={recent} margin={{ left: 0, right: 6, top: 4 }} accessibilityLayer>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="id" tickFormatter={(id) => shortDates.get(id) ?? ''} minTickGap={16} tickLine={false} axisLine={false} />
                <YAxis width={35} tickFormatter={formatNumber} allowDecimals={false} tickLine={false} axisLine={false} />
                <Legend iconSize={8} />
                <ChartTooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as (typeof recent)[number] | undefined
                    if (!active || !point) return null
                    return (
                      <div className="max-w-52 rounded-lg border bg-popover p-2.5 text-xs text-popover-foreground shadow-md">
                        <p className="font-medium wrap-anywhere">{point.label ?? labels.unit}</p>
                        <p className="mb-1.5 text-muted-foreground">{supplyDateLabel(point.finishedOn, locale)}</p>
                        {point.expected !== null && (
                          <p>{labels.expectedShort} · {supplyDayLabel(point.expected, locale, labels)}</p>
                        )}
                        <p>{labels.actualShort} · {supplyLifespanLabel(point.actual, locale, labels)}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="expected" name={labels.expectedShort} fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="actual" name={labels.actualShort} fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={26} minPointSize={2} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <SupplyFinishedByMonthChart monthly={monthly} labels={labels} locale={locale} />
      </div>
    </section>
  )
}
