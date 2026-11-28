import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { cache } from 'react'

import { InvoiceCashCalculator } from '@/components/invoices/InvoiceCashCalculator'
import { PrintButton } from '@/components/invoices/PrintButton'
import { SimplifiedInvoiceTemplate } from '@/components/invoices/SimplifiedInvoiceTemplate'
import { StandardInvoiceTemplate } from '@/components/invoices/StandardInvoiceTemplate'
import { SalesInvoiceTemplate } from '@/components/invoices/SalesInvoiceTemplate'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/localization'
import { readPosAccess, requirePosAccess } from '@/lib/require-pos-access'
import { getDocumentMarket, marketLocale } from '@/lib/market'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { getInvoice } from '@/services/invoices'
import { getInvoiceMoneyAccount } from '@/services/money'

const getPageInvoice = cache(getInvoice)

type InvoicePageProps = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: InvoicePageProps): Promise<Metadata> {
  if (!(await readPosAccess()).unlocked) return { title: 'Invoice' }
  const { id } = await params
  const invoice = await getPageInvoice(id)
  return { title: { absolute: invoice?.invoiceNumber || 'Invoice' } }
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { id } = await params
  await requirePosAccess(`/invoices/${encodeURIComponent(id)}`)
  const [invoice, { dictionary, locale }, moneyAccount] = await Promise.all([
    getPageInvoice(id),
    getDictionary(),
    getInvoiceMoneyAccount(id),
  ])
  if (!invoice) notFound()

  const qrDataURL = invoice.qrPayload
    ? await QRCode.toDataURL(invoice.qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
      })
    : undefined
  const customerInvoice =
    invoice.invoiceType === 'sales' ? (
      <SalesInvoiceTemplate invoice={invoice} />
    ) : invoice.invoiceType === 'simplified' ? (
      <SimplifiedInvoiceTemplate invoice={invoice} qrDataURL={qrDataURL || ''} />
    ) : (
      <StandardInvoiceTemplate invoice={invoice} qrDataURL={qrDataURL} />
    )
  const invoiceMarket = getDocumentMarket(invoice)
  const paymentStatus = moneyAccount
    ? moneyAccount.remainingMinor === 0
      ? 'paid'
      : moneyAccount.paidMinor > 0
        ? 'partial'
        : 'unpaid'
    : 'paid'
  const paymentStatusLabel = paymentStatus === 'partial'
    ? dictionary.paymentStatusPartial
    : paymentStatus === 'unpaid'
      ? dictionary.paymentStatusUnpaid
      : dictionary.paymentStatusPaid

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Link href="/checkout" className={cn(buttonVariants({ variant: 'outline' }))}>
          {dictionary.returnToCheckout}
        </Link>
        <Link href="/service-board" className={cn(buttonVariants({ variant: 'outline' }))}>
          {dictionary.returnToServiceBoard}
        </Link>
        <PrintButton
          documentTitle={invoice.invoiceNumber}
          label={dictionary.print}
        />
      </div>
      {invoice.entrySource === 'paperBackfill' && (
        <section className="no-print rounded-lg bg-amber-100 px-4 py-3 text-amber-950 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">{dictionary.historicalPaperSale}</p>
          <p className="mt-0.5 text-sm">{dictionary.historicalRecordNotice}</p>
        </section>
      )}
      {invoice.employeeSnapshot?.name && (
        <section className="no-print rounded-lg border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {dictionary.employeeInvoiceAssignment}
          </p>
          <p className="mt-1 font-semibold">{invoice.employeeSnapshot.name}</p>
        </section>
      )}
      <section className="no-print rounded-lg bg-muted/50 px-4 py-3">
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{dictionary.paymentStatus}</p><Badge variant={paymentStatus === 'unpaid' ? 'destructive' : 'secondary'} className={paymentStatus === 'partial' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' : paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100' : undefined}>{paymentStatusLabel}</Badge></div>
        {moneyAccount ? (
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm"><span className="text-muted-foreground">{dictionary.person}</span><span className="font-medium">{moneyAccount.account.personSnapshot.name}</span><span className="text-muted-foreground">{dictionary.amountPaid}</span><span className="font-medium tabular-nums">{formatMoney(moneyAccount.paidMinor, invoiceMarket, marketLocale(invoiceMarket, locale))}</span><span className="text-muted-foreground">{dictionary.amountRemaining}</span><span className="font-semibold tabular-nums">{formatMoney(moneyAccount.remainingMinor, invoiceMarket, marketLocale(invoiceMarket, locale))}</span></div>
            <Link
              href={`/money/owed-to-us?record=${encodeURIComponent(moneyAccount.account.recordNumber)}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              {dictionary.viewMoneyRecord}
            </Link>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{dictionary.invoiceOwedBalance}: {formatMoney(0, invoiceMarket, marketLocale(invoiceMarket, locale))}</p><Link href={`/money/owed-to-us?invoice=${invoice.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>{dictionary.trackAsOwed}</Link></div>
        )}
      </section>
      {invoice.totalMinor > 0 && (
        <InvoiceCashCalculator key={invoice.id} totalMinor={invoice.totalMinor} market={invoiceMarket} dictionary={dictionary} locale={locale} />
      )}
      {customerInvoice}
    </div>
  )
}
