import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { SimplifiedInvoiceTemplate } from '@/components/invoices/SimplifiedInvoiceTemplate'
import { StandardInvoiceTemplate } from '@/components/invoices/StandardInvoiceTemplate'
import type { Invoice } from '@/payload-types'

const qrDataURL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function invoiceFixture(invoiceType: Invoice['invoiceType']): Invoice {
  return {
    id: 'invoice-id',
    invoiceNumber: 'INV-20261017-0001',
    idempotencyKey: 'idempotency-key',
    invoiceType,
    issuedAt: '2026-10-17T12:30:00.000Z',
    seller: {
      nameArabic: 'متجر الرياض',
      nameEnglish: 'Riyadh Shop',
      vatNumber: '310000000000003',
      address: 'الرياض، المملكة العربية السعودية',
    },
    buyer:
      invoiceType === 'standard'
        ? {
            name: 'شركة المشتري',
            address: 'الرياض، المملكة العربية السعودية',
            vatNumber: '311111111111113',
          }
        : undefined,
    items: [
      {
        descriptionEnglish: 'Consulting service',
        descriptionArabic: 'خدمة استشارية',
        quantityMilliunits: 1000,
        unitPriceMinor: 11_500,
        priceIncludesVat: true,
        vatCategory: 'standard',
        vatRateBps: 1500,
        netMinor: 10_000,
        vatMinor: 1_500,
        totalMinor: 11_500,
      },
      {
        descriptionEnglish: 'Zero-rated item',
        descriptionArabic: 'صنف خاضع لنسبة الصفر',
        quantityMilliunits: 1000,
        unitPriceMinor: 5_000,
        priceIncludesVat: false,
        vatCategory: 'zero',
        vatRateBps: 0,
        netMinor: 5_000,
        vatMinor: 0,
        totalMinor: 5_000,
      },
    ],
    subtotalMinor: 15_000,
    vatMinor: 1_500,
    totalMinor: 16_500,
    qrPayload: 'phase-one-tlv',
    createdAt: '2026-10-17T12:30:00.000Z',
    updatedAt: '2026-10-17T12:30:00.000Z',
  }
}

describe('invoice templates', () => {
  it('renders the mandatory simplified invoice information and QR code', () => {
    const html = renderToStaticMarkup(
      createElement(SimplifiedInvoiceTemplate, {
        invoice: invoiceFixture('simplified'),
        qrDataURL,
      }),
    )

    for (const value of [
      'Simplified Tax Invoice',
      'فاتورة ضريبية مبسطة',
      'INV-20261017-0001',
      'Riyadh Shop',
      'متجر الرياض',
      '310000000000003',
      'Consulting service',
      'خدمة استشارية',
      'Taxable amount',
      'المبلغ الخاضع للضريبة',
      'VAT amount',
      'مبلغ الضريبة',
      'Grand total',
      'الإجمالي شامل الضريبة',
      'ZATCA Phase 1 invoice QR code',
    ]) {
      assert.match(html, new RegExp(value))
    }
    assert.match(html, /dir="rtl"/)
  })

  it('renders buyer details, VAT-exclusive pricing and tax treatment on a standard invoice', () => {
    const html = renderToStaticMarkup(
      createElement(StandardInvoiceTemplate, {
        invoice: invoiceFixture('standard'),
      }),
    )

    for (const value of [
      'Tax Invoice',
      'فاتورة ضريبية',
      'Buyer',
      'المشتري',
      'شركة المشتري',
      '311111111111113',
      'Unit price',
      'excl. VAT',
      'غير شامل الضريبة',
      'Tax treatment: Zero-rated supply',
      'المعالجة الضريبية: توريد خاضع لنسبة الصفر',
    ]) {
      assert.match(html, new RegExp(value))
    }
    assert.doesNotMatch(html, /ZATCA Phase 1 invoice QR code/)
  })
})
