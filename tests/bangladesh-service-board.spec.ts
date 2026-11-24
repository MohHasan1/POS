import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { createProduct } from '@/services/products'
import { createMoneyPerson, getInvoiceMoneyAccount } from '@/services/money'
import {
  addServiceBoardColumn,
  createServiceBoardSale,
  getServiceBoardView,
} from '@/services/service-board'
import { updateShopSettings } from '@/services/settings'

const productIds: string[] = []
const invoiceIds: string[] = []
const accountIds: string[] = []
const paymentIds: string[] = []
const personIds: string[] = []

describe('Bangladesh Service Board flow', () => {
  after(async () => {
    const payload = await getPayload({ config })
    await payload.updateGlobal({ slug: 'service-board-settings', data: { columns: [] } })
    for (const id of paymentIds) await payload.delete({ collection: 'money-payments', id })
    for (const id of accountIds) await payload.delete({ collection: 'money-accounts', id })
    for (const id of invoiceIds) await payload.delete({ collection: 'invoices', id })
    for (const id of productIds) await payload.delete({ collection: 'products', id })
    for (const id of personIds) await payload.delete({ collection: 'money-people', id })
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر الاختبار',
      sellerNameEnglish: 'Test Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
  })

  it('creates a tax-free BDT sale and returns it on the Dhaka-day board', async () => {
    await updateShopSettings({
      businessAddress: 'Dhaka, Bangladesh',
      countryCode: 'BD',
      sellerNameBangla: 'বাংলাদেশ সার্ভিস শপ',
      sellerNameEnglish: 'Bangladesh Service Shop',
      secondaryLanguage: 'bn',
    })
    const payload = await getPayload({ config })
    await payload.updateGlobal({ slug: 'service-board-settings', data: { columns: [] } })
    const product = await createProduct({
      nameBangla: 'চুল কাটা',
      nameEnglish: 'BD Board Haircut',
      priceIncludesVat: false,
      priceMinor: 5_000,
      sku: `BD-BOARD-${randomUUID().slice(0, 8)}`,
      translations: [{ language: 'bn', name: 'চুল কাটা' }],
      unitCostMinor: 0,
      vatCategory: 'exempt',
    })
    productIds.push(product.id)
    await addServiceBoardColumn(product.id)
    const person = await createMoneyPerson({ name: 'ঢাকা গ্রাহক', phone: '01700000000' })
    personIds.push(person.id)

    const invoice = await createServiceBoardSale({
      customerName: 'ঢাকা গ্রাহক',
      idempotencyKey: randomUUID(),
      items: [{ productId: product.id, quantityMilliunits: 2_000, unitPriceMinor: 5_000 }],
      note: 'বাংলাদেশ বোর্ড পরীক্ষা',
      settlement: {
        accountIdempotencyKey: randomUUID(),
        initialPayment: {
          amountMinor: 2_000,
          idempotencyKey: randomUUID(),
          paymentMethod: 'cash',
        },
        personId: person.id,
      },
    })
    invoiceIds.push(invoice.id)

    assert.equal(invoice.invoiceType, 'sales')
    assert.equal(invoice.salesChannel, 'serviceBoard')
    assert.equal(invoice.countryCode, 'BD')
    assert.equal(invoice.currencyCode, 'BDT')
    assert.equal(invoice.timeZone, 'Asia/Dhaka')
    assert.equal(invoice.taxMode, 'none')
    assert.equal(invoice.vatMinor, 0)
    assert.equal(invoice.totalMinor, 10_000)
    assert.equal(invoice.qrPayload, null)
    assert.equal(invoice.items[0].descriptionBangla, 'চুল কাটা')
    const moneyAccount = await getInvoiceMoneyAccount(invoice.id)
    assert.ok(moneyAccount)
    accountIds.push(moneyAccount.account.id)
    paymentIds.push(...moneyAccount.payments.map(({ id }) => id))
    assert.equal(moneyAccount.paidMinor, 2_000)
    assert.equal(moneyAccount.remainingMinor, 8_000)

    const view = await getServiceBoardView(new Date(invoice.issuedAt))
    assert.equal(view.market.countryCode, 'BD')
    assert.equal(view.market.currencyCode, 'BDT')
    assert.equal(view.market.timeZone, 'Asia/Dhaka')
    assert.equal(view.columns.length, 1)
    assert.equal(view.columns[0].cards.length, 1)
    assert.equal(view.columns[0].cards[0].customerName, 'ঢাকা গ্রাহক')
    assert.equal(view.columns[0].cards[0].paymentStatus, 'partial')
    assert.equal(view.columns[0].cards[0].remainingMinor, 8_000)
    assert.equal(view.columns[0].summary.todayQuantityMilliunits, 2_000)
    assert.equal(view.columns[0].summary.todayRevenueMinor, 10_000)
    assert.equal(view.summary.allSalesTodayMinor, 10_000)
    assert.equal(view.summary.moneyReceivedMinor, 2_000)
    assert.equal(view.summary.moneyToReceiveMinor, 8_000)
  })
})
