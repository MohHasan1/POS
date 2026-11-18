import { formatMarketDate } from '@/lib/calendar'
import { getDocumentMarket } from '@/lib/market'
import { formatMoney } from '@/lib/money'
import type { ReceiptVoucher } from '@/payload-types'

const methodLabels: Record<ReceiptVoucher['paymentMethod'], string> = {
  cash: 'Cash / নগদ',
  bank_transfer: 'Bank transfer / ব্যাংক ট্রান্সফার',
  cheque: 'Cheque / চেক',
  other: 'Other / অন্যান্য',
}

export function BangladeshReceiptVoucherTemplate({ voucher }: { voucher: ReceiptVoucher }) {
  const market = getDocumentMarket(voucher)
  const business = voucher.business

  return (
    <article className="receipt-voucher-page relative flex flex-col border border-neutral-200 p-7 shadow-sm sm:p-9">
      {voucher.status !== 'issued' && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[43%] -rotate-12 text-center text-6xl font-bold tracking-[0.2em] opacity-[0.12]">
          {voucher.status === 'voided' ? 'VOID · বাতিল' : 'DRAFT · খসড়া'}
        </div>
      )}
      <header className="border-b border-neutral-300 pb-4">
        {business.logo?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Business logo" className="mb-3 max-h-16 max-w-24 object-contain" src={business.logo.url} />
        )}
        <p className="text-lg font-semibold">{business.sellerNameEnglish}</p>
        {business.sellerNameBangla && <p className="mt-1 text-lg font-semibold">{business.sellerNameBangla}</p>}
        <p className="mt-2 whitespace-pre-line text-xs text-neutral-600">{business.businessAddress}</p>
        {business.registrations?.length ? (
          <p className="mt-2 text-xs text-neutral-600">
            {business.registrations.map(({ type, value }) => `${type.toUpperCase()}: ${value}`).join(' · ')}
          </p>
        ) : null}
      </header>

      <section className="py-5 text-center">
        <p className="text-2xl font-semibold">প্রাপ্তি ভাউচার</p>
        <h1 className="mt-1 text-lg font-semibold tracking-wide">Receipt Voucher</h1>
      </section>

      <dl className="grid grid-cols-2 gap-6 border-y border-neutral-300 py-4 text-sm">
        <div><dt className="text-xs font-semibold text-neutral-500">Voucher number / ভাউচার নম্বর</dt><dd className="mt-1 font-semibold">{voucher.voucherNumber}</dd></div>
        <div className="text-right"><dt className="text-xs font-semibold text-neutral-500">Voucher date / ভাউচারের তারিখ</dt><dd className="mt-1">{formatMarketDate(voucher.voucherDate, market, 'en-BD')}</dd></div>
      </dl>

      <dl className="divide-y border-b text-sm">
        <div className="grid grid-cols-[160px_1fr] gap-5 py-4"><dt className="font-semibold">Received from / যার কাছ থেকে প্রাপ্ত</dt><dd>{voucher.receivedFrom}</dd></div>
        <div className="grid grid-cols-[160px_1fr] gap-5 py-4"><dt className="font-semibold">Amount / পরিমাণ</dt><dd className="text-lg font-semibold">{formatMoney(voucher.amountMinor, market, 'en-BD', true)}</dd></div>
        <div className="grid grid-cols-[160px_1fr] gap-5 py-4"><dt className="font-semibold">In words / কথায়</dt><dd><p>{voucher.amountWordsEnglish}</p>{voucher.amountWordsBangla && <p className="mt-1">{voucher.amountWordsBangla}</p>}</dd></div>
        <div className="grid grid-cols-[160px_1fr] gap-5 py-4"><dt className="font-semibold">Payment method / পেমেন্ট পদ্ধতি</dt><dd>{methodLabels[voucher.paymentMethod]}</dd></div>
        <div className="grid grid-cols-[160px_1fr] gap-5 py-4"><dt className="font-semibold">Purpose / উদ্দেশ্য</dt><dd className="whitespace-pre-wrap">{voucher.purpose}</dd></div>
        {voucher.notes && <div className="grid grid-cols-[160px_1fr] gap-5 py-4"><dt className="font-semibold">Notes / নোট</dt><dd className="whitespace-pre-wrap">{voucher.notes}</dd></div>}
      </dl>

      <section className="mt-auto grid grid-cols-3 gap-10 pt-24 text-center text-xs">
        {['Received By / গ্রহণকারী', 'Manager / ব্যবস্থাপক', 'Accountant / হিসাবরক্ষক'].map((label) => <div key={label} className="border-t border-neutral-500 pt-2">{label}</div>)}
      </section>
    </article>
  )
}

