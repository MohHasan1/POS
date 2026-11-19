'use client'

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale } from '@/lib/market'
import { formatMoney } from '@/lib/money'
import type { BusinessReport } from '@/lib/business-report-types'

export function BusinessTrendChart({
  dictionary,
  locale,
  report,
}: {
  dictionary: Dictionary
  locale: Locale
  report: BusinessReport
}) {
  const moneyLocale = marketLocale(report.market, locale)

  if (!report.trend.length) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">{dictionary.noSalesData}</p>
    )
  }

  return (
    <ChartContainer>
      <ComposedChart data={report.trend} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={72}
          tickFormatter={(value) =>
            new Intl.NumberFormat(moneyLocale, {
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(Number(value) / 100)
          }
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.35 }}
          content={({ active, label, payload }) =>
            active && payload?.length ? (
              <div className="min-w-48 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
                <p className="mb-2 font-medium">{label}</p>
                <div className="space-y-1.5">
                  {payload.map((entry) => (
                    <div
                      key={String(entry.dataKey)}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-muted-foreground">
                        {entry.dataKey === 'grossSalesMinor'
                          ? dictionary.grossSales
                          : dictionary.operatingProfit}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatMoney(Number(entry.value), report.market, moneyLocale)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          }
        />
        <Bar
          dataKey="grossSalesMinor"
          fill="var(--chart-2)"
          name={dictionary.grossSales}
          radius={[4, 4, 0, 0]}
        />
        <Line
          dataKey="operatingProfitMinor"
          dot={false}
          name={dictionary.operatingProfit}
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          type="monotone"
        />
      </ComposedChart>
    </ChartContainer>
  )
}
