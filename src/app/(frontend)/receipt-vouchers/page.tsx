import { Search } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ReceiptVoucherForm } from '@/components/receipt-vouchers/ReceiptVoucherForm'
import { buttonVariants } from '@/components/ui/button'
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
import { getDictionary } from '@/lib/localization'
import { formatSAR } from '@/lib/money'
import { todayInSaudiArabia } from '@/lib/receipt-voucher'
import { formatSaudiDate } from '@/lib/saudi-time'
import { cn } from '@/lib/utils'
import { getReceiptVouchers } from '@/services/receipt-vouchers'

export const metadata: Metadata = { title: 'Receipt Vouchers' }

export default async function ReceiptVouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; q?: string; to?: string }>
}) {
  const { from = '', q = '', to = '' } = await searchParams
  const [{ dictionary, locale }, vouchers] = await Promise.all([
    getDictionary(),
    getReceiptVouchers({ from: from || undefined, search: q, to: to || undefined }),
  ])
  const dateLocale = locale === 'bn' ? 'bn-BD' : 'en-SA'

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.receiptVouchers}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.receiptVouchersDescription}</p>
      </header>

      <section className="rounded-lg border bg-background p-4 sm:p-5" aria-labelledby="create-voucher-heading">
        <div className="mb-4">
          <h2 id="create-voucher-heading" className="font-semibold">{dictionary.createReceiptVoucher}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{dictionary.createReceiptVoucherDescription}</p>
        </div>
        <ReceiptVoucherForm dictionary={dictionary} defaultDate={todayInSaudiArabia()} />
      </section>

      <section className="rounded-lg border bg-background" aria-labelledby="voucher-history-heading">
        <div className="border-b p-4">
          <h2 id="voucher-history-heading" className="font-semibold">{dictionary.receiptVoucherHistory}</h2>
          <form className="mt-3 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_160px_160px_auto]" role="search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" aria-hidden="true" />
              <Input className="pl-8" defaultValue={q} name="q" placeholder={dictionary.voucherNumber} />
            </div>
            <div className="space-y-1">
              <Label className="sr-only" htmlFor="voucher-from">{dictionary.fromDate}</Label>
              <Input id="voucher-from" name="from" type="date" defaultValue={from} aria-label={dictionary.fromDate} />
            </div>
            <div className="space-y-1">
              <Label className="sr-only" htmlFor="voucher-to">{dictionary.toDate}</Label>
              <Input id="voucher-to" name="to" type="date" defaultValue={to} aria-label={dictionary.toDate} />
            </div>
            <button className={buttonVariants({ variant: 'outline' })} type="submit">{dictionary.search}</button>
          </form>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dictionary.voucherNumber}</TableHead>
              <TableHead>{dictionary.date}</TableHead>
              <TableHead>{dictionary.receivedFrom}</TableHead>
              <TableHead>{dictionary.paymentMethod}</TableHead>
              <TableHead>{dictionary.status}</TableHead>
              <TableHead className="text-right">{dictionary.amountSar}</TableHead>
              <TableHead className="text-right">{dictionary.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vouchers.map((voucher) => (
              <TableRow key={voucher.id}>
                <TableCell className="font-medium">{voucher.voucherNumber}</TableCell>
                <TableCell>{formatSaudiDate(voucher.issuedAt, dateLocale)}</TableCell>
                <TableCell>{voucher.receivedFrom}</TableCell>
                <TableCell>{dictionary[`payment_${voucher.paymentMethod}`]}</TableCell>
                <TableCell>
                  <span className={voucher.status === 'void' ? 'text-destructive' : ''}>
                    {voucher.status === 'void' ? dictionary.voidStatus : dictionary.active}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatSAR(voucher.amountMinor, dateLocale)}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/receipt-vouchers/${voucher.id}`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>{dictionary.view}</Link>
                </TableCell>
              </TableRow>
            ))}
            {vouchers.length === 0 && (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">{dictionary.noReceiptVouchers}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
