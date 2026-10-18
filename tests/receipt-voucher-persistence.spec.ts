import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import Database from 'libsql'
import { getPayload } from 'payload'

import {
  createReceiptVoucherDraft,
  getReceiptVoucher,
  issueReceiptVoucher,
  updateReceiptVoucherDraft,
  voidReceiptVoucher,
} from '@/services/receipt-vouchers'
import { createBusinessLogo, updateShopSettings } from '@/services/settings'

const createdVoucherIds: string[] = []
let logoId: number | undefined

const cashDraft = (overrides: Record<string, unknown> = {}) => ({
  amountMinor: 5_000,
  idempotencyKey: randomUUID(),
  paymentMethod: 'cash' as const,
  purpose: 'Advance payment',
  receivedFrom: 'Test Customer',
  voucherDate: '2026-10-18',
  ...overrides,
})

describe('receipt voucher persistence and lifecycle', () => {
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

  it('creates drafts for every payment method with unique numbers and immutable snapshots', async () => {
    const base = {
      amountMinor: 123_450,
      purpose: 'Payment on account',
      receivedFrom: 'Customer Company',
      voucherDate: '2026-10-18',
    }
    const vouchers = []
    vouchers.push(
      await createReceiptVoucherDraft({
        ...base,
        idempotencyKey: randomUUID(),
        paymentMethod: 'cash',
      }),
    )
    vouchers.push(
      await createReceiptVoucherDraft({
        ...base,
        bankName: 'Saudi National Bank',
        idempotencyKey: randomUUID(),
        paymentMethod: 'bank_transfer',
        transactionReference: 'TRX-1001',
        transferDate: '2026-10-18',
      }),
    )
    vouchers.push(
      await createReceiptVoucherDraft({
        ...base,
        bankName: 'Al Rajhi Bank',
        chequeDate: '2026-10-20',
        chequeNumber: 'CHQ-101',
        idempotencyKey: randomUUID(),
        paymentMethod: 'cheque',
      }),
    )
    vouchers.push(
      await createReceiptVoucherDraft({
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
    assert.ok(vouchers.every(({ issuedAt }) => issuedAt == null))
    assert.ok(vouchers.every(({ status }) => status === 'draft'))
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

  it('edits only drafts without changing their voucher number', async () => {
    const draft = await createReceiptVoucherDraft(cashDraft())
    createdVoucherIds.push(draft.id)

    const updated = await updateReceiptVoucherDraft(draft.id, {
      amountMinor: 7_550,
      bankName: 'Saudi National Bank',
      paymentMethod: 'bank_transfer',
      purpose: 'Updated deposit purpose',
      receivedFrom: 'Updated Customer',
      transactionReference: 'TRX-EDIT-1',
      transferDate: '2026-10-19',
      voucherDate: '2026-10-19',
    })

    assert.equal(updated.id, draft.id)
    assert.equal(updated.voucherNumber, draft.voucherNumber)
    assert.equal(updated.status, 'draft')
    assert.equal(updated.amountMinor, 7_550)
    assert.equal(updated.receivedFrom, 'Updated Customer')
    assert.equal(updated.paymentDetails?.transactionReference, 'TRX-EDIT-1')
  })

  it('deduplicates repeated draft submissions and persists through a fresh SQLite connection', async () => {
    const payload = await getPayload({ config })
    const input = cashDraft({ amountMinor: 750, receivedFrom: 'Restart Test Customer' })
    const first = await createReceiptVoucherDraft(input)
    createdVoucherIds.push(first.id)
    const repeated = await createReceiptVoucherDraft(input)
    const reopened = await getReceiptVoucher(first.id)
    const count = await payload.count({
      collection: 'receipt-vouchers',
      where: { idempotencyKey: { equals: input.idempotencyKey } },
    })

    const independentDatabase = new Database('test-pos.db', { readonly: true })
    const persisted = independentDatabase
      .prepare('SELECT voucher_number, status FROM receipt_vouchers WHERE id = ?')
      .get(first.id) as { status: string; voucher_number: string } | undefined
    independentDatabase.close()

    assert.equal(repeated.id, first.id)
    assert.equal(reopened?.id, first.id)
    assert.equal(count.totalDocs, 1)
    assert.equal(persisted?.voucher_number, first.voucherNumber)
    assert.equal(persisted?.status, 'draft')
  })

  it('issues a draft once and prevents all later detail edits', async () => {
    const draft = await createReceiptVoucherDraft(cashDraft())
    createdVoucherIds.push(draft.id)
    const issued = await issueReceiptVoucher(draft.id)
    const repeated = await issueReceiptVoucher(draft.id)

    assert.equal(issued.status, 'issued')
    assert.ok(issued.issuedAt)
    assert.equal(repeated.issuedAt, issued.issuedAt)
    assert.equal(issued.voucherNumber, draft.voucherNumber)
    await assert.rejects(
      updateReceiptVoucherDraft(draft.id, {
        amountMinor: 100,
        paymentMethod: 'cash',
        purpose: 'Forbidden edit',
        receivedFrom: 'Changed Customer',
        voucherDate: '2026-10-20',
      }),
      /Only draft receipt vouchers can be edited/,
    )
  })

  it('allows Issued → Voided and preserves every issued detail', async () => {
    const draft = await createReceiptVoucherDraft(
      cashDraft({ receivedFrom: 'Issued Void Customer' }),
    )
    createdVoucherIds.push(draft.id)
    const issued = await issueReceiptVoucher(draft.id)

    await assert.rejects(voidReceiptVoucher(draft.id, '   '), /Void reason is required/)
    const voided = await voidReceiptVoucher(draft.id, 'Entered for the wrong customer')

    assert.equal(voided.status, 'voided')
    assert.equal(voided.voidReason, 'Entered for the wrong customer')
    assert.ok(voided.voidedAt)
    assert.equal(voided.issuedAt, issued.issuedAt)
    assert.equal(voided.voucherNumber, issued.voucherNumber)
    assert.equal(voided.amountMinor, issued.amountMinor)
    assert.equal(voided.receivedFrom, issued.receivedFrom)
    await assert.rejects(voidReceiptVoucher(draft.id, 'Second attempt'), /already voided/)
  })

  it('allows Draft → Voided and rejects every transition out of Voided', async () => {
    const draft = await createReceiptVoucherDraft(
      cashDraft({ receivedFrom: 'Draft Void Customer' }),
    )
    createdVoucherIds.push(draft.id)
    const voided = await voidReceiptVoucher(draft.id, 'Draft was created by mistake')

    assert.equal(voided.status, 'voided')
    assert.equal(voided.issuedAt, null)
    await assert.rejects(issueReceiptVoucher(draft.id), /cannot be issued/)
    await assert.rejects(
      updateReceiptVoucherDraft(draft.id, {
        amountMinor: 100,
        paymentMethod: 'cash',
        purpose: 'Forbidden edit',
        receivedFrom: 'Changed Customer',
        voucherDate: '2026-10-20',
      }),
      /Only draft receipt vouchers can be edited/,
    )
  })
})
