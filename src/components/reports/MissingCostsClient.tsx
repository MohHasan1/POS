'use client'

import { ArrowLeft, Wrench } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'

import { correctInvoiceCostAction } from '@/actions/business-reporting'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatMarketDate } from '@/lib/calendar'
import type { MissingCostLine } from '@/lib/business-report-types'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale, type MarketProfile } from '@/lib/market'
import { decimalToMinor, formatMoney, formatQuantity } from '@/lib/money'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

export function MissingCostsClient({
  dictionary,
  lines,
  locale,
  market,
}: {
  dictionary: Dictionary
  lines: MissingCostLine[]
  locale: Locale
  market: MarketProfile
}) {
  const router = useRouter()
  const dateLocale = marketLocale(market, locale)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<MissingCostLine | null>(null)
  const [unitCost, setUnitCost] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase()
    return !value
      ? lines
      : lines.filter(
          (line) =>
            line.nameEnglish.toLocaleLowerCase().includes(value) ||
            line.invoiceNumber.toLocaleLowerCase().includes(value),
        )
  }, [lines, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function open(line: MissingCostLine) {
    setSelected(line)
    setUnitCost('')
    setNote('')
    setError('')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const unitCostMinor = decimalToMinor(unitCost, market)
    if (unitCostMinor === null) {
      setError(dictionary.unitCostError)
      return
    }
    startTransition(async () => {
      const result = await correctInvoiceCostAction({
        invoiceId: selected.invoiceId,
        invoiceItemId: selected.invoiceItemId,
        note: note || undefined,
        unitCostMinor,
      })
      if (!result.ok) setError(result.error)
      else {
        setSelected(null)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className={cn(buttonVariants({ variant: 'outline' }))} href="/reports">
          <ArrowLeft />
          {dictionary.backToReports}
        </Link>
        <Input
          className="w-full sm:max-w-sm"
          type="search"
          placeholder={dictionary.searchMissingCosts}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
        />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dictionary.date}</TableHead>
                <TableHead>{dictionary.invoiceNumber}</TableHead>
                <TableHead>{dictionary.product}</TableHead>
                <TableHead className="text-right">{dictionary.quantity}</TableHead>
                <TableHead className="text-right">{dictionary.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((line) => (
                <TableRow key={line.invoiceItemId}>
                  <TableCell>{formatMarketDate(line.issuedAt, market, dateLocale)}</TableCell>
                  <TableCell className="font-medium">{line.invoiceNumber}</TableCell>
                  <TableCell>{line.nameEnglish}</TableCell>
                  <TableCell className="text-right">
                    {formatQuantity(line.quantityMilliunits, dateLocale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => open(line)}>
                      <Wrench />
                      {dictionary.addCost}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!visible.length && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {dictionary.noMissingCosts}
            </p>
          )}
        </CardContent>
      </Card>
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            {dictionary.pageOf
              .replace('{page}', String(page))
              .replace('{total}', String(totalPages))}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            {dictionary.previous}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            {dictionary.next}
          </Button>
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dictionary.correctCost}</DialogTitle>
            <DialogDescription>{dictionary.costCorrectionDescription}</DialogDescription>
          </DialogHeader>
          {selected && (
            <form className="space-y-4" onSubmit={submit}>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="font-medium">{selected.nameEnglish}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.invoiceNumber} ·{' '}
                  {formatQuantity(selected.quantityMilliunits, dateLocale)} {dictionary.units}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="correction-unit-cost">{dictionary.unitCost} *</Label>
                <Input
                  id="correction-unit-cost"
                  autoFocus
                  inputMode="decimal"
                  required
                  value={unitCost}
                  onChange={(event) => setUnitCost(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {dictionary.totalCostPreview}:{' '}
                  {formatMoney(
                    Math.round(
                      ((decimalToMinor(unitCost, market) || 0) * selected.quantityMilliunits) /
                        1000,
                    ),
                    market,
                    dateLocale,
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="correction-note">{dictionary.note}</Label>
                <Textarea
                  id="correction-note"
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="cancel" onClick={() => setSelected(null)}>
                  {dictionary.cancel}
                </Button>
                <Button type="submit" variant="success" disabled={pending}>
                  {pending ? dictionary.saving : dictionary.saveCorrection}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
