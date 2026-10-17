import type { Invoice } from '@/payload-types'
import Image from 'next/image'
import { formatQuantity, formatSAR } from '@/lib/money'
import { formatSaudiDateTime } from '@/lib/saudi-time'

function vatLabel(category: Invoice['items'][number]['vatCategory'], rateBps: number) {
  if (category === 'exempt') return 'Exempt / معفى'
  return `${rateBps / 100}%`
}

export function InvoiceBody({
  invoice,
  qrDataURL,
  standard,
}: {
  invoice: Invoice
  qrDataURL: string
  standard: boolean
}) {
  const vatBreakdown = invoice.items.reduce<Record<string, { net: number; vat: number }>>((groups, item) => {
    const key = vatLabel(item.vatCategory, item.vatRateBps)
    const current = groups[key] || { net: 0, vat: 0 }
    groups[key] = { net: current.net + item.netMinor, vat: current.vat + item.vatMinor }
    return groups
  }, {})

  return (
    <article className="invoice-page border p-6 shadow-sm sm:p-8">
      <header className="grid grid-cols-[1fr_auto] gap-6 border-b-2 border-black pb-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide">{invoice.seller.nameEnglish}</p>
          <p className="mt-1 text-lg font-bold" dir="rtl">{invoice.seller.nameArabic}</p>
          <p className="mt-2 max-w-md whitespace-pre-line text-xs leading-5">{invoice.seller.address}</p>
          <p className="mt-1 text-xs">VAT No. / الرقم الضريبي: {invoice.seller.vatNumber}</p>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold">{standard ? 'TAX INVOICE' : 'SIMPLIFIED TAX INVOICE'}</h1>
          <p className="mt-1 text-xl font-bold" dir="rtl">{standard ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة'}</p>
          <p className="mt-3 text-sm font-semibold">{invoice.invoiceNumber}</p>
        </div>
      </header>

      <section className="grid gap-3 border-b py-4 text-sm sm:grid-cols-2">
        <div><span className="font-semibold">Issue date / تاريخ الإصدار:</span><br />{formatSaudiDateTime(invoice.issuedAt, 'en-SA')}</div>
        <div className="sm:text-right"><span className="font-semibold">Saudi Arabia time / توقيت السعودية:</span><br />{formatSaudiDateTime(invoice.issuedAt, 'ar-SA')}</div>
      </section>

      {standard && invoice.buyer && (
        <section className="grid gap-3 border-b py-4 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-2 font-bold">Buyer / المشتري</h2>
            <p>{invoice.buyer.name}</p>
            <p className="whitespace-pre-line">{invoice.buyer.address}</p>
          </div>
          <div className="sm:text-right">
            {invoice.buyer.vatNumber && <p>VAT No. / الرقم الضريبي: {invoice.buyer.vatNumber}</p>}
            {invoice.buyer.identification && <p>ID / رقم التعريف: {invoice.buyer.identification}</p>}
          </div>
        </section>
      )}

      <table className="mt-5 w-full table-fixed border-collapse text-xs">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="w-10 px-1 py-2 text-left">#</th>
            <th className="px-1 py-2 text-left">Item / الصنف</th>
            <th className="w-16 px-1 py-2 text-right">Qty<br />الكمية</th>
            <th className="w-24 px-1 py-2 text-right">Unit price<br />سعر الوحدة</th>
            <th className="w-16 px-1 py-2 text-right">VAT<br />الضريبة</th>
            <th className="w-24 px-1 py-2 text-right">Total<br />الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={item.id || index} className="border-b">
              <td className="px-1 py-2 align-top">{index + 1}</td>
              <td className="px-1 py-2 align-top">
                <span className="block font-medium">{item.descriptionEnglish}</span>
                <span className="block" dir="rtl">{item.descriptionArabic}</span>
              </td>
              <td className="px-1 py-2 text-right align-top tabular-nums">{formatQuantity(item.quantityMilliunits)}</td>
              <td className="px-1 py-2 text-right align-top tabular-nums">{formatSAR(item.unitPriceMinor)}</td>
              <td className="px-1 py-2 text-right align-top tabular-nums">{vatLabel(item.vatCategory, item.vatRateBps)}</td>
              <td className="px-1 py-2 text-right align-top font-medium tabular-nums">{formatSAR(item.totalMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 grid items-start gap-6 sm:grid-cols-[1fr_260px]">
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase">VAT breakdown / ملخص الضريبة</h2>
          <table className="w-full max-w-sm text-xs">
            <thead><tr className="border-b"><th className="py-1 text-left">Rate / النسبة</th><th className="text-right">Taxable / الخاضع</th><th className="text-right">VAT / الضريبة</th></tr></thead>
            <tbody>
              {Object.entries(vatBreakdown).map(([rate, values]) => (
                <tr key={rate} className="border-b"><td className="py-1">{rate}</td><td className="text-right">{formatSAR(values.net)}</td><td className="text-right">{formatSAR(values.vat)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt>Subtotal / المجموع</dt><dd className="tabular-nums">{formatSAR(invoice.subtotalMinor)}</dd></div>
          <div className="flex justify-between gap-3"><dt>VAT / الضريبة</dt><dd className="tabular-nums">{formatSAR(invoice.vatMinor)}</dd></div>
          <div className="flex justify-between gap-3 border-t-2 border-black pt-2 text-base font-bold"><dt>Total / الإجمالي</dt><dd className="tabular-nums">{formatSAR(invoice.totalMinor)}</dd></div>
        </dl>
      </div>

      <footer className="mt-8 flex items-end justify-between gap-5 border-t pt-5">
        <div className="text-xs text-neutral-600">
          <p>Amounts are in Saudi Riyals (SAR).</p>
          <p dir="rtl">جميع المبالغ بالريال السعودي.</p>
        </div>
        <Image
          src={qrDataURL}
          width={150}
          height={150}
          unoptimized
          alt="ZATCA Phase 1 invoice QR code"
        />
      </footer>
    </article>
  )
}
