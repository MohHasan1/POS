import { Search } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getDictionary } from '@/lib/localization'
import { formatMarketDate, formatMarketDateTime } from '@/lib/calendar'
import { getDocumentMarket, marketLocale } from '@/lib/market'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { getInvoices } from '@/services/invoices'
import { getInvoicePaymentSummaries } from '@/services/money'

export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const [{ dictionary, locale }, invoices] = await Promise.all([
    getDictionary(),
    getInvoices(q),
  ])
  const paymentSummaries = await getInvoicePaymentSummaries(invoices)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.invoices}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.invoiceHistoryDescription}</p>
      </header>
      <section className="rounded-lg border bg-background">
        <form className="flex gap-2 border-b p-3" role="search">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" aria-hidden="true" />
            <Input className="pl-8" defaultValue={q} name="q" placeholder={`${dictionary.invoiceNumber} / ${dictionary.paperReference}`} />
          </div>
          <button className={buttonVariants({ variant: 'outline' })} type="submit">{dictionary.search}</button>
        </form>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dictionary.invoiceNumber}</TableHead>
              <TableHead>{dictionary.date}</TableHead>
              <TableHead>{dictionary.type}</TableHead>
              <TableHead>{dictionary.employee}</TableHead>
              <TableHead className="text-right">{dictionary.total}</TableHead>
              <TableHead>{dictionary.paymentStatus}</TableHead>
              <TableHead className="text-right">{dictionary.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const market = getDocumentMarket(invoice)
              const dateLocale = marketLocale(market, locale)
              const payment = paymentSummaries.get(invoice.id)!
              const paymentLabel = payment.status === 'partial' ? dictionary.paymentStatusPartial : payment.status === 'unpaid' ? dictionary.paymentStatusUnpaid : dictionary.paymentStatusPaid
              return <TableRow key={invoice.id}>
                <TableCell>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  {invoice.externalReference && (
                    <p className="text-xs text-muted-foreground">{invoice.externalReference}</p>
                  )}
                </TableCell>
                <TableCell>
                  {invoice.issuedAtPrecision === 'dateOnly'
                    ? formatMarketDate(invoice.issuedAt, market, dateLocale)
                    : formatMarketDateTime(invoice.issuedAt, market, dateLocale)}
                </TableCell>
                <TableCell>{invoice.entrySource === 'paperBackfill' ? dictionary.historicalPaperSale : invoice.invoiceType === 'sales' ? dictionary.salesInvoice : invoice.invoiceType === 'simplified' ? dictionary.simplifiedInvoice : dictionary.standardInvoice}</TableCell>
                <TableCell>{invoice.employeeSnapshot?.name || '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(invoice.totalMinor, market, dateLocale)}</TableCell>
                <TableCell><Badge variant={payment.status === 'unpaid' ? 'destructive' : 'secondary'} className={payment.status === 'partial' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' : payment.status === 'paid' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' : undefined}>{paymentLabel}</Badge>{payment.remainingMinor > 0 && <p className="mt-1 text-xs tabular-nums text-muted-foreground">{formatMoney(payment.remainingMinor, market, dateLocale)}</p>}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/invoices/${invoice.id}`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>{dictionary.open}</Link>
                </TableCell>
              </TableRow>
            })}
            {invoices.length === 0 && (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">{dictionary.noInvoices}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
