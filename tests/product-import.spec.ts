import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { importProducts } from '@/services/product-transfer'

const existingSku = `IMPORT-${randomUUID()}`
const newSku = `IMPORT-${randomUUID()}`

describe('product import', () => {
  after(async () => {
    const payload = await getPayload({ config })
    for (const sku of [existingSku, newSku]) {
      const products = await payload.find({
        collection: 'products',
        pagination: false,
        where: { sku: { equals: sku } },
      })
      for (const product of products.docs) {
        await payload.delete({ collection: 'products', id: product.id })
      }
    }
  })

  it('updates matching SKUs and creates unmatched products', async () => {
    const payload = await getPayload({ config })
    const existing = await payload.create({
      collection: 'products',
      data: {
        active: true,
        nameArabic: 'قديم',
        nameEnglish: 'Old name',
        priceIncludesVat: true,
        priceMinor: 100,
        sku: existingSku,
        vatCategory: 'standard',
      },
    })

    const result = await importProducts([
      {
        active: false,
        nameArabic: 'شاي',
        nameBangla: 'চা',
        nameEnglish: 'Tea',
        priceIncludesVat: false,
        priceMinor: 1_050,
        sku: existingSku,
        vatCategory: 'zero',
      },
      {
        active: true,
        nameArabic: 'قهوة',
        nameEnglish: 'Coffee',
        priceIncludesVat: true,
        priceMinor: 2_000,
        sku: newSku,
        vatCategory: 'standard',
      },
    ])

    assert.deepEqual(result, { created: 1, updated: 1 })

    const updated = await payload.findByID({ collection: 'products', id: existing.id })
    assert.equal(updated.nameEnglish, 'Tea')
    assert.equal(updated.priceMinor, 1_050)
    assert.equal(updated.active, false)

    const created = await payload.find({
      collection: 'products',
      limit: 1,
      where: { sku: { equals: newSku } },
    })
    assert.equal(created.docs[0]?.nameEnglish, 'Coffee')
  })
})
