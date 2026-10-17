import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { decodeZatcaQr, encodeZatcaQr } from '@/lib/zatca-qr'

describe('ZATCA Phase 1 TLV', () => {
  it('round-trips the five required values', () => {
    const fields = {
      sellerName: 'Riyadh Shop',
      vatNumber: '310000000000003',
      timestamp: '2026-10-17T15:30:00+03:00',
      total: '115.00',
      vatTotal: '15.00',
    }
    assert.deepEqual(decodeZatcaQr(encodeZatcaQr(fields)), fields)
  })

  it('uses UTF-8 byte lengths for Arabic seller names', () => {
    const fields = {
      sellerName: 'متجر الرياض',
      vatNumber: '310000000000003',
      timestamp: '2026-10-17T15:30:00+03:00',
      total: '23.00',
      vatTotal: '3.00',
    }
    const encoded = Buffer.from(encodeZatcaQr(fields), 'base64')
    assert.equal(encoded[1], Buffer.byteLength(fields.sellerName, 'utf8'))
    assert.deepEqual(decodeZatcaQr(encoded.toString('base64')), fields)
  })
})
