import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { getPayload } from 'payload'

import type { ProductSummary } from '@/lib/pos-types'
import {
  buildServiceCardAccents,
  SERVICE_CARD_COLOR_CAPACITY,
} from '@/lib/service-board-colors'
import type { Invoice } from '@/payload-types'
import { finalizeInvoice } from '@/services/invoices'
import { buildSalesDashboard } from '@/services/sales-reporting'
import {
  addServiceBoardColumn,
  buildServiceBoardView,
  getServiceBoardColumnProducts,
  getServiceBoardView,
  moveServiceBoardColumn,
  removeServiceBoardColumn,
} from '@/services/service-board'

function productFixture(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    active: true,
    id: randomUUID(),
    nameArabic: 'خدمة',
    nameBangla: 'সেবা',
    nameEnglish: 'Service',
    priceIncludesVat: true,
    priceMinor: 1_150,
    sku: null,
    vatCategory: 'standard',
    ...overrides,
  }
}

function invoiceFixture(
  issuedAt: string,
  totalMinor: number,
  items: Invoice['items'],
  overrides: Partial<Invoice> = {},
): Invoice {
  return {
    createdAt: issuedAt,
    entrySource: 'live',
    id: randomUUID(),
    idempotencyKey: randomUUID(),
    invoiceNumber: `INV-${randomUUID()}`,
    invoiceType: 'simplified',
    issuedAt,
    issuedAtPrecision: 'exact',
    items,
    qrPayload: 'test',
    salesChannel: 'checkout',
    seller: {
      address: 'Riyadh',
      nameArabic: 'متجر',
      nameEnglish: 'Shop',
      vatNumber: '310000000000003',
    },
    subtotalMinor: totalMinor,
    totalMinor,
    updatedAt: issuedAt,
    vatMinor: 0,
    ...overrides,
  }
}

function itemFixture(
  product: ProductSummary,
  quantityMilliunits: number,
  totalMinor: number,
  includeReference = true,
): Invoice['items'][number] {
  return {
    descriptionArabic: product.nameArabic,
    descriptionBangla: product.nameBangla,
    descriptionEnglish: product.nameEnglish,
    netMinor: totalMinor,
    priceIncludesVat: product.priceIncludesVat,
    product: includeReference ? product.id : undefined,
    quantityMilliunits,
    totalMinor,
    unitPriceMinor: product.priceMinor,
    vatCategory: product.vatCategory,
    vatMinor: 0,
    vatRateBps: 0,
  }
}

describe('Service Board card colors', () => {
  it('assigns 150 distinct invoices unique colors and keeps repeated invoices matched', () => {
    const invoiceIds = Array.from({ length: 150 }, (_, index) => `invoice-${index}`)
    const accents = buildServiceCardAccents([...invoiceIds, 'invoice-42'])

    assert.equal(accents.size, 150)
    assert.equal(new Set([...accents.values()].map(({ slot }) => slot)).size, 150)
    assert.equal(new Set([...accents.values()].map(({ light }) => light)).size, 150)
    assert.equal(new Set([...accents.values()].map(({ dark }) => dark)).size, 150)
    assert.deepEqual(accents.get('invoice-42'), buildServiceCardAccents(invoiceIds).get('invoice-42'))
  })

  it('supports every unique color slot and rejects only when capacity is exceeded', () => {
    const atCapacity = Array.from(
      { length: SERVICE_CARD_COLOR_CAPACITY },
      (_, index) => `capacity-invoice-${index}`,
    )
    assert.equal(buildServiceCardAccents(atCapacity).size, SERVICE_CARD_COLOR_CAPACITY)
    assert.throws(
      () => buildServiceCardAccents([...atCapacity, 'one-too-many']),
      /supports up to 256 distinct invoice colors/,
    )
  })
})

describe('Service Board view model', () => {
  it('groups checkout and board lines, links visits, and falls back to exact legacy names', () => {
    const haircut = productFixture({ nameEnglish: 'Haircut', nameArabic: 'قص شعر' })
    const shave = productFixture({ nameEnglish: 'Shave', nameArabic: 'حلاقة' })
    const hidden = productFixture({ nameEnglish: 'Retail item', nameArabic: 'منتج' })
    const first = invoiceFixture(
      '2026-11-17T10:00:00.000Z',
      4_000,
      [itemFixture(haircut, 2_000, 2_300), itemFixture(shave, 1_000, 1_150)],
      {
        salesChannel: 'serviceBoard',
        serviceBoardDetails: {
          customerName: 'Amina',
          customerPhone: '+966500000000',
          note: 'First visit',
        },
      },
    )
    const legacy = invoiceFixture('2026-11-17T09:00:00.000Z', 2_000, [
      itemFixture(shave, 1_000, 1_150, false),
      itemFixture(hidden, 1_000, 850, false),
    ])

    const view = buildServiceBoardView([haircut, shave], [first, legacy])

    assert.equal(view.columns[0].cards.length, 1)
    assert.equal(view.columns[1].cards.length, 2)
    assert.equal(view.columns[0].cards[0].customerName, 'Amina')
    assert.deepEqual(view.columns[0].summary, {
      todayQuantityMilliunits: 2_000,
      todayRevenueMinor: 2_300,
    })
    assert.deepEqual(view.columns[1].summary, {
      todayQuantityMilliunits: 2_000,
      todayRevenueMinor: 2_300,
    })
    assert.equal(view.summary.allSalesTodayMinor, 6_000)
    assert.equal(view.summary.visibleServiceRevenueMinor, 4_600)
    assert.equal(view.summary.distinctVisits, 2)
    assert.equal(view.summary.mostPopularService?.productId, haircut.id)
  })

  it('uses overridden line totals and returns zero totals for an empty column', () => {
    const massage = productFixture({ nameEnglish: 'Massage', priceMinor: 1_000 })
    const facial = productFixture({ nameEnglish: 'Facial', priceMinor: 2_000 })
    const overriddenItem = itemFixture(massage, 1_500, 3_600)
    overriddenItem.unitPriceMinor = 2_400
    const invoice = invoiceFixture('2026-11-17T12:00:00.000Z', 3_600, [overriddenItem])

    const view = buildServiceBoardView([massage, facial], [invoice])

    assert.deepEqual(view.columns[0].summary, {
      todayQuantityMilliunits: 1_500,
      todayRevenueMinor: 3_600,
    })
    assert.deepEqual(view.columns[1].summary, {
      todayQuantityMilliunits: 0,
      todayRevenueMinor: 0,
    })
  })
})

