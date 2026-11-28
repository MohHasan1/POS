'use client'

import { useState, useTransition, type FormEvent } from 'react'

import { classifyCashSalesAction, confirmBankReceiptAction } from '@/actions/cash'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMarketDateTime, toMarketDateInput } from '@/lib/calendar'
import type { CashAccount } from '@/lib/cash'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale, type MarketProfile } from '@/lib/market'
import { decimalToMinor, formatMoney, minorToDecimal } from '@/lib/money'
import type { CashSaleReview } from '@/services/cash-sale-review'

const pageSize = 20
type ReviewMode = keyof CashSaleReview

export function CashSaleReviewDialog({ dictionary, locale, market, mode, sales, today, onClose, onSave }: {
  dictionary: Dictionary
  locale: Locale
  market: MarketProfile
  mode: ReviewMode
  sales: CashSaleReview[ReviewMode]
  today: string
  onClose: () => void
  onSave: () => void
}) {
  const copy = dictionary.cashSummary
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [receipt, setReceipt] = useState<CashSaleReview['pending'][number] | null>(null)
  const [error, setError] = useState('')
  const [saving, startTransition] = useTransition()
  const dateLocale = marketLocale(market, locale)
  const legacy = mode === 'legacy'
  const totalPages = Math.max(1, Math.ceil(sales.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const displayed = sales.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const chosen = displayed.filter(({ id }) => selected.includes(id))
  const allSelected = displayed.length > 0 && displayed.length === chosen.length
  const money = (amount: number) => formatMoney(amount, market, dateLocale)

  function apply(account: CashAccount) {
    setError('')
    startTransition(async () => {
      const result = await classifyCashSalesAction({ account, invoiceIds: chosen.map(({ id }) => id) })
      if (!result.ok) setError(result.error)
      else {
        setSelected([])
        onSave()
      }
    })
  }

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!receipt) return
    const values = new FormData(event.currentTarget)
    const amountMinor = decimalToMinor(String(values.get('amount') ?? ''), market)
    if (amountMinor === null || amountMinor <= 0 || amountMinor > receipt.totalMinor) {
      setError(copy.amountError)
      return
    }
    setError('')
    startTransition(async () => {
      const result = await confirmBankReceiptAction({
        invoiceId: receipt.id, date: String(values.get('date') ?? ''), amountMinor,
      })
      if (!result.ok) setError(result.error)
      else {
        setReceipt(null)
        onSave()
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{legacy ? copy.reviewToday : copy.pendingReceipts}</DialogTitle>
          <DialogDescription>{legacy ? copy.reviewHelp : copy.pendingHelp}</DialogDescription>
        </DialogHeader>
        {receipt ? (
          <form onSubmit={confirm} className="space-y-4">
            <p className="font-medium">{receipt.invoiceNumber} · {money(receipt.totalMinor)}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bank-received-date">{dictionary.paymentDate}</Label>
                <Input id="bank-received-date" type="date" name="date" defaultValue={today}
                  min={toMarketDateInput(receipt.issuedAt, market)} max={today} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-received-amount">{copy.amountReceived} · {market.currencyCode}</Label>
                <Input id="bank-received-amount" inputMode="decimal" name="amount"
                  defaultValue={minorToDecimal(receipt.totalMinor, market)} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="cancel" disabled={saving} onClick={() => { setReceipt(null); setError('') }}>{dictionary.cancel}</Button>
              <Button type="submit" variant="success" disabled={saving}>{saving ? dictionary.saving : copy.confirmReceipt}</Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            {displayed.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {legacy && <TableHead><Checkbox checked={allSelected} indeterminate={chosen.length > 0 && !allSelected}
                      disabled={saving} aria-label={copy.selectPage} onCheckedChange={(checked) => setSelected(checked ? displayed.map(({ id }) => id) : [])} /></TableHead>}
                    <TableHead>{dictionary.invoiceNumber}</TableHead>
                    <TableHead>{dictionary.date}</TableHead>
                    <TableHead className="text-right">{dictionary.amount}</TableHead>
                    {!legacy && <TableHead><span className="sr-only">{dictionary.actions}</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayed.map((sale) => (
                    <TableRow key={sale.id}>
                      {legacy && <TableCell><Checkbox checked={selected.includes(sale.id)} disabled={saving}
                        aria-label={sale.invoiceNumber} onCheckedChange={(checked) =>
                          setSelected((previous) => checked ? [...previous, sale.id] : previous.filter((id) => id !== sale.id))} /></TableCell>}
                      <TableCell>{sale.invoiceNumber}</TableCell>
                      <TableCell>{formatMarketDateTime(sale.issuedAt, market, dateLocale)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(sale.totalMinor)}</TableCell>
                      {!legacy && <TableCell><Button size="sm" variant="outline" onClick={() => { setReceipt(sale); setError('') }}>{copy.confirmReceipt}</Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-sm text-muted-foreground">{copy.reviewEmpty}</p>}
            {totalPages > 1 && (
              <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={legacy ? copy.reviewToday : copy.pendingReceipts}>
                <p className="text-sm text-muted-foreground">{dictionary.pageOf
                  .replace('{page}', new Intl.NumberFormat(dateLocale).format(currentPage))
                  .replace('{total}', new Intl.NumberFormat(dateLocale).format(totalPages))}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={saving || currentPage <= 1}
                    onClick={() => { setPage(currentPage - 1); setSelected([]) }}>{dictionary.previous}</Button>
                  <Button type="button" variant="outline" size="sm" disabled={saving || currentPage >= totalPages}
                    onClick={() => { setPage(currentPage + 1); setSelected([]) }}>{dictionary.next}</Button>
                </div>
              </nav>
            )}
            {legacy && displayed.length > 0 && (
              <DialogFooter>
                <Button type="button" variant="outline" disabled={saving || !chosen.length} onClick={() => apply('cash')}>{copy.assignCash}</Button>
                <Button type="button" variant="success" disabled={saving || !chosen.length} onClick={() => apply('bank')}>{copy.assignBank}</Button>
              </DialogFooter>
            )}
          </>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
