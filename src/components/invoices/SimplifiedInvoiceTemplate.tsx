import { InvoiceBody } from './InvoiceBody'
import type { Invoice } from '@/payload-types'

export function SimplifiedInvoiceTemplate({ invoice, qrDataURL }: { invoice: Invoice; qrDataURL: string }) {
  return <InvoiceBody invoice={invoice} qrDataURL={qrDataURL} standard={false} />
}
