import { InvoiceBody } from './InvoiceBody'
import type { Invoice } from '@/payload-types'

export function StandardInvoiceTemplate({ invoice, qrDataURL }: { invoice: Invoice; qrDataURL: string }) {
  return <InvoiceBody invoice={invoice} qrDataURL={qrDataURL} standard />
}
