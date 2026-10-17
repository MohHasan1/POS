import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'

import { PrintButton } from '@/components/invoices/PrintButton'
import { SimplifiedInvoiceTemplate } from '@/components/invoices/SimplifiedInvoiceTemplate'
import { StandardInvoiceTemplate } from '@/components/invoices/StandardInvoiceTemplate'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/localization'
import { cn } from '@/lib/utils'
import { getInvoice } from '@/services/invoices'

export const metadata: Metadata = { title: 'Invoice' }

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [invoice, { dictionary }] = await Promise.all([getInvoice(id), getDictionary()])
  if (!invoice) notFound()

  const qrDataURL = await QRCode.toDataURL(invoice.qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
  })

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Link href="/checkout" className={cn(buttonVariants({ variant: 'outline' }))}>{dictionary.returnToCheckout}</Link>
        <PrintButton label={dictionary.print} />
      </div>
      {invoice.invoiceType === 'simplified' ? (
        <SimplifiedInvoiceTemplate invoice={invoice} qrDataURL={qrDataURL} />
      ) : (
        <StandardInvoiceTemplate invoice={invoice} qrDataURL={qrDataURL} />
      )}
    </div>
  )
}
