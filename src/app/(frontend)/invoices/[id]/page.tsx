import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { cache } from 'react'

import { PrintButton } from '@/components/invoices/PrintButton'
import { SimplifiedInvoiceTemplate } from '@/components/invoices/SimplifiedInvoiceTemplate'
import { StandardInvoiceTemplate } from '@/components/invoices/StandardInvoiceTemplate'
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

  const qrDataURL = await QRCode.toDataURL(invoice.qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
  })

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Link href="/checkout" className={cn(buttonVariants({ variant: 'outline' }))}>
          {dictionary.returnToCheckout}
        </Link>
        <PrintButton documentTitle={invoice.invoiceNumber} label={dictionary.print} />
      </div>
      {invoice.invoiceType === 'simplified' ? (
        <SimplifiedInvoiceTemplate invoice={invoice} qrDataURL={qrDataURL} />
      ) : (
        <StandardInvoiceTemplate invoice={invoice} qrDataURL={qrDataURL} />
      )}
    </div>
  )
}
