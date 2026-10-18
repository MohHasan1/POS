import type { ReactNode } from 'react'

import { formatSAR } from '@/lib/money'
import { formatSaudiDate } from '@/lib/saudi-time'
import type { ReceiptVoucher } from '@/payload-types'

function paymentMethodLabel(method: ReceiptVoucher['paymentMethod']) {
  switch (method) {
    case 'cash':
      return 'Cash / نقداً'
    case 'bank_transfer':
      return 'Bank Transfer / تحويل بنكي'
    case 'cheque':
      return 'Cheque / شيك'
    case 'other':
      return 'Other / أخرى'
  }
}

function BilingualLabel({ arabic, english }: { arabic: string; english: string }) {
  return (
    <span className="block text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
      <span dir="ltr">{english}</span>
      <span aria-hidden="true"> · </span>
      <span className="normal-case" dir="rtl">
        {arabic}
      </span>
    </span>
  )
}

function SummaryField({
  arabic,
  children,
  english,
  highlight = false,
}: {
  arabic: string
  children: ReactNode
  english: string
  highlight?: boolean
}) {
  return (
    <div className={highlight ? 'bg-neutral-50 px-4 py-3' : 'px-4 py-3'}>
      <BilingualLabel arabic={arabic} english={english} />
      <div className="voucher-value mt-1.5 text-sm leading-relaxed" dir="auto">
        {children}
      </div>
    </div>
  )
}

function CompactDetail({
  arabic,
  children,
  english,
}: {
  arabic: string
  children: ReactNode
  english: string
}) {
  return (
    <div className="min-w-0">
      <BilingualLabel arabic={arabic} english={english} />
      <div className="voucher-value mt-1.5 text-sm leading-relaxed" dir="auto">
        {children}
      </div>
    </div>
  )
}

function DetailRow({
  arabic,
  children,
  english,
}: {
  arabic: string
  children: ReactNode
  english: string
}) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] items-start gap-6 py-2.5 text-sm">
      <BilingualLabel arabic={arabic} english={english} />
      <div className="voucher-value whitespace-pre-wrap leading-relaxed" dir="auto">
        {children}
      </div>
    </div>
  )
}

function BusinessHeader({ business }: { business: ReceiptVoucher['business'] }) {
  const telephones = [business.telephone, business.additionalTelephone].filter(Boolean).join(' / ')
  const hasContacts = Boolean(telephones || business.mobile || business.email)

  return (
    <header
      className={`voucher-section-avoid grid items-center gap-6 border-b border-neutral-300 pb-4 ${
        hasContacts ? 'grid-cols-[minmax(0,1fr)_190px]' : 'grid-cols-1'
      }`}
    >
      <div className="flex min-w-0 items-center gap-4">
        {business.logo?.url && (
          <div className="flex size-16 shrink-0 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Business logo"
              className="max-h-16 max-w-16 object-contain"
              src={business.logo.url}
            />
          </div>
        )}
        <div className="min-w-0 leading-tight">
          {business.displayName && (
            <p className="voucher-value mb-1 text-xs font-medium text-neutral-600" dir="auto">
              {business.displayName}
            </p>
          )}
          <p className="voucher-value text-[15px] font-semibold" dir="ltr">
            {business.sellerNameEnglish}
          </p>
          <p className="voucher-value mt-1 text-[15px] font-semibold" dir="rtl">
            {business.sellerNameArabic}
          </p>
          {business.crNumber && (
            <p className="mt-2 text-[11px] text-neutral-600 tabular-nums" dir="auto">
              <span className="font-semibold">CR</span> {business.crNumber}
              <span aria-hidden="true"> · </span>
              <span dir="rtl">السجل التجاري</span>
            </p>
          )}
          <p
            className="voucher-value mt-1.5 text-[10px] leading-relaxed text-neutral-600"
            dir="auto"
          >
            {business.businessAddress}
          </p>
        </div>
      </div>

      {hasContacts && (
        <address className="space-y-1 pr-1 text-right text-[10px] leading-relaxed text-neutral-600 not-italic">
          {telephones && (
            <p className="voucher-value flex flex-wrap items-baseline justify-end gap-x-1">
              <span className="font-semibold whitespace-nowrap">
                <span dir="ltr">Tel</span> / <span dir="rtl">هاتف</span>
              </span>
              <span dir="ltr">{telephones}</span>
            </p>
          )}
          {business.mobile && (
            <p className="voucher-value flex flex-wrap items-baseline justify-end gap-x-1">
              <span className="font-semibold whitespace-nowrap">
                <span dir="ltr">Mobile</span> / <span dir="rtl">جوال</span>
              </span>
              <span dir="ltr">{business.mobile}</span>
            </p>
          )}
          {business.email && (
            <p className="voucher-value" dir="ltr">
              {business.email}
            </p>
          )}
        </address>
      )}
    </header>
  )
}

