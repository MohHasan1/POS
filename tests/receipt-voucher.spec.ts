import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'

import {
  amountMinorToWords,
  nextReceiptVoucherNumber,
  saudiDateToISOString,
} from '@/lib/receipt-voucher'
import { finalizeReceiptVoucherSchema } from '@/lib/receipt-voucher-validation'

const baseInput = {
  amountMinor: 123_450,
  idempotencyKey: randomUUID(),
  issuedAt: '2026-10-18',
  purpose: 'Payment on account',
  receivedFrom: 'Sample Customer',
}

describe('receipt voucher helpers', () => {
  it('allocates a dedicated sequential voucher number', () => {
    assert.equal(nextReceiptVoucherNumber(), 'RV-000001')
    assert.equal(nextReceiptVoucherNumber('RV-000001'), 'RV-000002')
    assert.equal(nextReceiptVoucherNumber('RV-999999'), 'RV-1000000')
    assert.throws(() => nextReceiptVoucherNumber('INV-000001'), /Invalid receipt voucher number/)
  })

  it('writes SAR and halalas accurately in English and Arabic', () => {
    assert.deepEqual(amountMinorToWords(123_450), {
      english: 'One Thousand Two Hundred Thirty Four Riyals And Fifty Halalas Only',
      arabic: 'فقط ألف ومائتان وأربعة وثلاثون ريالًا وخمسون هللةً لا غير',
    })
    assert.deepEqual(amountMinorToWords(75), {
      english: 'Zero Riyals And Seventy Five Halalas Only',
      arabic: 'فقط صفر ريال وخمس وسبعون هللةً لا غير',
    })
  })

  it('stores valid Saudi dates without silently normalizing impossible dates', () => {
    assert.equal(saudiDateToISOString('2026-10-18'), '2026-10-17T21:00:00.000Z')
    assert.throws(() => saudiDateToISOString('2026-02-31'), /Invalid date/)
  })
})

describe('receipt voucher payment validation', () => {
  it('accepts all four supported payment methods with their applicable details', () => {
    const inputs = [
      { ...baseInput, paymentMethod: 'cash' },
      {
        ...baseInput,
        bankName: 'Saudi National Bank',
        paymentMethod: 'bank_transfer',
        transactionReference: 'TRX-1001',
        transferDate: '2026-10-18',
      },
      {
        ...baseInput,
        bankName: 'Al Rajhi Bank',
        chequeDate: '2026-10-20',
        chequeNumber: 'CHQ-101',
        paymentMethod: 'cheque',
      },
      {
        ...baseInput,
        otherDescription: 'Money order',
        otherReference: 'MO-77',
        paymentMethod: 'other',
      },
    ]

    for (const input of inputs) assert.equal(finalizeReceiptVoucherSchema.safeParse(input).success, true)
  })

  it('rejects missing conditional fields and unsupported Card payments', () => {
    assert.equal(
      finalizeReceiptVoucherSchema.safeParse({ ...baseInput, paymentMethod: 'bank_transfer' }).success,
      false,
    )
    assert.equal(
      finalizeReceiptVoucherSchema.safeParse({ ...baseInput, paymentMethod: 'cheque' }).success,
      false,
    )
    assert.equal(
      finalizeReceiptVoucherSchema.safeParse({ ...baseInput, paymentMethod: 'other' }).success,
      false,
    )
    assert.equal(
      finalizeReceiptVoucherSchema.safeParse({ ...baseInput, paymentMethod: 'card' }).success,
      false,
    )
  })
})
