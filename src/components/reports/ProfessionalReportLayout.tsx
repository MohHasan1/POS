import type { ReactNode } from 'react'

import type { BusinessReport } from '@/lib/business-report-types'
import { formatMarketDateTime } from '@/lib/calendar'
import type { Dictionary } from '@/lib/localization'

export function ProfessionalReportLayout({
  children, dictionary, displayLocale, headerDetail, headerNote, periodLabel, rangeLabel, report, title,
}: {
  children: ReactNode
  dictionary: Dictionary
  displayLocale: string
  headerDetail?: ReactNode
  headerNote?: string
  periodLabel: string
  rangeLabel: string
  report: Pick<BusinessReport, 'businessName' | 'generatedAt' | 'market'>
  title: string
}) {
  return (
    <article className="professional-report space-y-6">
      <header className="border-b-2 border-black pb-3">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">{report.businessName}</h1>
            <p className="mt-1 text-lg font-semibold">{title}</p>
            <p className="mt-1 text-sm">{periodLabel}{rangeLabel !== periodLabel && ` · ${rangeLabel}`}</p>
            {headerDetail && <p className="mt-1 text-sm">{headerDetail}</p>}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{dictionary.reportGeneratedAt}</p>
            <p className="mt-1 font-medium text-foreground">
              {formatMarketDateTime(report.generatedAt, report.market, displayLocale)}
            </p>
            <p className="mt-1">{report.market.currencyCode}</p>
          </div>
        </div>
        {headerNote && <p className="mt-2 text-xs">{headerNote}</p>}
      </header>

      {children}

      <footer className="border-t border-black pt-2 text-center text-[8pt] text-muted-foreground">
        {dictionary.generatedByQuickPOS}
      </footer>
    </article>
  )
}

export function ProfessionalReportMetrics({ items, title }: {
  items: ReadonlyArray<readonly [label: string, value: string]>
  title: string
}) {
  return (
    <div className="report-avoid-break">
      <h3 className="mb-1 text-[9pt] font-semibold">{title}</h3>
      <div className="professional-summary-grid grid grid-cols-5 border-l border-t border-black/30">
        {items.map(([label, value]) => (
          <div key={label} className="border-b border-r border-black/30 p-2">
            <p className="text-[8pt] text-muted-foreground">{label}</p>
            <p className="mt-1 text-[11pt] font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
