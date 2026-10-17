import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

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
      items: [{
        descriptionEnglish: 'Test item',
        descriptionArabic: 'عنصر اختبار',
        unitPriceMinor: 1150,
        quantityMilliunits: 1000,
        vatCategory: 'standard' as const,
        priceIncludesVat: true,
      }],
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
  })
})
