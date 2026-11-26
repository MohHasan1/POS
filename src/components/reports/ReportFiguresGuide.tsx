import { ChevronRight, Info } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import type { Dictionary } from '@/lib/localization'

type ReportFigure = {
  key: keyof Dictionary['reportFigureDefinitions']
  label: string
}

function ReportGuideDialog({ title, close, trigger, children }: {
  title: string
  close: string
  trigger: ReactNode
  children: ReactNode
}) {
  return (
    <Dialog>
      {trigger}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>{title}</DialogTitle>
            <DialogClose render={<Button type="button" size="sm" variant="outline" />}>
              {close}
            </DialogClose>
          </div>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function ReportFigureHelp({ dictionary, figure }: { dictionary: Dictionary; figure: ReportFigure }) {
  const definitions = dictionary.reportFigureDefinitions
  return (
    <ReportGuideDialog
      title={figure.label}
      close={dictionary.close}
      trigger={(
        <DialogTrigger
          render={<Button type="button" size="icon-sm" variant="ghost" />}
          aria-label={dictionary.reportFigureHelpLabel.replace('{figure}', figure.label)}
          className="no-print text-muted-foreground"
        >
          <Info aria-hidden="true" />
        </DialogTrigger>
      )}
    >
      <div className="space-y-2 text-muted-foreground">
        <p>{definitions[figure.key]}</p>
        {figure.key === 'operatingProfitMinor' && (
          <p><strong className="text-foreground">{dictionary.profitMargin}</strong> · {definitions.profitMarginBps}</p>
        )}
      </div>
    </ReportGuideDialog>
  )
}

export function ReportFiguresGuide({ dictionary, figures, hasComparison }: {
  dictionary: Dictionary
  figures: ReportFigure[]
  hasComparison: boolean
}) {
  return (
    <ReportGuideDialog
      title={dictionary.reportFiguresGuide}
      close={dictionary.close}
      trigger={(
        <DialogTrigger
          render={<Button type="button" variant="outline" />}
          className="no-print h-auto w-full justify-start gap-2 whitespace-normal px-3 py-2 text-left"
        >
          <Info aria-hidden="true" />
          {dictionary.reportFiguresGuide}
          <ChevronRight className="ml-auto text-muted-foreground" aria-hidden="true" />
        </DialogTrigger>
      )}
    >
      <dl className="divide-y">
        {figures.map(({ key, label }) => (
          <div key={key} className="py-2 first:pt-0 last:pb-0">
            <dt className="font-medium">{label}</dt>
            <dd className="mt-0.5 text-muted-foreground">{dictionary.reportFigureDefinitions[key]}</dd>
          </div>
        ))}
        {hasComparison && (
          <div className="py-2 last:pb-0">
            <dt className="font-medium">{dictionary.reportComparisonBadges}</dt>
            <dd className="mt-0.5 text-muted-foreground">{dictionary.reportComparisonHelp}</dd>
          </div>
        )}
      </dl>
    </ReportGuideDialog>
  )
}
