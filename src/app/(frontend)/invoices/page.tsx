import { Search } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
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
import { formatSAR } from '@/lib/money'
import { formatSaudiDateTime } from '@/lib/saudi-time'
import { cn } from '@/lib/utils'
import { getInvoices } from '@/services/invoices'

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
            <Input className="pl-8" defaultValue={q} name="q" placeholder={dictionary.invoiceNumber} />
          </div>
          <button className={buttonVariants({ variant: 'outline' })} type="submit">{dictionary.search}</button>
        </form>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dictionary.invoiceNumber}</TableHead>
              <TableHead>{dictionary.date}</TableHead>
              <TableHead>{dictionary.type}</TableHead>
              <TableHead className="text-right">{dictionary.total}</TableHead>
              <TableHead className="text-right">{dictionary.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                <TableCell>{formatSaudiDateTime(invoice.issuedAt, locale === 'bn' ? 'bn-BD' : 'en-SA')}</TableCell>
                <TableCell>{invoice.invoiceType === 'simplified' ? dictionary.simplifiedInvoice : dictionary.standardInvoice}</TableCell>
                <TableCell className="text-right tabular-nums">{formatSAR(invoice.totalMinor, locale === 'bn' ? 'bn-BD' : 'en-SA')}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/invoices/${invoice.id}`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>{dictionary.open}</Link>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">{dictionary.noInvoices}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