function PaymentDetails({ voucher }: { voucher: ReceiptVoucher }) {
  const details = voucher.paymentDetails

  return (
    <section className="voucher-section-avoid border-b border-neutral-200 py-4">
      <h2 className="mb-3 text-xs font-semibold text-neutral-700">
        Payment Details <span aria-hidden="true">/</span> <span dir="rtl">تفاصيل الدفع</span>
      </h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <CompactDetail english="Payment method" arabic="طريقة الدفع">
          {paymentMethodLabel(voucher.paymentMethod)}
        </CompactDetail>
        {voucher.paymentMethod === 'bank_transfer' && (
          <>
            <CompactDetail english="Bank name" arabic="اسم البنك">
              {details?.bankName}
            </CompactDetail>
            <CompactDetail english="Transaction reference" arabic="رقم مرجع العملية">
              {details?.transactionReference}
            </CompactDetail>
            <CompactDetail english="Transfer date" arabic="تاريخ التحويل">
              {details?.transferDate ? formatSaudiDate(details.transferDate, 'en-SA') : ''}
            </CompactDetail>
          </>
        )}
        {voucher.paymentMethod === 'cheque' && (
          <>
            <CompactDetail english="Cheque number" arabic="رقم الشيك">
              {details?.chequeNumber}
            </CompactDetail>
            <CompactDetail english="Bank name" arabic="اسم البنك">
              {details?.bankName}
            </CompactDetail>
            <CompactDetail english="Cheque date" arabic="تاريخ الشيك">
              {details?.chequeDate ? formatSaudiDate(details.chequeDate, 'en-SA') : ''}
            </CompactDetail>
          </>
        )}
        {voucher.paymentMethod === 'other' && (
          <>
            <CompactDetail english="Payment description" arabic="وصف طريقة الدفع">
              {details?.otherDescription}
            </CompactDetail>
            {details?.otherReference && (
              <CompactDetail english="Reference number" arabic="الرقم المرجعي">
                {details.otherReference}
              </CompactDetail>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function SignatureSection() {
  return (
    <section
      aria-label="Manual signatures"
      className="voucher-signatures mt-auto grid grid-cols-3 gap-10 pt-20 text-center text-xs"
    >
      {[
        ['Received By', 'المستلم'],
        ['Manager', 'المدير'],
        ['Accountant', 'المحاسب'],
      ].map(([english, arabic]) => (
        <div key={english} data-signature-line className="border-t border-neutral-500 pt-2">
          <p className="font-medium" dir="ltr">
            {english}
          </p>
          <p className="mt-0.5 text-neutral-600" dir="rtl">
            {arabic}
          </p>
        </div>
      ))}
    </section>
  )
}

export function ReceiptVoucherTemplate({ voucher }: { voucher: ReceiptVoucher }) {
  return (
    <article className="receipt-voucher-page relative flex flex-col border border-neutral-200 p-7 shadow-sm sm:p-9">
      {voucher.status !== 'issued' && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-[43%] z-10 -rotate-12 text-center text-6xl font-bold tracking-[0.2em] opacity-[0.12] ${
            voucher.status === 'voided' ? 'text-red-700' : 'text-neutral-700'
          }`}
        >
          {voucher.status === 'voided' ? 'VOID · ملغي' : 'DRAFT · مسودة'}
        </div>
      )}

      <BusinessHeader business={voucher.business} />

      <section className="voucher-section-avoid py-5 text-center">
        <p className="text-2xl font-semibold tracking-tight" dir="rtl">
          سند قبض
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-wide" dir="ltr">
          Receipt Voucher
        </h1>
      </section>

      <dl className="voucher-section-avoid grid grid-cols-2 divide-x divide-neutral-200 border-y border-neutral-300">
        <SummaryField english="Voucher number" arabic="رقم السند">
          <strong className="text-lg font-semibold tracking-wide tabular-nums" dir="ltr">
            {voucher.voucherNumber}
          </strong>
        </SummaryField>
        <SummaryField english="Voucher date" arabic="تاريخ السند">
          <span className="font-medium tabular-nums" dir="ltr">
            {formatSaudiDate(voucher.voucherDate, 'en-SA')}
          </span>
        </SummaryField>
      </dl>

      {voucher.status !== 'issued' && (
        <div
          className={`voucher-section-avoid border-b py-2 text-center text-xs font-bold tracking-[0.16em] uppercase ${
            voucher.status === 'voided'
              ? 'border-red-300 text-red-800'
              : 'border-neutral-300 text-neutral-700'
          }`}
        >
          {voucher.status === 'voided' ? 'Void / ملغي' : 'Draft / مسودة'}
        </div>
      )}

      <dl className="voucher-section-avoid grid grid-cols-[minmax(0,1.7fr)_minmax(180px,0.8fr)] divide-x divide-neutral-200 border-b border-neutral-200">
        <SummaryField english="Received from" arabic="استلمنا من">
          <span className="font-medium">{voucher.receivedFrom}</span>
        </SummaryField>
        <SummaryField english="Amount" arabic="المبلغ" highlight>
          <strong className="text-xl font-semibold tabular-nums" dir="ltr">
            {formatSAR(voucher.amountMinor)}
          </strong>
        </SummaryField>
      </dl>

      <section className="voucher-section-avoid border-b border-neutral-200 py-4">
        <BilingualLabel english="Amount in words" arabic="المبلغ كتابةً" />
        <p className="voucher-value mt-2 text-sm leading-relaxed" dir="ltr">
          {voucher.amountWordsEnglish}
        </p>
        <p className="voucher-value mt-1 text-right text-sm leading-relaxed" dir="rtl">
          {voucher.amountWordsArabic}
        </p>
      </section>

      <PaymentDetails voucher={voucher} />

      <section className="py-3">
        <DetailRow english="Payment purpose" arabic="وذلك مقابل">
          {voucher.purpose}
        </DetailRow>
        {voucher.notes && (
          <div className="border-t border-neutral-100">
            <DetailRow english="Notes" arabic="ملاحظات">
              {voucher.notes}
            </DetailRow>
          </div>
        )}
        {voucher.status === 'voided' && (
          <div className="border-t border-red-200 text-red-800">
            <DetailRow english="Void reason" arabic="سبب الإلغاء">
              {voucher.voidReason}
            </DetailRow>
          </div>
        )}
      </section>

      <SignatureSection />
    </article>
  )
}
