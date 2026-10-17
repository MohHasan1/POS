import { formatQuantity, formatSAR } from '@/lib/money'
import { formatSaudiDateTime } from '@/lib/saudi-time'
import type { Invoice } from '@/payload-types'

type InvoiceItem = Invoice['items'][number]

type InvoiceBodyProps =
  | { invoice: Invoice; qrDataURL: string; standard: false }
  | { invoice: Invoice; qrDataURL?: string; standard: true }

function vatLabel(category: InvoiceItem['vatCategory'], rateBps: number) {
  if (category === 'exempt') return 'Exempt / معفى'
  return `${rateBps / 100}%`
}

function standardUnitPriceMinor(item: InvoiceItem) {
  if (!item.priceIncludesVat) return item.unitPriceMinor
  return Math.round((item.netMinor * 1000) / item.quantityMilliunits)
}

function taxTreatment(category: InvoiceItem['vatCategory']) {
  if (category === 'zero') {
    return {
      english: 'Zero-rated supply',
      arabic: 'توريد خاضع لنسبة الصفر',
    }
  }
  if (category === 'exempt') {
    return {
      english: 'VAT-exempt supply',
      arabic: 'توريد معفى من ضريبة القيمة المضافة',
    }
  }
  return null
}

export function InvoiceBody({ invoice, qrDataURL, standard }: InvoiceBodyProps) {
  const title = standard
    ? { arabic: 'فاتورة ضريبية', english: 'Tax Invoice' }
    : { arabic: 'فاتورة ضريبية مبسطة', english: 'Simplified Tax Invoice' }
  const vatBreakdown = invoice.items.reduce<
    Record<string, { net: number; total: number; vat: number }>
  >((groups, item) => {
    const key = vatLabel(item.vatCategory, item.vatRateBps)
    const current = groups[key] || { net: 0, total: 0, vat: 0 }
    groups[key] = {
      net: current.net + item.netMinor,
      total: current.total + item.totalMinor,
      vat: current.vat + item.vatMinor,
    }
    return groups
  }, {})

  return (
    <article className="invoice-page border p-6 shadow-sm sm:p-8">
      <header className="border-b-2 border-black pb-4">
        <div className="grid grid-cols-2 items-start gap-6 text-sm font-semibold">
          <p dir="ltr">{invoice.seller.nameEnglish}</p>
          <p className="text-right" dir="rtl">
            {invoice.seller.nameArabic}
          </p>
        </div>

        <div className="mt-4 text-center">
          <h1 className="text-2xl font-bold" dir="rtl">
            {title.arabic}
          </h1>
          <p className="mt-1 text-lg font-semibold" dir="ltr">
            {title.english}
          </p>
        </div>

        <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-semibold">
              <span dir="ltr">Invoice number</span> / <span dir="rtl">رقم الفاتورة</span>
            </dt>
            <dd className="mt-0.5 tabular-nums" dir="ltr">
              {invoice.invoiceNumber}
            </dd>
          </div>
          <div className="sm:text-right">
            <dt className="font-semibold">
              <span dir="ltr">Issue date and time</span> / <span dir="rtl">تاريخ ووقت الإصدار</span>
            </dt>
            <dd className="mt-0.5 tabular-nums" dir="ltr">
              {formatSaudiDateTime(invoice.issuedAt, 'en-SA')} (KSA)
            </dd>
            <dd className="mt-0.5" dir="rtl">
              {formatSaudiDateTime(invoice.issuedAt, 'ar-SA')} (بتوقيت السعودية)
            </dd>
          </div>
        </dl>
      </header>

      <section className="border-b py-4 text-xs" aria-labelledby="seller-heading">
        <h2 id="seller-heading" className="mb-2 text-sm font-bold">
          <span dir="ltr">Seller</span> / <span dir="rtl">البائع</span>
        </h2>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">
              <span dir="ltr">Address</span> / <span dir="rtl">العنوان</span>
            </dt>
            <dd className="mt-0.5 whitespace-pre-line" dir="auto">
              {invoice.seller.address}
            </dd>
          </div>
          <div className="sm:text-right">
            <dt className="font-semibold">
              <span dir="ltr">VAT registration number</span> /{' '}
              <span dir="rtl">رقم التسجيل في ضريبة القيمة المضافة</span>
            </dt>
            <dd className="mt-0.5 tabular-nums" dir="ltr">
              {invoice.seller.vatNumber}
            </dd>
          </div>
        </dl>
      </section>

      {standard && invoice.buyer && (
        <section className="border-b py-4 text-xs" aria-labelledby="buyer-heading">
          <h2 id="buyer-heading" className="mb-2 text-sm font-bold">
            <span dir="ltr">Buyer</span> / <span dir="rtl">المشتري</span>
          </h2>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">
                <span dir="ltr">Name</span> / <span dir="rtl">الاسم</span>
              </dt>
              <dd className="mt-0.5" dir="auto">
                {invoice.buyer.name}
              </dd>
            </div>
            <div className="sm:text-right">
              <dt className="font-semibold">
                <span dir="ltr">Address</span> / <span dir="rtl">العنوان</span>
              </dt>
              <dd className="mt-0.5 whitespace-pre-line" dir="auto">
                {invoice.buyer.address}
              </dd>
            </div>
            {invoice.buyer.vatNumber && (
              <div>
                <dt className="font-semibold">
                  <span dir="ltr">VAT registration number</span> /{' '}
                  <span dir="rtl">رقم التسجيل في ضريبة القيمة المضافة</span>
                </dt>
                <dd className="mt-0.5 tabular-nums" dir="ltr">
                  {invoice.buyer.vatNumber}
                </dd>
              </div>
            )}
            {invoice.buyer.identification && (
              <div className="sm:text-right">
                <dt className="font-semibold">
                  <span dir="ltr">Other identification</span> / <span dir="rtl">معرّف آخر</span>
                </dt>
                <dd className="mt-0.5" dir="auto">
                  {invoice.buyer.identification}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <table className="invoice-items mt-5 w-full table-fixed border-collapse text-[10px] leading-tight">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="w-6 px-1 py-2 text-left">#</th>
            <th className="px-1 py-2 text-left">
              <span className="block" dir="ltr">
                Description
              </span>
              <span className="block" dir="rtl">
                الوصف
              </span>
            </th>
            <th className="w-12 px-1 py-2 text-right">
              <span className="block" dir="ltr">
                Qty
              </span>
              <span className="block" dir="rtl">
                الكمية
              </span>
            </th>
            <th className="w-20 px-1 py-2 text-right">
              <span className="block" dir="ltr">
                Unit price{standard ? ' (excl. VAT)' : ''}
              </span>
              <span className="block" dir="rtl">
                سعر الوحدة{standard ? ' (غير شامل الضريبة)' : ''}
              </span>
            </th>
            <th className="w-20 px-1 py-2 text-right">
              <span className="block" dir="ltr">
                Taxable
              </span>
              <span className="block" dir="rtl">
                الخاضع للضريبة
              </span>
            </th>
            <th className="w-14 px-1 py-2 text-right">
              <span className="block" dir="ltr">
                VAT rate
              </span>
              <span className="block" dir="rtl">
                نسبة الضريبة
              </span>
            </th>
            <th className="w-20 px-1 py-2 text-right">
              <span className="block" dir="ltr">
                VAT amount
              </span>
              <span className="block" dir="rtl">
                مبلغ الضريبة
              </span>
            </th>
            <th className="w-20 px-1 py-2 text-right">
              <span className="block" dir="ltr">
                Total incl. VAT
              </span>
              <span className="block" dir="rtl">
                الإجمالي شامل الضريبة
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => {
            const treatment = standard ? taxTreatment(item.vatCategory) : null
            return (
              <tr key={item.id || index} className="invoice-item-row border-b">
                <td className="px-1 py-2 align-top">{index + 1}</td>
                <td className="px-1 py-2 align-top">
                  <span className="block font-medium" dir="ltr">
                    {item.descriptionEnglish}
                  </span>
                  <span className="block text-right" dir="rtl">
                    {item.descriptionArabic}
                  </span>
                  {treatment && (
                    <span className="mt-1 block text-[9px] text-neutral-600">
                      <span className="block" dir="ltr">
                        Tax treatment: {treatment.english}
                      </span>
                      <span className="block text-right" dir="rtl">
                        المعالجة الضريبية: {treatment.arabic}
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-1 py-2 text-right align-top tabular-nums">
                  {formatQuantity(item.quantityMilliunits)}
                </td>
                <td className="px-1 py-2 text-right align-top tabular-nums" dir="ltr">
                  <span className="block">
                    {formatSAR(standard ? standardUnitPriceMinor(item) : item.unitPriceMinor)}
                  </span>
                  {!standard && (
                    <span className="mt-0.5 block text-[9px] font-normal text-neutral-600">
                      {item.priceIncludesVat
                        ? 'Incl. VAT / شامل الضريبة'
                        : 'Excl. VAT / غير شامل الضريبة'}
                    </span>
                  )}
                </td>
                <td className="px-1 py-2 text-right align-top tabular-nums" dir="ltr">
                  {formatSAR(item.netMinor)}
                </td>
                <td className="px-1 py-2 text-right align-top tabular-nums">
                  {vatLabel(item.vatCategory, item.vatRateBps)}
                </td>
                <td className="px-1 py-2 text-right align-top tabular-nums" dir="ltr">
                  {formatSAR(item.vatMinor)}
                </td>
                <td className="px-1 py-2 text-right align-top font-semibold tabular-nums" dir="ltr">
                  {formatSAR(item.totalMinor)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="invoice-summary mt-6 grid items-start gap-6 sm:grid-cols-[1fr_280px]">
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase">
            <span dir="ltr">VAT breakdown</span> / <span dir="rtl">ملخص الضريبة</span>
          </h2>
          <table className="w-full max-w-md text-[10px]">
            <thead>
              <tr className="border-b">
                <th className="py-1 text-left">Rate / النسبة</th>
                <th className="text-right">Taxable / الخاضع</th>
                <th className="text-right">VAT / الضريبة</th>
                <th className="text-right">Total / الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(vatBreakdown).map(([rate, values]) => (
                <tr key={rate} className="border-b">
                  <td className="py-1">{rate}</td>
                  <td className="text-right tabular-nums" dir="ltr">
                    {formatSAR(values.net)}
                  </td>
                  <td className="text-right tabular-nums" dir="ltr">
                    {formatSAR(values.vat)}
                  </td>
                  <td className="text-right tabular-nums" dir="ltr">
                    {formatSAR(values.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt>
              <span dir="ltr">Subtotal (excl. VAT)</span> /{' '}
              <span dir="rtl">المجموع الفرعي غير شامل الضريبة</span>
            </dt>
            <dd className="shrink-0 tabular-nums" dir="ltr">
              {formatSAR(invoice.subtotalMinor)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>
              <span dir="ltr">Taxable amount</span> / <span dir="rtl">المبلغ الخاضع للضريبة</span>
            </dt>
            <dd className="shrink-0 tabular-nums" dir="ltr">
              {formatSAR(invoice.subtotalMinor)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>
              <span dir="ltr">VAT</span> / <span dir="rtl">ضريبة القيمة المضافة</span>
            </dt>
            <dd className="shrink-0 tabular-nums" dir="ltr">
              {formatSAR(invoice.vatMinor)}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t-2 border-black pt-2 text-base font-bold">
            <dt>
              <span dir="ltr">Grand total</span> / <span dir="rtl">الإجمالي شامل الضريبة</span>
            </dt>
            <dd className="shrink-0 tabular-nums" dir="ltr">
              {formatSAR(invoice.totalMinor)}
            </dd>
          </div>
          <div className="text-right text-[10px] text-neutral-600">
            <dt className="sr-only">Tax inclusion statement</dt>
            <dd>
              <span dir="ltr">Amount includes VAT</span> /{' '}
              <span dir="rtl">المبلغ شامل ضريبة القيمة المضافة</span>
            </dd>
          </div>
        </dl>
      </div>

      <footer className="invoice-footer mt-8 flex items-end justify-between gap-5 border-t pt-5">
        <div className="text-xs text-neutral-600">
          <p dir="ltr">All amounts are in Saudi Riyals (SAR).</p>
          <p dir="rtl">جميع المبالغ بالريال السعودي.</p>
        </div>
        {qrDataURL && (
          <figure className="shrink-0 text-center">
            {/* The QR is an embedded data URL and must retain its exact printed dimensions. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="size-[38mm]"
              src={qrDataURL}
              width={180}
              height={180}
              alt="ZATCA Phase 1 invoice QR code"
            />
            <figcaption className="mt-1 text-[9px]">
              <span dir="ltr">ZATCA QR</span> / <span dir="rtl">رمز الاستجابة السريعة</span>
            </figcaption>
          </figure>
        )}
      </footer>
    </article>
  )
}
