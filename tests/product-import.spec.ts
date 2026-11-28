import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { allocateProductSku } from '@/lib/product-sku'
import { importProducts } from '@/services/product-transfer'
import { createProduct, updateProduct } from '@/services/products'

const existingSku = `IMPORT-${randomUUID()}`
const newSku = `IMPORT-${randomUUID()}`
const generatedFixture = `Generated SKU ${randomUUID()}`

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
    await payload.delete({ collection: 'products', where: { nameEnglish: { contains: generatedFixture } } })
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
    assert.equal(updated.unitCostMinor, 0)
    assert.equal(updated.active, false)

    const created = await payload.find({
      collection: 'products',
      limit: 1,
      where: { sku: { equals: newSku } },
    })
    assert.equal(created.docs[0]?.nameEnglish, 'Coffee')
    assert.equal(created.docs[0]?.unitCostMinor, 0)
  })

  it('assigns distinct SKUs to blank products from forms and imports and preserves them on rename', async () => {
    const form = {
      nameEnglish: `${generatedFixture} form`,
      priceIncludesVat: false,
      priceMinor: 2_500,
      sku: ' ',
      vatCategory: 'exempt' as const,
    }
    const product = await createProduct(form)
    assert.match(product.sku || '', /^SKU-[A-F0-9]{8}$/)
    const renamed = await updateProduct(product.id, { ...form, nameEnglish: `${generatedFixture} renamed`, sku: '' })
    assert.equal(renamed.sku, product.sku)

    const csvName = `${generatedFixture} CSV`
    assert.deepEqual(await importProducts([{ ...form, nameEnglish: csvName, active: false, sku: undefined }]), { created: 1, updated: 0 })
    const payload = await getPayload({ config })
    const { docs: [imported] } = await payload.find({
      collection: 'products', where: { nameEnglish: { equals: csvName } },
    })
    assert.match(imported?.sku || '', /^SKU-[A-F0-9]{8}$/)
    assert.notEqual(imported.sku, renamed.sku)
    assert.equal(imported.active, false)

    await assert.rejects(createProduct({ ...form, sku: renamed.sku }))
    const changed = await updateProduct(renamed.id, { ...form, sku: `CUSTOM-${randomUUID()}` })
    assert.match(changed.sku || '', /^CUSTOM-/)
  })

  it('retries generated candidates that are already in use', async () => {
    let attempts = 0
    const sku = await allocateProductSku(() => ++attempts === 1)
    assert.match(sku, /^SKU-[A-F0-9]{8}$/)
    assert.equal(attempts, 2)
  })
})
