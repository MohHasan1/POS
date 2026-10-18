import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { getPayload } from 'payload'

import {
  finalizeReceiptVoucher,
  getReceiptVoucher,
  voidReceiptVoucher,
} from '@/services/receipt-vouchers'
import { createBusinessLogo, updateShopSettings } from '@/services/settings'

const createdVoucherIds: string[] = []
let logoId: number | undefined

describe('receipt voucher persistence', () => {
  before(async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const logo = await createBusinessLogo(
      { data: png, mimetype: 'image/png', name: 'voucher-logo.png', size: png.length },
      'Voucher business logo',
    )
    logoId = logo.id
    await updateShopSettings({
      additionalTelephone: '+966 11 000 0001',
      businessAddress: 'Riyadh, Saudi Arabia',
      crNumber: '1010123456',
      defaultPriceIncludesVat: true,
      displayName: 'QuickPOS Test Shop',
      email: 'receipts@example.com',
      logo: logo.id,
      mobile: '+966 50 123 4567',
      sellerNameArabic: 'متجر الاختبار',
      sellerNameEnglish: 'QuickPOS Test Shop LLC',
      telephone: '+966 11 000 0000',
      vatNumber: '310000000000003',
    })
  })

  after(async () => {
    const payload = await getPayload({ config })
    for (const id of createdVoucherIds) {
      await payload.delete({ collection: 'receipt-vouchers', id, overrideAccess: true })
    }
    await updateShopSettings({ logo: null })
    if (logoId) await payload.delete({ collection: 'media', id: logoId, overrideAccess: true })
  })

  it('saves all payment methods, assigns unique numbers and preserves the business snapshot', async () => {
    const base = {
      amountMinor: 123_450,
      issuedAt: '2026-10-18',
      purpose: 'Payment on account',
      receivedFrom: 'Customer Company',
    }
    const vouchers = []
    vouchers.push(
      await finalizeReceiptVoucher({
        ...base,
        idempotencyKey: randomUUID(),
        paymentMethod: 'cash',
      }),
    )
    vouchers.push(
      await finalizeReceiptVoucher({
        ...base,
        bankName: 'Saudi National Bank',
        idempotencyKey: randomUUID(),
        paymentMethod: 'bank_transfer',
        transactionReference: 'TRX-1001',
        transferDate: '2026-10-18',
      }),
    )
    vouchers.push(
      await finalizeReceiptVoucher({
        ...base,
        bankName: 'Al Rajhi Bank',
        chequeDate: '2026-10-20',
        chequeNumber: 'CHQ-101',
        idempotencyKey: randomUUID(),
        paymentMethod: 'cheque',
      }),
    )
    vouchers.push(
      await finalizeReceiptVoucher({
        ...base,
        idempotencyKey: randomUUID(),
        otherDescription: 'Money order',
        otherReference: 'MO-77',
        paymentMethod: 'other',
      }),
    )
    createdVoucherIds.push(...vouchers.map(({ id }) => id))

    assert.equal(new Set(vouchers.map(({ voucherNumber }) => voucherNumber)).size, 4)
    assert.ok(vouchers.every(({ voucherNumber }) => voucherNumber.startsWith('RV-')))
    assert.deepEqual(vouchers.map(({ paymentMethod }) => paymentMethod).sort(), [
      'bank_transfer',
      'cash',
      'cheque',
      'other',
    ])

    const cash = vouchers.find(({ paymentMethod }) => paymentMethod === 'cash')!
    assert.equal(cash.paymentDetails?.bankName, null)
    assert.equal(cash.business.crNumber, '1010123456')
    assert.equal(cash.business.telephone, '+966 11 000 0000')
    assert.equal(cash.business.additionalTelephone, '+966 11 000 0001')
    assert.equal(cash.business.mobile, '+966 50 123 4567')
    assert.equal(cash.business.email, 'receipts@example.com')
    assert.equal(cash.business.logo?.mediaId, logoId)
    assert.match(cash.business.logo?.url || '', /voucher-logo/)
    assert.equal(cash.amountWordsEnglish.includes('Fifty Halalas'), true)
    assert.equal(cash.amountWordsArabic.includes('خمسون هللةً'), true)
  })

  it('reuses one finalized record for repeated submissions and retrieval does not create records', async () => {
    const payload = await getPayload({ config })
    const input = {
      amountMinor: 750,
      idempotencyKey: randomUUID(),
      issuedAt: '2026-10-18',
      paymentMethod: 'cash' as const,
      purpose: 'Deposit',
      receivedFrom: 'Walk-in customer',
    }
    const first = await finalizeReceiptVoucher(input)
    createdVoucherIds.push(first.id)
    const repeated = await finalizeReceiptVoucher(input)
    const reopened = await getReceiptVoucher(first.id)
    const count = await payload.count({
      collection: 'receipt-vouchers',
      where: { idempotencyKey: { equals: input.idempotencyKey } },
    })

    assert.equal(repeated.id, first.id)
    assert.equal(reopened?.id, first.id)
    assert.equal(count.totalDocs, 1)
  })

  it('voids a voucher with a reason without changing its finalized values', async () => {
    const voucher = await finalizeReceiptVoucher({
      amountMinor: 5_000,
      idempotencyKey: randomUUID(),
      issuedAt: '2026-10-18',
      paymentMethod: 'cash',
      purpose: 'Advance payment',
      receivedFrom: 'Void Test Customer',
    })
    createdVoucherIds.push(voucher.id)

    await assert.rejects(voidReceiptVoucher(voucher.id, '   '), /Void reason is required/)
    const voided = await voidReceiptVoucher(voucher.id, 'Entered for the wrong customer')

    assert.equal(voided.status, 'void')
    assert.equal(voided.voidReason, 'Entered for the wrong customer')
    assert.ok(voided.voidedAt)
    assert.equal(voided.voucherNumber, voucher.voucherNumber)
    assert.equal(voided.amountMinor, voucher.amountMinor)
    assert.equal(voided.receivedFrom, voucher.receivedFrom)
    await assert.rejects(voidReceiptVoucher(voucher.id, 'Second attempt'), /already void/)
  })
})