describe('sales dashboard aggregation', () => {
  it('uses Saudi calendar boundaries, ranks by quantity, and includes more than 100 invoices', () => {
    const service = productFixture({ nameEnglish: 'Massage', nameArabic: 'تدليك' })
    const invoices = Array.from({ length: 105 }, (_, index) =>
      invoiceFixture(index === 0 ? '2026-11-17T20:59:59.000Z' : '2026-11-17T21:00:00.000Z', 1_000, [
        itemFixture(service, 1_000, 1_000),
      ]),
    )

    const dashboard = buildSalesDashboard(invoices, new Date('2026-11-18T12:00:00.000Z'))

    assert.equal(dashboard.allTime.invoiceCount, 105)
    assert.equal(dashboard.today.invoiceCount, 104)
    assert.equal(dashboard.today.totalMinor, 104_000)
    assert.equal(dashboard.today.averageMinor, 1_000)
    assert.equal(dashboard.topServices[0].nameEnglish, 'Massage')
    assert.equal(dashboard.topServices[0].quantityMilliunits, 105_000)
  })
})

describe('Service Board persistence and invoice creation', () => {
  const productIds: string[] = []
  const invoiceIds: string[] = []

  before(async () => {
    const payload = await getPayload({ config })
    await payload.updateGlobal({
      slug: 'shop-settings',
      data: {
        businessAddress: 'Riyadh, Saudi Arabia',
        defaultPriceIncludesVat: true,
        sellerNameArabic: 'متجر الاختبار',
        sellerNameEnglish: 'Test Shop',
        vatNumber: '310000000000003',
      },
    })
    await payload.updateGlobal({ slug: 'service-board-settings', data: { columns: [] } })

    for (const [nameEnglish, nameArabic] of [
      ['Haircut integration', 'قص شعر اختباري'],
      ['Shave integration', 'حلاقة اختبارية'],
    ]) {
      const product = await payload.create({
        collection: 'products',
        data: {
          active: true,
          nameArabic,
          nameEnglish,
          priceIncludesVat: true,
          priceMinor: 1_150,
          sku: `BOARD-${randomUUID()}`,
          vatCategory: 'standard',
        },
      })
      productIds.push(product.id)
    }
  })

  after(async () => {
    const payload = await getPayload({ config })
    await payload.updateGlobal({ slug: 'service-board-settings', data: { columns: [] } })
    for (const id of invoiceIds) await payload.delete({ collection: 'invoices', id })
    for (const id of productIds) await payload.delete({ collection: 'products', id })
  })

  it('adds, orders, and hides active product columns', async () => {
    await addServiceBoardColumn(productIds[0])
    await addServiceBoardColumn(productIds[1])
    await addServiceBoardColumn(productIds[0])
    assert.deepEqual(
      (await getServiceBoardColumnProducts()).map(({ id }) => id),
      productIds,
    )

    await moveServiceBoardColumn(productIds[1], 'left')
    assert.deepEqual(
      (await getServiceBoardColumnProducts()).map(({ id }) => id),
      [productIds[1], productIds[0]],
    )

    await removeServiceBoardColumn(productIds[1])
    assert.deepEqual(
      (await getServiceBoardColumnProducts()).map(({ id }) => id),
      [productIds[0]],
    )
    await addServiceBoardColumn(productIds[1])
  })

  it('stores one multi-service invoice with product links and private board details', async () => {
    const invoice = await finalizeInvoice(
      {
        idempotencyKey: randomUUID(),
        invoiceType: 'simplified',
        items: productIds.map((productId, index) => ({
          productId,
          quantityMilliunits: index === 0 ? 2_000 : 1_000,
          unitPriceMinor: index === 0 ? 1_500 : 1_150,
        })),
      },
      {
        salesChannel: 'serviceBoard',
        serviceBoardDetails: {
          customerName: 'Integration customer',
          customerPhone: '+966511111111',
          note: 'Operational note',
        },
      },
    )
    invoiceIds.push(invoice.id)

    assert.equal(invoice.salesChannel, 'serviceBoard')
    assert.equal(invoice.serviceBoardDetails?.customerName, 'Integration customer')
    assert.deepEqual(
      invoice.items.map((item) =>
        typeof item.product === 'string' ? item.product : item.product?.id,
      ),
      productIds,
    )

    const view = await getServiceBoardView(new Date(invoice.issuedAt))
    assert.equal(
      view.columns.reduce((count, column) => count + column.cards.length, 0),
      2,
    )
    assert.equal(view.summary.distinctVisits, 1)
  })
})
