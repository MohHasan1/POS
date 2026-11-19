import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { finalizeInvoice } from '@/services/invoices'
import { getMissingCostLines, upsertInvoiceCostOverride } from '@/services/business-reporting'
import { createProduct, updateProduct } from '@/services/products'
import { updateShopSettings } from '@/services/settings'

const invoiceIds: string[] = []
const overrideIds: string[] = []
const productIds: string[] = []

describe('invoice direct cost snapshots', () => {
  after(async () => {
    const payload = await getPayload({ config })
    for (const id of overrideIds) await payload.delete({ collection: 'invoice-cost-overrides', id })
    for (const id of invoiceIds) await payload.delete({ collection: 'invoices', id })
    for (const id of productIds) await payload.delete({ collection: 'products', id })
  })

  it('snapshots fractional-quantity cost and ignores later product cost changes', async () => {
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر التكلفة',
      sellerNameEnglish: 'Cost Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
    const product = await createProduct({
      nameArabic: 'خدمة',
      nameEnglish: 'Costed service',
      priceIncludesVat: false,
      priceMinor: 10_000,
      translations: [{ language: 'ar', name: 'خدمة' }],
      unitCostMinor: 4_000,
      vatCategory: 'standard',
    })
    productIds.push(product.id)
    const invoice = await finalizeInvoice({
      idempotencyKey: randomUUID(),
      invoiceType: 'simplified',
      items: [{ productId: product.id, quantityMilliunits: 1_500, unitPriceMinor: 10_000 }],
    })
    invoiceIds.push(invoice.id)
    assert.deepEqual(invoice.items[0].cost, { totalCostMinor: 6_000, unitCostMinor: 4_000 })

    await updateProduct(product.id, { ...product, unitCostMinor: 5_000 })
    const payload = await getPayload({ config })
    const unchanged = await payload.findByID({ collection: 'invoices', id: invoice.id })
    assert.deepEqual(unchanged.items[0].cost, { totalCostMinor: 6_000, unitCostMinor: 4_000 })
  })

  it('defaults a product without an entered unit cost to zero', async () => {
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر التكلفة',
      sellerNameEnglish: 'Cost Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
    const product = await createProduct({
      nameArabic: 'خدمة مجانية التكلفة',
      nameEnglish: 'Zero-cost service',
      priceIncludesVat: false,
      priceMinor: 5_000,
      translations: [{ language: 'ar', name: 'خدمة مجانية التكلفة' }],
      vatCategory: 'standard',
    })
    productIds.push(product.id)
    assert.equal(product.unitCostMinor, 0)

    const invoice = await finalizeInvoice({
      idempotencyKey: randomUUID(),
      invoiceType: 'simplified',
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 5_000 }],
    })
    invoiceIds.push(invoice.id)
    assert.deepEqual(invoice.items[0].cost, { totalCostMinor: 0, unitCostMinor: 0 })
  })

  it('lists null legacy costs until a report-only correction is saved', async () => {
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر التكلفة',
      sellerNameEnglish: 'Cost Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
    const invoice = await finalizeInvoice({
      idempotencyKey: randomUUID(),
      invoiceType: 'simplified',
      items: [
        {
          descriptionArabic: 'خدمة قديمة',
          descriptionEnglish: 'Legacy service without cost',
          priceIncludesVat: false,
          quantityMilliunits: 1_000,
          unitPriceMinor: 5_000,
          vatCategory: 'standard',
        },
      ],
    })
    invoiceIds.push(invoice.id)
    const itemId = invoice.items[0].id!

    assert.equal(
      (await getMissingCostLines()).some((line) => line.invoiceItemId === itemId),
      true,
    )

    const override = await upsertInvoiceCostOverride({
      invoiceId: invoice.id,
      invoiceItemId: itemId,
      unitCostMinor: 0,
    })
    overrideIds.push(override.id)
    assert.equal(
      (await getMissingCostLines()).some((line) => line.invoiceItemId === itemId),
      false,
    )
  })
})
