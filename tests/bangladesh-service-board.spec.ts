import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { getPeriodBounds, todayDateInput } from '@/lib/calendar'
import { MARKET_PROFILES } from '@/lib/market'
import { formatMoney } from '@/lib/money'
import { getBusinessReport } from '@/services/business-reporting'
import { closeCashDay, getCashClosingForReport } from '@/services/cash-closing'
import { getCashReport, startCashTracking } from '@/services/cash-report'
import { createExpenseCategory, createVariableExpense } from '@/services/expenses'
import { createMoneyAccount, createMoneyPayment, createMoneyPerson, getInvoiceMoneyAccount, getMoneyDashboard } from '@/services/money'
import { createProduct } from '@/services/products'
import { finalizeInvoiceWithSettlement } from '@/services/sale-settlement'
import { getSalesDashboard } from '@/services/sales-reporting'
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
const expenseIds: string[] = []
const categoryIds: string[] = []

describe('Bangladesh Service Board flow', () => {
  after(async () => {
    const payload = await getPayload({ config })
    await payload.updateGlobal({ slug: 'service-board-settings', data: { columns: [] } })
    await payload.delete({ collection: 'cash-closings', where: { countryCode: { equals: 'BD' } } })
    await payload.delete({ collection: 'cash-ledger', where: { countryCode: { equals: 'BD' } } })
    for (const id of expenseIds) await payload.delete({ collection: 'expenses', id })
    for (const id of categoryIds) await payload.delete({ collection: 'expense-categories', id })
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

    const paidSale = await createServiceBoardSale({
      idempotencyKey: randomUUID(),
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 5_000 }],
    })
    invoiceIds.push(paidSale.id)
    const recordDate = todayDateInput(MARKET_PROFILES.BD)
    const loan = await createMoneyAccount({
      direction: 'owedToUs',
      idempotencyKey: randomUUID(),
      kind: 'moneyLent',
      originalAmountMinor: 3_000,
      personId: person.id,
      recordDate,
    })
    accountIds.push(loan.id)
    const collection = await createMoneyPayment({
      accountId: loan.id,
      amountMinor: 1_000,
      idempotencyKey: randomUUID(),
      paymentDate: recordDate,
      paymentMethod: 'cash',
    })
    paymentIds.push(collection.id)

    const [updatedBoard, dashboard, report, ledger] = await Promise.all([
      getServiceBoardView(),
      getSalesDashboard(),
      getBusinessReport({ period: 'today' }),
      getMoneyDashboard('owedToUs'),
    ])
    assert.equal(updatedBoard.summary.allSalesTodayMinor, 15_000)
    assert.equal(dashboard.today.totalMinor, 15_000)
    assert.equal(report.summary.grossSalesMinor, 15_000)
    assert.equal(ledger.summary.paidMinor, 3_000)
    assert.equal(updatedBoard.summary.moneyReceivedMinor, ledger.summary.paidMinor)
    assert.equal(dashboard.moneyReceivedMinor, ledger.summary.paidMinor)
    assert.equal(report.summary.moneyReceivedMinor, ledger.summary.paidMinor)
    assert.equal(updatedBoard.summary.moneyToReceiveMinor, 8_000)
    assert.equal(dashboard.moneyToReceiveMinor, 8_000)
    assert.equal(report.summary.owedToUsMinor, 10_000)
  })

  it('matches the opening, drawer count, and owner pickup from the Notion example in BDT', async () => {
    const market = MARKET_PROFILES.BD
    const today = todayDateInput(market)
    const { nextDayStart } = getPeriodBounds(market)
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'cash-ledger', where: { countryCode: { equals: 'BD' } } })
    await startCashTracking({ basis: 'startOfDay', cashMinor: 3_500, bankMinor: 0 })

    const product = await createProduct({ nameEnglish: 'Closing test sale', priceMinor: 1_000, priceIncludesVat: false, vatCategory: 'exempt' })
    productIds.push(product.id)
    for (const [cashAccount, unitPriceMinor] of [['cash', 142_000], ['bank', 26_000]] as const) {
      const { invoice } = await finalizeInvoiceWithSettlement({
        items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor }],
        idempotencyKey: randomUUID(), invoiceType: 'sales',
      }, { cashAccount })
      invoiceIds.push(invoice.id)
    }
    const category = await createExpenseCategory('Closing test expenses')
    categoryIds.push(category.id)
    const expense = await createVariableExpense({
      idempotencyKey: randomUUID(), categoryId: category.id, name: 'Morning supplies', billDate: today,
      totalMinor: 33_000, vatMinor: 0, paymentStatus: 'paid', paymentMethod: 'cash', paidAt: today,
    })
    expenseIds.push(expense.id)

    assert.deepEqual(await closeCashDay({
      requestId: randomUUID(), businessDate: today, expectedCashMinor: 112_500,
      actualCashMinor: 112_500, ownerPickupMinor: 112_500, nextDayCashMinor: 0, note: '',
    }), { status: 'saved' })
    const closing = (await getCashClosingForReport({ period: 'yesterday' }, market, nextDayStart))?.closing
    assert(closing)
    assert.equal(closing.currencyCode, 'BDT')
    assert.equal(closing.timeZone, 'Asia/Dhaka')
    assert.equal(formatMoney(closing.actualCashMinor, market, 'en-BD'), '৳1,125.00')
    assert.equal(closing.actualCashMinor - closing.expectedCashMinor, 0)
    assert.equal(closing.actualCashMinor - closing.ownerPickupMinor, 0)

    const report = await getCashReport({ period: 'yesterday' }, market, 1, nextDayStart)
    assert.deepEqual(report.balances?.closing, { cashMinor: 0, bankMinor: 26_000 })
    assert.deepEqual(report.activity.breakdown.expensesPaid, { cashMinor: -33_000, bankMinor: 0 })
    assert.equal((await getBusinessReport({ period: 'today' })).summary.grossSalesMinor, 183_000)
    assert.deepEqual(report.activity.breakdown.adjustments, { cashMinor: 0, bankMinor: 0 })
    assert.deepEqual(report.activity.breakdown.ownerPickup, { cashMinor: -112_500, bankMinor: 0 })
    const nextDay = await getCashReport({ period: 'today' }, market, 1, nextDayStart)
    assert.deepEqual(nextDay.balances?.carried, { cashMinor: 0, bankMinor: 0 })
  })
})
