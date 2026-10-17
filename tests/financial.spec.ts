import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { nextInvoiceNumber } from '@/lib/invoice-number'
import { calculateInvoiceTotals, calculateLine } from '@/lib/vat'

describe('VAT calculations', () => {
  it('extracts VAT from a tax-inclusive standard-rated price', () => {
    assert.deepEqual(calculateLine({
      unitPriceMinor: 11_500,
      quantityMilliunits: 1000,
      vatCategory: 'standard',
      priceIncludesVat: true,
    }), {
      unitPriceMinor: 11_500,
      quantityMilliunits: 1000,
      vatCategory: 'standard',
      priceIncludesVat: true,
      vatRateBps: 1500,
      netMinor: 10_000,
      vatMinor: 1500,
      totalMinor: 11_500,
    })
  })

  it('adds VAT to a tax-exclusive standard-rated price', () => {
    assert.deepEqual(calculateLine({
      unitPriceMinor: 10_000,
      quantityMilliunits: 1000,
      vatCategory: 'standard',
      priceIncludesVat: false,
    }), {
      unitPriceMinor: 10_000,
      quantityMilliunits: 1000,
      vatCategory: 'standard',
      priceIncludesVat: false,
      vatRateBps: 1500,
      netMinor: 10_000,
      vatMinor: 1500,
      totalMinor: 11_500,
    })
  })

  it('keeps invoice totals equal to the sum of saved line totals', () => {
    const lines = [
      calculateLine({ unitPriceMinor: 11_500, quantityMilliunits: 2000, vatCategory: 'standard', priceIncludesVat: true }),
      calculateLine({ unitPriceMinor: 5000, quantityMilliunits: 1000, vatCategory: 'zero', priceIncludesVat: false }),
    ]
    const totals = calculateInvoiceTotals(lines)
    assert.equal(totals.totalMinor, totals.subtotalMinor + totals.vatMinor)
    assert.deepEqual(totals, { subtotalMinor: 25_000, vatMinor: 3000, totalMinor: 28_000 })
  })
})

describe('invoice numbering', () => {
  it('increments the daily sequence and resets on a new Saudi date', () => {
    const date = new Date('2026-10-17T12:00:00Z')
    assert.equal(nextInvoiceNumber(date), 'INV-20261017-0001')
    assert.equal(nextInvoiceNumber(date, 'INV-20261017-0009'), 'INV-20261017-0010')
    assert.equal(nextInvoiceNumber(new Date('2026-10-18T12:00:00Z'), 'INV-20261017-0010'), 'INV-20261018-0001')
  })
})
