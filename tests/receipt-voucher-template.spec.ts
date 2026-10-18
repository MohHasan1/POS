import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ReceiptVoucherTemplate } from '@/components/receipt-vouchers/ReceiptVoucherTemplate'
import type { ReceiptVoucher } from '@/payload-types'

function voucherFixture(overrides: Partial<ReceiptVoucher> = {}): ReceiptVoucher {
  return {
    amountMinor: 123_450,
    amountWordsArabic: 'فقط ألف ومائتان وأربعة وثلاثون ريالًا وخمسون هللةً لا غير',
    amountWordsEnglish: 'One Thousand Two Hundred Thirty Four Riyals And Fifty Halalas Only',
    business: {
      additionalTelephone: '+966 11 000 0001',
      businessAddress: 'Riyadh, Saudi Arabia',
      crNumber: '1010123456',
      email: 'receipts@example.com',
      logo: {
        filename: 'logo.png',
        mediaId: 7,
        mimeType: 'image/png',
        url: '/api/media/file/logo.png',
      },
      mobile: '+966 50 123 4567',
      sellerNameArabic: 'متجر الرياض',
      sellerNameEnglish: 'Riyadh Shop LLC',
      telephone: '+966 11 000 0000',
    },
    createdAt: '2026-10-18T00:00:00.000Z',
    id: 'voucher-id',
    idempotencyKey: 'idempotency-key',
    issuedAt: '2026-10-18T12:00:00.000Z',
    notes: 'Thank you',
    paymentDetails: {},
    paymentMethod: 'cash',
    purpose: 'Payment on account',
    receivedFrom: 'Customer Company',
    status: 'issued',
    updatedAt: '2026-10-18T00:00:00.000Z',
    voucherNumber: 'RV-000001',
    voucherDate: '2026-10-17T21:00:00.000Z',
    ...overrides,
  }
}

