import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { PrintButton } from '@/components/invoices/PrintButton'
import { IssueReceiptVoucherButton } from '@/components/receipt-vouchers/IssueReceiptVoucherButton'
import { ReceiptVoucherForm } from '@/components/receipt-vouchers/ReceiptVoucherForm'
import { ReceiptVoucherStatusBadge } from '@/components/receipt-vouchers/ReceiptVoucherStatusBadge'
import { ReceiptVoucherTemplate } from '@/components/receipt-vouchers/ReceiptVoucherTemplate'
import { VoidReceiptVoucherForm } from '@/components/receipt-vouchers/VoidReceiptVoucherForm'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/localization'
import { toSaudiDateInput } from '@/lib/receipt-voucher'
import { cn } from '@/lib/utils'
import { getReceiptVoucher } from '@/services/receipt-vouchers'

const getPageVoucher = cache(getReceiptVoucher)

type ReceiptVoucherPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}

export async function generateMetadata({ params }: ReceiptVoucherPageProps): Promise<Metadata> {
  const { id } = await params
  const voucher = await getPageVoucher(id)
  return { title: { absolute: voucher?.voucherNumber || 'Receipt Voucher' } }
}

export default async function ReceiptVoucherPage({
  params,
  searchParams,
}: ReceiptVoucherPageProps) {
  const { id } = await params
  const [{ edit }, voucher, { dictionary }] = await Promise.all([
    searchParams,
    getPageVoucher(id),
    getDictionary(),
  ])
  if (!voucher) notFound()
  const editing = edit === '1' && voucher.status === 'draft'

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/receipt-vouchers" className={cn(buttonVariants({ variant: 'outline' }))}>
          {dictionary.backToReceiptVouchers}
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <ReceiptVoucherStatusBadge dictionary={dictionary} status={voucher.status} />
          {voucher.status === 'draft' && !editing && (
            <Link
              href={`/receipt-vouchers/${voucher.id}?edit=1`}
              className={cn(buttonVariants({ variant: 'outline' }))}
            >
              {dictionary.editVoucher}
            </Link>
          )}
          {voucher.status === 'draft' && !editing && (
            <IssueReceiptVoucherButton dictionary={dictionary} id={voucher.id} />
          )}
          {voucher.status !== 'voided' && !editing && (
            <VoidReceiptVoucherForm dictionary={dictionary} id={voucher.id} />
          )}
          {!editing && (
            <PrintButton documentTitle={voucher.voucherNumber} label={dictionary.print} />
          )}
        </div>
      </div>
      {editing ? (
        <section className="rounded-lg border bg-background p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="font-semibold">
              {dictionary.editVoucher}: {voucher.voucherNumber}
            </h1>
            <Link
              href={`/receipt-vouchers/${voucher.id}`}
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
            >
              {dictionary.cancel}
            </Link>
          </div>
          <ReceiptVoucherForm
            defaultDate={toSaudiDateInput(voucher.voucherDate)}
            dictionary={dictionary}
            voucher={voucher}
          />
        </section>
      ) : (
        <ReceiptVoucherTemplate voucher={voucher} />
      )}
    </div>
  )
}
