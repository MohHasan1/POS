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

function Detail({
  arabic,
  english,
  value,
}: {
  arabic: string
  english: string
  value: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[minmax(115px,0.7fr)_minmax(0,2fr)_minmax(115px,0.7fr)] items-start gap-3 border-b py-3 text-sm">
      <dt className="font-semibold" dir="ltr">{english}</dt>
      <dd className="min-w-0 whitespace-pre-wrap text-center" dir="auto">{value}</dd>
      <dt className="text-right font-semibold" dir="rtl">{arabic}</dt>
    </div>
  )
}

export function ReceiptVoucherTemplate({ voucher }: { voucher: ReceiptVoucher }) {
  const { business, paymentDetails } = voucher
  const telephones = [business.telephone, business.additionalTelephone].filter(Boolean).join(' / ')

  return (
    <article className="receipt-voucher-page relative border p-6 shadow-sm sm:p-8">
      {voucher.status === 'void' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
          <span className="-rotate-12 border-8 border-red-700 px-8 py-2 text-6xl font-black uppercase text-red-700 opacity-20">
            Void / ملغي
          </span>
        </div>
      )}

      <header className="grid grid-cols-[90px_1fr] gap-5 border-b-2 border-black pb-4 sm:grid-cols-[110px_1fr_180px]">
        <div className="flex h-20 items-center justify-center">
          {business.logo?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Business logo"
              className="max-h-20 max-w-full object-contain"
              src={business.logo.url}
            />
          )}
        </div>
        <div className="self-center text-center">
          {business.displayName && <p className="text-sm font-semibold">{business.displayName}</p>}
          <p className="text-base font-bold" dir="ltr">{business.sellerNameEnglish}</p>
          <p className="mt-1 text-base font-bold" dir="rtl">{business.sellerNameArabic}</p>
          {business.crNumber && (
            <p className="mt-1 text-xs tabular-nums" dir="auto">
              CR: {business.crNumber} / السجل التجاري
            </p>
          )}
        </div>
        <div className="col-span-2 space-y-1 text-center text-[11px] sm:col-span-1 sm:self-center sm:text-right">
          {telephones && <p dir="ltr">Tel: {telephones}</p>}
          {business.mobile && <p dir="ltr">Mobile: {business.mobile}</p>}
          {business.email && <p className="break-all" dir="ltr">{business.email}</p>}
        </div>
      </header>

      <div className="py-6 text-center">
        <h1 className="text-2xl font-bold" dir="rtl">سند قبض</h1>
        <p className="mt-1 text-xl font-bold" dir="ltr">Receipt Voucher</p>
      </div>

      <dl className="border-t-2 border-black">
        <Detail english="Voucher number" arabic="رقم السند" value={voucher.voucherNumber} />
        <Detail english="Date" arabic="التاريخ" value={formatSaudiDate(voucher.issuedAt, 'en-SA')} />
        <Detail english="Received from" arabic="استلمنا من" value={voucher.receivedFrom} />
        <Detail
          english="Amount"
          arabic="المبلغ"
          value={<strong className="text-base tabular-nums" dir="ltr">{formatSAR(voucher.amountMinor)}</strong>}
        />
        <Detail
          english="Amount in words"
          arabic="المبلغ كتابةً"
          value={(
            <span className="space-y-1">
              <span className="block" dir="ltr">{voucher.amountWordsEnglish}</span>
              <span className="block" dir="rtl">{voucher.amountWordsArabic}</span>
            </span>
          )}
        />
        <Detail english="Payment method" arabic="طريقة الدفع" value={paymentMethodLabel(voucher.paymentMethod)} />
        {voucher.paymentMethod === 'bank_transfer' && (
          <>
            <Detail english="Bank name" arabic="اسم البنك" value={paymentDetails?.bankName} />
            <Detail english="Transaction reference" arabic="رقم مرجع العملية" value={paymentDetails?.transactionReference} />
            <Detail english="Transfer date" arabic="تاريخ التحويل" value={paymentDetails?.transferDate ? formatSaudiDate(paymentDetails.transferDate, 'en-SA') : ''} />
          </>
        )}
        {voucher.paymentMethod === 'cheque' && (
          <>
            <Detail english="Cheque number" arabic="رقم الشيك" value={paymentDetails?.chequeNumber} />
            <Detail english="Bank name" arabic="اسم البنك" value={paymentDetails?.bankName} />
            <Detail english="Cheque date" arabic="تاريخ الشيك" value={paymentDetails?.chequeDate ? formatSaudiDate(paymentDetails.chequeDate, 'en-SA') : ''} />
          </>
        )}
        {voucher.paymentMethod === 'other' && (
          <>
            <Detail english="Payment description" arabic="وصف طريقة الدفع" value={paymentDetails?.otherDescription} />
            {paymentDetails?.otherReference && <Detail english="Reference number" arabic="الرقم المرجعي" value={paymentDetails.otherReference} />}
          </>
        )}
        <Detail english="For payment of" arabic="وذلك مقابل" value={voucher.purpose} />
        {voucher.notes && <Detail english="Notes" arabic="ملاحظات" value={voucher.notes} />}
      </dl>

      {voucher.status === 'void' && (
        <div className="mt-4 border border-red-700 p-3 text-sm text-red-800">
          <strong>Void reason / سبب الإلغاء:</strong> {voucher.voidReason}
        </div>
      )}

      <section className="voucher-signatures mt-14 grid grid-cols-3 gap-8 text-center text-sm">
        {[
          ['Received By', 'المستلم'],
          ['Manager', 'المدير'],
          ['Accountant', 'المحاسب'],
        ].map(([english, arabic]) => (
          <div key={english} className="pt-16">
            <div className="border-t border-black pt-2">
              <p dir="ltr">{english}</p>
              <p dir="rtl">{arabic}</p>
            </div>
          </div>
        ))}
      </section>
    </article>
  )
}
