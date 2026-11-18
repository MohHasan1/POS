import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { cache } from 'react'

import { PrintButton } from '@/components/invoices/PrintButton'
import { SimplifiedInvoiceTemplate } from '@/components/invoices/SimplifiedInvoiceTemplate'
import { StandardInvoiceTemplate } from '@/components/invoices/StandardInvoiceTemplate'
import { SalesInvoiceTemplate } from '@/components/invoices/SalesInvoiceTemplate'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/localization'
import { cn } from '@/lib/utils'
import { getInvoice } from '@/services/invoices'

const getPageInvoice = cache(getInvoice)

type InvoicePageProps = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: InvoicePageProps): Promise<Metadata> {
  const { id } = await params
  const invoice = await getPageInvoice(id)
  return { title: { absolute: invoice?.invoiceNumber || 'Invoice' } }
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { id } = await params
  const [invoice, { dictionary }] = await Promise.all([getPageInvoice(id), getDictionary()])
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
      {customerInvoice}
    </div>
  )
}
