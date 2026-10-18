import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { minorToDecimal } from '@/lib/money'
import { DEFAULT_INVOICE_ADDRESS } from '@/lib/pos-types'
import { decodeZatcaQr } from '@/lib/zatca-qr'
import { finalizeInvoice } from '@/services/invoices'

const createdInvoiceIds: string[] = []

describe('invoice finalization', () => {
  after(async () => {
    const payload = await getPayload({ config })
    for (const id of createdInvoiceIds) {
      await payload.delete({ collection: 'invoices', id })
    }
  })

  it('returns the original invoice when the idempotency key is reused', async () => {
    const payload = await getPayload({ config })
    await payload.updateGlobal({
      slug: 'shop-settings',
      data: {
        displayName: 'QuickPOS Display Name',
        sellerNameArabic: 'متجر الاختبار',
        sellerNameEnglish: 'Test Shop',
        vatNumber: '310000000000003',
        businessAddress: 'Riyadh, Saudi Arabia',
        defaultPriceIncludesVat: true,
      },
    })

    const input = {
      idempotencyKey: randomUUID(),
      invoiceType: 'simplified' as const,
      items: [
        {
          descriptionEnglish: 'Test item',
          descriptionArabic: 'عنصر اختبار',
          unitPriceMinor: 1150,
          quantityMilliunits: 1000,
          vatCategory: 'standard' as const,
          priceIncludesVat: true,
        },
      ],
    }

    const first = await finalizeInvoice(input)
    createdInvoiceIds.push(first.id)
    const second = await finalizeInvoice(input)
    const count = await payload.count({
      collection: 'invoices',
      where: { idempotencyKey: { equals: input.idempotencyKey } },
    })

    assert.equal(second.id, first.id)
    assert.equal(count.totalDocs, 1)
    assert.equal(first.seller.nameEnglish, 'Test Shop')

    const qrFields = decodeZatcaQr(first.qrPayload)
    assert.equal(qrFields.sellerName, first.seller.nameArabic)
    assert.equal(qrFields.vatNumber, first.seller.vatNumber)
    assert.equal(new Date(qrFields.timestamp).getTime(), new Date(first.issuedAt).getTime())
    assert.equal(qrFields.total, minorToDecimal(first.totalMinor))
    assert.equal(qrFields.vatTotal, minorToDecimal(first.vatMinor))
  })

  it('allows a standard invoice for a non-VAT-registered buyer', async () => {
    const invoice = await finalizeInvoice({
      buyer: {
        address: 'Jeddah, Saudi Arabia',
        name: 'Walk-in Business Customer',
      },
      idempotencyKey: randomUUID(),
      invoiceType: 'standard',
      items: [
        {
          descriptionEnglish: 'Consulting service',
          descriptionArabic: 'خدمة استشارية',
          unitPriceMinor: 10_000,
          quantityMilliunits: 1000,
          vatCategory: 'standard',
          priceIncludesVat: false,
        },
      ],
    })
    createdInvoiceIds.push(invoice.id)

    assert.equal(invoice.buyer?.name, 'Walk-in Business Customer')
    assert.equal(invoice.buyer?.address, 'Jeddah, Saudi Arabia')
    assert.equal(invoice.buyer?.vatNumber, null)
    assert.equal(invoice.buyer?.identification, null)
  })

  it('defaults a missing standard-invoice address to Riyadh, Saudi Arabia', async () => {
    const invoice = await finalizeInvoice({
      buyer: { name: 'Buyer without an address' },
      idempotencyKey: randomUUID(),
      invoiceType: 'standard',
      items: [
        {
          descriptionEnglish: 'Test item',
          descriptionArabic: 'عنصر اختبار',
          unitPriceMinor: 100,
          quantityMilliunits: 1000,
          vatCategory: 'standard',
          priceIncludesVat: false,
        },
      ],
    })
    createdInvoiceIds.push(invoice.id)

    assert.equal(invoice.buyer?.address, DEFAULT_INVOICE_ADDRESS)
  })

  it('still requires a buyer name for a standard invoice', async () => {
    await assert.rejects(
      finalizeInvoice({
        buyer: { address: DEFAULT_INVOICE_ADDRESS },
        idempotencyKey: randomUUID(),
        invoiceType: 'standard',
        items: [
          {
            descriptionEnglish: 'Test item',
            descriptionArabic: 'عنصر اختبار',
            unitPriceMinor: 100,
            quantityMilliunits: 1000,
            vatCategory: 'standard',
            priceIncludesVat: false,
          },
        ],
      }),
      /buyer name/,
    )
  })

  it('validates a buyer VAT number when one is supplied', async () => {
    await assert.rejects(
      finalizeInvoice({
        buyer: {
          address: 'Riyadh, Saudi Arabia',
          name: 'Registered Buyer',
          vatNumber: '123',
        },
        idempotencyKey: randomUUID(),
        invoiceType: 'standard',
        items: [
          {
            descriptionEnglish: 'Test item',
            descriptionArabic: 'عنصر اختبار',
            unitPriceMinor: 100,
            quantityMilliunits: 1000,
            vatCategory: 'standard',
            priceIncludesVat: false,
          },
        ],
      }),
      /valid 15-digit Saudi buyer VAT number/,
    )
  })
})
