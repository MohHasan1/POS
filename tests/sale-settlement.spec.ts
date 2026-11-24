import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { getPeriodBounds, todayDateInput } from '@/lib/calendar'
import { MARKET_PROFILES } from '@/lib/market'
import { buildBusinessReport } from '@/services/business-reporting'
import { finalizeInvoiceWithSettlement } from '@/services/sale-settlement'
import {
  calculateInvoiceCashMetrics,
  createMoneyPayment,
  createMoneyPerson,
  getInvoicePaymentSummaries,
} from '@/services/money'
import { createProduct } from '@/services/products'
import { updateShopSettings } from '@/services/settings'

const personIds: string[] = []
const productIds: string[] = []
const invoiceIds: string[] = []
const accountIds: string[] = []
const paymentIds: string[] = []

describe('invoice settlement tracking', () => {
  after(async () => {
    const payload = await getPayload({ config })
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

  it('atomically tracks a partial Checkout payment without moving sales or profit', async () => {
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر التسوية',
      sellerNameEnglish: 'Settlement Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
    const person = await createMoneyPerson({ name: 'Credit Customer', phone: '0500000000' })
    personIds.push(person.id)
    const product = await createProduct({
      nameEnglish: 'Settlement Service',
      priceIncludesVat: true,
      priceMinor: 11_500,
      unitCostMinor: 2_000,
      vatCategory: 'standard',
    })
    productIds.push(product.id)
    const invoiceKey = randomUUID()
    const accountKey = randomUUID()
    const initialPaymentKey = randomUUID()
    const input = {
      idempotencyKey: invoiceKey,
      invoiceType: 'simplified' as const,
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 11_500 }],
    }
    const settlement = {
      accountIdempotencyKey: accountKey,
      initialPayment: {
        amountMinor: 2_500,
        idempotencyKey: initialPaymentKey,
        paymentMethod: 'cash' as const,
      },
      personId: person.id,
    }
    const created = await finalizeInvoiceWithSettlement(input, {}, settlement)
    invoiceIds.push(created.invoice.id)
    accountIds.push(created.account!.id)
    paymentIds.push(created.initialPayment!.id)
    assert.equal(created.invoice.totalMinor, 11_500)
    assert.equal(created.account?.originalAmountMinor, 11_500)
    assert.equal(created.initialPayment?.amountMinor, 2_500)

    const summary = (await getInvoicePaymentSummaries([created.invoice])).get(created.invoice.id)!
    assert.deepEqual(summary, {
      paidMinor: 2_500,
      personName: 'Credit Customer',
      remainingMinor: 9_000,
      status: 'partial',
    })

    const retried = await finalizeInvoiceWithSettlement(input, {}, settlement)
    assert.equal(retried.invoice.id, created.invoice.id)
    assert.equal(retried.account?.id, created.account?.id)
    assert.equal(retried.initialPayment?.id, created.initialPayment?.id)

    const payload = await getPayload({ config })
    assert.equal((await payload.find({ collection: 'invoices', where: { idempotencyKey: { equals: invoiceKey } } })).totalDocs, 1)
    assert.equal((await payload.find({ collection: 'money-accounts', where: { idempotencyKey: { equals: accountKey } } })).totalDocs, 1)
    assert.equal((await payload.find({ collection: 'money-payments', where: { idempotencyKey: { equals: initialPaymentKey } } })).totalDocs, 1)

    const report = buildBusinessReport({
      commissionOverrides: [],
      costOverrides: [],
      employees: [],
      expenses: [],
      invoices: [created.invoice],
      moneyAccounts: [created.account!],
      moneyPayments: [created.initialPayment!],
      payrollEntries: [],
      products: [product],
    }, { period: 'all' }, MARKET_PROFILES.SA, 'ar', new Date(created.invoice.issuedAt))
    assert.equal(report.summary.grossSalesMinor, 11_500)
    assert.equal(report.summary.owedToUsMinor, 9_000)
    assert.equal(report.summary.grossProfitMinor, 8_000)

    const bounds = getPeriodBounds(MARKET_PROFILES.SA, new Date(created.invoice.issuedAt))
    const cashBeforeFinal = calculateInvoiceCashMetrics(
      [created.invoice],
      [created.account!],
      [created.initialPayment!],
      bounds.todayStart,
      bounds.nextDayStart,
    )
    assert.deepEqual(cashBeforeFinal, { moneyReceivedMinor: 2_500, moneyToReceiveMinor: 9_000 })

    const finalPayment = await createMoneyPayment({
      accountId: created.account!.id,
      amountMinor: 9_000,
      idempotencyKey: randomUUID(),
      paymentDate: todayDateInput(MARKET_PROFILES.SA),
      paymentMethod: 'cash',
    })
    paymentIds.push(finalPayment.id)
    const paidSummary = (await getInvoicePaymentSummaries([created.invoice])).get(created.invoice.id)!
    assert.equal(paidSummary.status, 'paid')
    assert.equal(paidSummary.remainingMinor, 0)
  })

  it('rolls back the invoice when its required person is inactive', async () => {
    const payload = await getPayload({ config })
    const person = await createMoneyPerson({ name: 'Inactive Credit Customer' })
    personIds.push(person.id)
    await payload.update({ collection: 'money-people', id: person.id, data: { active: false } })
    const product = await createProduct({
      nameEnglish: 'Rollback Service',
      priceIncludesVat: true,
      priceMinor: 1_150,
      vatCategory: 'standard',
    })
    productIds.push(product.id)
    const invoiceKey = randomUUID()
    await assert.rejects(
      finalizeInvoiceWithSettlement(
        {
          idempotencyKey: invoiceKey,
          invoiceType: 'simplified',
          items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 1_150 }],
        },
        {},
        { accountIdempotencyKey: randomUUID(), personId: person.id },
      ),
      /active person/,
    )
    assert.equal((await payload.find({ collection: 'invoices', where: { idempotencyKey: { equals: invoiceKey } } })).totalDocs, 0)
  })
})
