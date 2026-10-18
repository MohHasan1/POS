import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PrintButton } from '@/components/invoices/PrintButton'
import { ReceiptVoucherTemplate } from '@/components/receipt-vouchers/ReceiptVoucherTemplate'
import { VoidReceiptVoucherForm } from '@/components/receipt-vouchers/VoidReceiptVoucherForm'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/localization'
import { cn } from '@/lib/utils'
import { getReceiptVoucher } from '@/services/receipt-vouchers'

export const metadata: Metadata = { title: 'Receipt Voucher' }

export default async function ReceiptVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [voucher, { dictionary }] = await Promise.all([getReceiptVoucher(id), getDictionary()])
  if (!voucher) notFound()

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <Link href="/receipt-vouchers" className={cn(buttonVariants({ variant: 'outline' }))}>{dictionary.backToReceiptVouchers}</Link>
        <div className="flex flex-wrap justify-end gap-2">
          {voucher.status === 'active' && <VoidReceiptVoucherForm dictionary={dictionary} id={voucher.id} />}
          <PrintButton label={dictionary.print} />
        </div>
      </div>
      <ReceiptVoucherTemplate voucher={voucher} />
    </div>
  )
}
