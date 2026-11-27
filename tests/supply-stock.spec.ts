import config from '@payload-config'
import { sql, type MigrateUpArgs } from '@payloadcms/db-sqlite'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { dateInputToISOString } from '@/lib/calendar'
import { MARKET_PROFILES } from '@/lib/market'
import { paginateSupplies, supplyPageHref, supplyPageNumber } from '@/lib/supply-stock'
import { createExpenseCategory } from '@/services/expenses'
import { updateShopSettings } from '@/services/settings'
import {
  addSupplyPurchase,
  getAvailableSupplyPurchases,
  getSupplyCatalog,
  getSupplyPurchaseHistory,
  saveSupply,
  startSupplyUsage,
  updateSupplyUsage,
} from '@/services/supplies'

const today = '2026-11-27'
const now = new Date('2026-11-27T06:00:00Z')
const BD = MARKET_PROFILES.BD
const SA = MARKET_PROFILES.SA

describe('supply stock', () => {
  const supplies: string[] = []
  const expenses: string[] = []
  const categories: string[] = []

  async function newSupply(name: string) {
    const supply = await saveSupply({ name, expectedLifespanDays: 10, defaultUnitCostMinor: 9_999 })
    supplies.push(supply.id)
    return supply.id
  }

  async function configure(country: 'BD' | 'SA') {
    await updateShopSettings({
      businessAddress: country === 'BD' ? 'Dhaka, Bangladesh' : 'Riyadh, Saudi Arabia',
      countryCode: country,
      sellerNameEnglish: 'Supply stock test',
      sellerNameArabic: 'متجر الاختبار',
      vatNumber: '310000000000003',
    })
  }

  after(async () => {
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'supply-usages', where: { supply: { in: supplies } } })
    await payload.delete({ collection: 'supply-purchases', where: { supply: { in: supplies } } })
    for (const id of expenses) await payload.delete({ collection: 'expenses', id })
    for (const id of categories) await payload.delete({ collection: 'expense-categories', id })
    for (const id of supplies) await payload.delete({ collection: 'supplies', id })
    await configure('SA')
  })

  it('counts unopened units, consumes one per usage, and preserves the lot and cost', async () => {
    const supplyId = await newSupply('Stock cream')
    const otherSupply = await newSupply('Other stock')
    const id = randomUUID()
    const purchase = await addSupplyPurchase(supplyId, id, {
      name: 'Blue cream', purchasedOn: '2026-11-25', quantity: 2, unitCostMinor: 1_000, vendor: 'Blue Vendor',
    }, BD, now)
    assert.equal(purchase.remainingQuantity, 2)
    assert.equal(purchase.expense, null)
    const options = { label: null, startedOn: today, purchaseId: id, unitCostMinor: 500 }
    await assert.rejects(startSupplyUsage(otherSupply, randomUUID(), options, BD, now), { message: 'stockUnavailable' })
    await assert.rejects(startSupplyUsage(supplyId, randomUUID(), { ...options, startedOn: '2026-11-24' }, BD, now), { message: 'openedBeforePurchase' })

    const openId = randomUUID()
    const opened = await startSupplyUsage(supplyId, openId, options, BD, now)
    const retried = await startSupplyUsage(supplyId, openId, options, BD, now)
    assert.equal(opened.id, retried.id)
    assert.equal(opened.purchase, id)
    assert.equal(opened.label, 'Blue cream')
    assert.equal(opened.vendor, 'Blue Vendor')
    assert.equal(opened.unitCostMinor, 1_000)
    assert.equal(opened.costCurrencyCode, 'BDT')
    assert.equal((await getAvailableSupplyPurchases(supplyId))[0].remainingQuantity, 1)
    assert.deepEqual((await getSupplyCatalog(today)).currentStock.find((row) => row.id === supplyId), {
      id: supplyId, name: 'Stock cream', inUse: 1, unopened: 1,
    })

    const competingStarts = await Promise.allSettled([randomUUID(), randomUUID()].map((key) =>
      startSupplyUsage(supplyId, key, options, BD, now),
    ))
    assert.equal(competingStarts.filter(({ status }) => status === 'fulfilled').length, 1)
    const failed = competingStarts.find((result) => result.status === 'rejected')
    assert.equal(failed?.reason.message, 'stockUnavailable')

    await updateSupplyUsage(supplyId, openId, { operation: 'finish', finishedOn: today }, BD, now)
    assert.equal((await getAvailableSupplyPurchases(supplyId)).length, 0)
    assert.equal((await getSupplyPurchaseHistory(supplyId, false, 1)).records.length, 0)
    assert.equal((await getSupplyPurchaseHistory(supplyId, true, 1)).records[0].remainingQuantity, 0)
    const manual = await startSupplyUsage(supplyId, randomUUID(), { label: 'Manual', startedOn: today }, BD, now)
    assert.equal(manual.purchase, null)
    assert.equal(manual.unitCostMinor, 9_999)
  })

  it('saves paid and unpaid expenses with the purchase price, date, currency and VAT', async () => {
    const payload = await getPayload({ config })
    const supplyId = await newSupply('Purchased stock')
    const category = await createExpenseCategory('Stock fixture category')
    categories.push(category.id)
    const input = {
      name: 'Cost fixture', purchasedOn: '2026-11-26', quantity: 3, unitCostMinor: 2_400,
      vendor: 'Expense Vendor', expense: { categoryId: category.id, paymentStatus: 'paid' as const, paymentMethod: 'bank' as const, vatMinor: 200 },
    }

    await configure('BD')
    const key = randomUUID()
    const purchase = await addSupplyPurchase(supplyId, key, input, BD, now)
    assert.equal(typeof purchase.expense, 'string')
    const expenseId = purchase.expense as string
    expenses.push(expenseId)
    const bdExpense = await payload.findByID({ collection: 'expenses', id: expenseId })
    assert.equal((await addSupplyPurchase(supplyId, key, input, BD, now)).expense, expenseId)
    assert.equal((await payload.count({ collection: 'expenses', where: { name: { equals: input.name } } })).totalDocs, 1)
    assert.equal(bdExpense.recordType, 'variable')
    assert.equal(bdExpense.totalMinor, 7_200)
    assert.equal(bdExpense.vatMinor, 0)
    assert.equal(bdExpense.billDate, dateInputToISOString(input.purchasedOn, BD))
    assert.equal(bdExpense.paidAt, bdExpense.billDate)
    assert.equal(bdExpense.paymentMethod, 'bank')
    assert.equal(bdExpense.vendor, input.vendor)

    await configure('SA')
    const saPurchase = await addSupplyPurchase(supplyId, randomUUID(), {
      ...input, expense: { categoryId: category.id, paymentStatus: 'unpaid', vatMinor: 200 },
    }, SA, now)
    const saExpenseId = saPurchase.expense as string
    expenses.push(saExpenseId)
    const saExpense = await payload.findByID({ collection: 'expenses', id: saExpenseId })
    assert.equal(saExpense.currencyCode, 'SAR')
    assert.equal(saExpense.vatMinor, 200)
    assert.equal(saExpense.netMinor, 7_000)
    assert.equal(saExpense.paymentStatus, 'unpaid')
    assert.equal(saExpense.paidAt, null)
  })

  it('rolls back an optional expense when the purchase fails to save', async () => {
    await configure('BD')
    const payload = await getPayload({ config })
    const db = (payload.db as unknown as { drizzle: MigrateUpArgs['db'] }).drizzle
    const supplyId = await newSupply('Rollback stock')
    const category = await createExpenseCategory('Rollback stock category')
    categories.push(category.id)
    const name = 'Rejected purchase fixture'
    const id = randomUUID()
    await db.run(sql`CREATE TRIGGER reject_test_supply_purchase BEFORE INSERT ON supply_purchases
      WHEN NEW.name = 'Rejected purchase fixture' BEGIN SELECT RAISE(ABORT, 'test purchase failure'); END;`)
    try {
      await assert.rejects(addSupplyPurchase(supplyId, id, {
        name, purchasedOn: today, quantity: 1, unitCostMinor: 200,
        expense: { categoryId: category.id, paymentStatus: 'paid', vatMinor: 0 },
      }, BD, now))
      assert.equal((await payload.count({ collection: 'expenses', where: { name: { equals: name } } })).totalDocs, 0)
      assert.equal((await getSupplyPurchaseHistory(supplyId, true, 1)).records.length, 0)
    } finally {
      await db.run(sql`DROP TRIGGER reject_test_supply_purchase;`)
    }
  })

  it('paginates purchase history independently from stock search and catalog counts', async () => {
    const supplyId = await newSupply('Paged purchases')
    const payload = await getPayload({ config })
    for (let index = 0; index < 21; index += 1) {
      await payload.create({ collection: 'supply-purchases', data: {
        id: randomUUID(), supply: supplyId, name: `Stock ${index}`, purchasedOn: today, quantity: 1, remainingQuantity: 1,
      } })
    }
    const first = await getSupplyPurchaseHistory(supplyId, true, 1)
    const last = await getSupplyPurchaseHistory(supplyId, true, 99)
    assert.equal(first.records.length, 20)
    assert.equal(last.records.length, 1)
    assert.equal(last.page, 2)
    assert.equal((await getAvailableSupplyPurchases(supplyId)).length, 21)
    assert.equal((await getSupplyCatalog(today)).currentStock.find(({ id }) => id === supplyId)?.unopened, 21)
    assert.deepEqual(paginateSupplies([1, 2, 3], supplyPageNumber('99'), 2), { records: [3], page: 2, totalPages: 2 })
    assert.equal(supplyPageHref('/supplies', { q: 'blue cream', page: '2', status: 'archived' }), '/supplies?q=blue+cream&page=2&status=archived')
  })
})
