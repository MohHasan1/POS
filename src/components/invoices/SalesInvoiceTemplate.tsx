import { formatMarketDate, formatMarketDateTime } from '@/lib/calendar'
import { getDocumentMarket, localizedName, normalizedTranslations } from '@/lib/market'
import { formatMoney, formatQuantity } from '@/lib/money'
import type { Invoice } from '@/payload-types'

export function SalesInvoiceTemplate({ invoice }: { invoice: Invoice }) {
  const market = getDocumentMarket(invoice)
  const money = (minor: number) => formatMoney(minor, market, 'en-BD', true)
  const localSellerName = invoice.seller.nameBangla || invoice.seller.nameEnglish

  return (
    <article className="invoice-page border p-6 shadow-sm sm:p-8">
      <header className="border-b-2 border-black pb-5">
        <div className="grid gap-2 text-sm font-semibold sm:grid-cols-2">
          <p>{invoice.seller.nameEnglish}</p>
          <p className="sm:text-right">{localSellerName}</p>
        </div>
        <div className="mt-5 text-center">
          <h1 className="text-2xl font-bold">বিক্রয় ইনভয়েস</h1>
          <p className="mt-1 text-lg font-semibold">Sales Invoice</p>
        </div>
        <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Invoice number / ইনভয়েস নম্বর</dt>
            <dd className="mt-1 tabular-nums">{invoice.invoiceNumber}</dd>
          </div>
          <div className="sm:text-right">
            <dt className="font-semibold">Date and time / তারিখ ও সময়</dt>
            <dd className="mt-1 tabular-nums">
              {invoice.issuedAtPrecision === 'dateOnly'
                ? formatMarketDate(invoice.issuedAt, market, 'en-BD')
                : formatMarketDateTime(invoice.issuedAt, market, 'en-BD')}
            </dd>
          </div>
        </dl>
      </header>

      <section className="border-b py-4 text-xs">
        <h2 className="mb-2 text-sm font-bold">Seller / বিক্রেতা</h2>
        <p className="whitespace-pre-line">{invoice.seller.address}</p>
        {invoice.seller.registrations?.length ? (
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {invoice.seller.registrations.map((registration) => (
              <div key={`${registration.type}:${registration.value}`}>
                <dt className="inline font-semibold">{registration.type.toUpperCase()}: </dt>
                <dd className="inline">{registration.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {invoice.buyer && (invoice.buyer.name || invoice.buyer.address) && (
        <section className="border-b py-4 text-xs">
          <h2 className="mb-2 text-sm font-bold">Customer / ক্রেতা</h2>
          {invoice.buyer.name && <p>{invoice.buyer.name}</p>}
          {invoice.buyer.address && <p className="whitespace-pre-line">{invoice.buyer.address}</p>}
        </section>
      )}

      <table className="invoice-items mt-5 w-full table-fixed border-collapse text-[10px] leading-tight">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="w-7 px-1 py-2 text-left">#</th>
            <th className="px-1 py-2 text-left">Description / বিবরণ</th>
            <th className="w-16 px-1 py-2 text-right">Qty / পরিমাণ</th>
            <th className="w-24 px-1 py-2 text-right">Unit price / একক মূল্য</th>
            <th className="w-24 px-1 py-2 text-right">Total / মোট</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => {
            const localName = localizedName(
              normalizedTranslations(item.translations, {
                ar: item.descriptionArabic,
                bn: item.descriptionBangla,
              }),
              invoice.secondaryLanguage || 'bn',
            )
            return (
              <tr key={item.id || index} className="border-b">
                <td className="px-1 py-2 align-top">{index + 1}</td>
                <td className="px-1 py-2 align-top">
                  <span className="block font-medium">{item.descriptionEnglish}</span>
                  {localName && localName !== item.descriptionEnglish && (
                    <span className="block">{localName}</span>
                  )}
                </td>
                <td className="px-1 py-2 text-right align-top tabular-nums">
                  {formatQuantity(item.quantityMilliunits, 'en-BD')}
                </td>
                <td className="px-1 py-2 text-right align-top tabular-nums">
                  {money(item.unitPriceMinor)}
                </td>
                <td className="px-1 py-2 text-right align-top font-semibold tabular-nums">
                  {money(item.totalMinor)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <dl className="ml-auto mt-6 max-w-xs text-sm">
        <div className="flex justify-between gap-4 border-t-2 border-black pt-3 text-base font-bold">
          <dt>Grand total / সর্বমোট</dt>
          <dd className="tabular-nums">{money(invoice.totalMinor)}</dd>
        </div>
      </dl>
      <footer className="mt-8 border-t pt-4 text-xs text-neutral-600">
        All amounts are in Bangladeshi Taka (BDT). / সকল পরিমাণ বাংলাদেশি টাকায়।
      </footer>
    </article>
  )
}

