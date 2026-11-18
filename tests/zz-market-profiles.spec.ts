import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'

import { getPeriodBounds } from '@/lib/calendar'
import { MARKET_PROFILES } from '@/lib/market'
import { formatMoney } from '@/lib/money'
import { amountMinorToWords } from '@/lib/receipt-voucher'
import { finalizeInvoice } from '@/services/invoices'
import { createProduct } from '@/services/products'
import { createReceiptVoucherDraft } from '@/services/receipt-vouchers'
import { isCountryLocked, updateShopSettings } from '@/services/settings'

describe('Bangladesh market profile', () => {
  it('uses BDT formatting and Dhaka calendar boundaries', () => {
    const profile = MARKET_PROFILES.BD
    assert.equal(formatMoney(123_45, profile, 'en-BD'), '৳123.45')

    const bounds = getPeriodBounds(profile, new Date('2026-11-17T18:30:00.000Z'))
    assert.equal(bounds.todayStart.toISOString(), '2026-11-17T18:00:00.000Z')
    assert.equal(bounds.nextDayStart.toISOString(), '2026-11-18T18:00:00.000Z')

    const words = amountMinorToWords(123_45, profile)
    assert.match(words.english, /Taka/i)
    assert.ok(words.bangla)
    assert.equal(words.arabic, undefined)
  })

  it('creates tax-free sales invoices and BDT receipt vouchers without ZATCA data', async () => {
    await updateShopSettings({
      autoTranslateProducts: true,
      businessAddress: 'Dhaka, Bangladesh',
      countryCode: 'BD',
      defaultPriceIncludesVat: false,
      displayName: 'Dhaka Test Shop',
      registrations: [
        { type: 'tradeLicense', value: 'TL-123' },
        { type: 'tin', value: 'TIN-456' },
      ],
      secondaryLanguage: 'bn',
      sellerNameArabic: null,
      sellerNameBangla: 'ঢাকা টেস্ট শপ',
      sellerNameEnglish: 'Dhaka Test Shop',
      vatNumber: null,
    })

    const product = await createProduct({
      nameArabic: null,
      nameBangla: 'চুল কাটা',
      nameEnglish: 'Haircut',
      priceIncludesVat: true,
      priceMinor: 500_00,
      sku: `BD-${randomUUID()}`,
      translations: [{ language: 'bn', name: 'চুল কাটা' }],
      vatCategory: 'standard',
    })

    const invoice = await finalizeInvoice({
      idempotencyKey: randomUUID(),
      invoiceType: 'sales',
      items: [{ productId: product.id, quantityMilliunits: 1000, unitPriceMinor: 500_00 }],
    })
    assert.equal(invoice.countryCode, 'BD')
    assert.equal(invoice.currencyCode, 'BDT')
    assert.equal(invoice.timeZone, 'Asia/Dhaka')
    assert.equal(invoice.invoiceType, 'sales')
    assert.equal(invoice.vatMinor, 0)
    assert.equal(invoice.totalMinor, 500_00)
    assert.equal(invoice.qrPayload, null)
    assert.equal(invoice.items[0].vatRateBps, 0)

    await assert.rejects(
      finalizeInvoice({
        idempotencyKey: randomUUID(),
        invoiceType: 'simplified',
        items: [{ productId: product.id, quantityMilliunits: 1000, unitPriceMinor: 500_00 }],
      }),
      /Sales Invoice type/,
    )

    const voucher = await createReceiptVoucherDraft({
      amountMinor: 1000_50,
      idempotencyKey: randomUUID(),
      paymentMethod: 'cash',
      purpose: 'Advance payment',
      receivedFrom: 'Customer',
      voucherDate: '2026-11-18',
    })
    assert.equal(voucher.countryCode, 'BD')
    assert.equal(voucher.currencyCode, 'BDT')
    assert.equal(voucher.amountWordsArabic, null)
    assert.ok(voucher.amountWordsBangla)
    assert.match(voucher.amountWordsEnglish, /Taka/i)
    assert.equal(await isCountryLocked(), true)
  })
})

