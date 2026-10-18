import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'

import {
  amountMinorToWords,
  nextReceiptVoucherNumber,
  saudiDateToISOString,
} from '@/lib/receipt-voucher'
import { createReceiptVoucherSchema } from '@/lib/receipt-voucher-validation'

const baseInput = {
  amountMinor: 123_450,
  idempotencyKey: randomUUID(),
  purpose: 'Payment on account',
  receivedFrom: 'Sample Customer',
  voucherDate: '2026-10-18',
}

describe('receipt voucher helpers', () => {
  it('allocates a dedicated sequential voucher number', () => {
    assert.equal(nextReceiptVoucherNumber(), 'RV-000001')
    assert.equal(nextReceiptVoucherNumber('RV-000001'), 'RV-000002')
    assert.equal(nextReceiptVoucherNumber('RV-999999'), 'RV-1000000')
    assert.throws(() => nextReceiptVoucherNumber('INV-000001'), /Invalid receipt voucher number/)
  })

  it('writes SAR and halalas accurately in English and Arabic', () => {
    const cases = [
      [1, 'Zero Riyals And One Halala Only', 'فقط صفر ريال وهللة واحدة لا غير'],
      [2, 'Zero Riyals And Two Halalas Only', 'فقط صفر ريال وهللتان لا غير'],
      [75, 'Zero Riyals And Seventy Five Halalas Only', 'فقط صفر ريال وخمس وسبعون هللةً لا غير'],
      [100, 'One Riyal Only', 'فقط ريال واحد لا غير'],
      [200, 'Two Riyals Only', 'فقط ريالان لا غير'],
      [1_150, 'Eleven Riyals And Fifty Halalas Only', 'فقط أحد عشر ريالًا وخمسون هللةً لا غير'],
      [
        123_450,
        'One Thousand Two Hundred Thirty Four Riyals And Fifty Halalas Only',
        'فقط ألف ومائتان وأربعة وثلاثون ريالًا وخمسون هللةً لا غير',
      ],
      [200_000, 'Two Thousand Riyals Only', 'فقط ألفا ريال لا غير'],
      [100_000_000, 'One Million Riyals Only', 'فقط مليون ريال لا غير'],
      [
        99_999_999_999,
        'Nine Hundred Ninety Nine Million Nine Hundred Ninety Nine Thousand Nine Hundred Ninety Nine Riyals And Ninety Nine Halalas Only',
        'فقط تسعمائة وتسعة وتسعون مليونًا وتسعمائة وتسعة وتسعون ألفًا وتسعمائة وتسعة وتسعون ريالًا وتسع وتسعون هللةً لا غير',
      ],
    ] as const

    for (const [amountMinor, english, arabic] of cases) {
      assert.deepEqual(amountMinorToWords(amountMinor), { arabic, english })
    }
    assert.throws(() => amountMinorToWords(0), /positive whole number/)
    assert.throws(() => amountMinorToWords(1.5), /positive whole number/)
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

    for (const input of inputs)
      assert.equal(createReceiptVoucherSchema.safeParse(input).success, true)
  })

  it('rejects missing conditional fields and unsupported Card payments', () => {
    assert.equal(
      createReceiptVoucherSchema.safeParse({ ...baseInput, paymentMethod: 'bank_transfer' })
        .success,
      false,
    )
    assert.equal(
      createReceiptVoucherSchema.safeParse({ ...baseInput, paymentMethod: 'cheque' }).success,
      false,
    )
    assert.equal(
      createReceiptVoucherSchema.safeParse({ ...baseInput, paymentMethod: 'other' }).success,
      false,
    )
    assert.equal(
      createReceiptVoucherSchema.safeParse({ ...baseInput, paymentMethod: 'card' }).success,
      false,
    )
  })
})