describe('receipt voucher template', () => {
  it('renders the bilingual voucher, branding and three blank signature areas', () => {
    const html = renderToStaticMarkup(
      createElement(ReceiptVoucherTemplate, { voucher: voucherFixture() }),
    )

    for (const value of [
      'Receipt Voucher',
      'سند قبض',
      'RV-000001',
      'Customer Company',
      'Riyadh Shop LLC',
      'متجر الرياض',
      'Riyadh, Saudi Arabia',
      '1010123456',
      '+966 11 000 0000',
      '+966 11 000 0001',
      '+966 50 123 4567',
      'receipts@example.com',
      '/api/media/file/logo.png',
      'One Thousand Two Hundred Thirty Four Riyals',
      'فقط ألف ومائتان',
      'Received By',
      'المستلم',
      'Manager',
      'المدير',
      'Accountant',
      'المحاسب',
    ]) {
      assert.match(html, new RegExp(value.replaceAll('+', '\\+')))
    }
    assert.match(html, /dir="rtl"/)
    assert.equal((html.match(/data-signature-line=/g) || []).length, 3)
    assert.match(html, /max-h-16 max-w-16 object-contain/)
    assert.match(html, /voucher-section-avoid/)
    assert.doesNotMatch(html, /signature[^>]+(?:src|value)=/i)
    assert.doesNotMatch(html, /310000000000003/)
  })

  it('omits empty optional business details and renders applicable bank transfer fields', () => {
    const html = renderToStaticMarkup(
      createElement(ReceiptVoucherTemplate, {
        voucher: voucherFixture({
          business: {
            businessAddress: 'Jeddah',
            sellerNameArabic: 'متجر جدة',
            sellerNameEnglish: 'Jeddah Shop',
          },
          notes: undefined,
          paymentDetails: {
            bankName: 'Saudi National Bank',
            transactionReference: 'TRX-1001',
            transferDate: '2026-10-17T21:00:00.000Z',
          },
          paymentMethod: 'bank_transfer',
        }),
      }),
    )

    assert.match(html, /Bank Transfer/)
    assert.match(html, /Saudi National Bank/)
    assert.match(html, /TRX-1001/)
    assert.doesNotMatch(html, /Business logo/)
    assert.doesNotMatch(html, /Notes/)
  })

  it('keeps long English and Arabic values intact without clipping', () => {
    const longEnglishName =
      'The Very Long International Trading and Professional Services Establishment Limited'
    const longArabicName =
      'مؤسسة التجارة الدولية والخدمات المهنية المتخصصة ذات الاسم التجاري الطويل'
    const longReceivedFrom =
      'A customer or business with an intentionally long registered name for print layout testing'
    const html = renderToStaticMarkup(
      createElement(ReceiptVoucherTemplate, {
        voucher: voucherFixture({
          business: {
            ...voucherFixture().business,
            sellerNameArabic: longArabicName,
            sellerNameEnglish: longEnglishName,
          },
          receivedFrom: longReceivedFrom,
        }),
      }),
    )

    assert.match(html, new RegExp(longEnglishName))
    assert.match(html, new RegExp(longArabicName))
    assert.match(html, new RegExp(longReceivedFrom))
    assert.match(html, /voucher-value/)
  })

  it('renders cheque and Other payment details only when applicable', () => {
    const chequeHtml = renderToStaticMarkup(
      createElement(ReceiptVoucherTemplate, {
        voucher: voucherFixture({
          paymentDetails: {
            bankName: 'Al Rajhi Bank',
            chequeDate: '2026-10-19T21:00:00.000Z',
            chequeNumber: 'CHQ-9001',
          },
          paymentMethod: 'cheque',
        }),
      }),
    )
    assert.match(chequeHtml, /Cheque number/)
    assert.match(chequeHtml, /CHQ-9001/)
    assert.match(chequeHtml, /Al Rajhi Bank/)
    assert.doesNotMatch(chequeHtml, /Transaction reference/)

    const otherHtml = renderToStaticMarkup(
      createElement(ReceiptVoucherTemplate, {
        voucher: voucherFixture({
          paymentDetails: {
            otherDescription: 'Certified money order',
            otherReference: 'MO-2026-77',
          },
          paymentMethod: 'other',
        }),
      }),
    )
    assert.match(otherHtml, /Certified money order/)
    assert.match(otherHtml, /MO-2026-77/)
    assert.doesNotMatch(otherHtml, /Bank name/)
  })

  it('marks voided vouchers clearly while preserving their original details', () => {
    const html = renderToStaticMarkup(
      createElement(ReceiptVoucherTemplate, {
        voucher: voucherFixture({
          status: 'voided',
          voidedAt: '2026-10-18T12:00:00.000Z',
          voidReason: 'Receipt entered for the wrong customer',
        }),
      }),
    )

    assert.match(html, /VOID · ملغي/)
    assert.match(html, /Void reason/)
    assert.match(html, /سبب الإلغاء/)
    assert.match(html, /Receipt entered for the wrong customer/)
    assert.match(html, /RV-000001/)
    assert.match(html, /Customer Company/)
    assert.equal((html.match(/data-signature-line=/g) || []).length, 3)
  })

  it('marks drafts clearly and prints issued vouchers without a status watermark', () => {
    const draftHtml = renderToStaticMarkup(
      createElement(ReceiptVoucherTemplate, {
        voucher: voucherFixture({ issuedAt: null, status: 'draft' }),
      }),
    )
    const issuedHtml = renderToStaticMarkup(
      createElement(ReceiptVoucherTemplate, { voucher: voucherFixture() }),
    )

    assert.match(draftHtml, /DRAFT · مسودة/)
    assert.match(draftHtml, /Draft \/ مسودة/)
    assert.doesNotMatch(issuedHtml, /DRAFT · مسودة/)
    assert.doesNotMatch(issuedHtml, /VOID · ملغي/)
  })

  it('keeps the A4 page height and protected print sections in print CSS', () => {
    const css = readFileSync(path.resolve(process.cwd(), 'src/app/(frontend)/styles.css'), 'utf8')

    assert.match(css, /@page\s*{\s*size: A4;/)
    assert.match(css, /\.receipt-voucher-page\s*{\s*min-height: 277mm;/)
    assert.match(css, /\.voucher-section-avoid,/)
    assert.match(css, /\.voucher-signatures,/)
    assert.match(css, /break-inside: avoid;/)
  })
})
