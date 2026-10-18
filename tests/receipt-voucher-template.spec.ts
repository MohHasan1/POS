import assert from 'node:assert/strict'
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
    issuedAt: '2026-10-17T21:00:00.000Z',
    notes: 'Thank you',
    paymentDetails: {},
    paymentMethod: 'cash',
    purpose: 'Payment on account',
    receivedFrom: 'Customer Company',
    status: 'active',
    updatedAt: '2026-10-18T00:00:00.000Z',
    voucherNumber: 'RV-000001',
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
    assert.equal((html.match(/pt-16/g) || []).length, 3)
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
})
