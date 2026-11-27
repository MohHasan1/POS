import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { dateInputToISOString } from '@/lib/calendar'
import { MARKET_PROFILES, marketSupports } from '@/lib/market'
import type { ProductSummary } from '@/lib/pos-types'
import { finalizeInvoice } from '@/services/invoices'
import { createMoneyPerson, getMoneyLedgerSummary } from '@/services/money'
import { finalizeInvoiceWithSettlement } from '@/services/sale-settlement'
import { buildSalesDashboard } from '@/services/sales-reporting'
import { buildServiceBoardView } from '@/services/service-board'
import { updateShopSettings } from '@/services/settings'

const invoiceIds: string[] = []
const personIds: string[] = []
const accountIds: string[] = []
const paymentIds: string[] = []
let productId = ''

describe('historical paper sales', () => {
  after(async () => {
    const payload = await getPayload({ config })
    for (const id of paymentIds) await payload.delete({ collection: 'money-payments', id })
    for (const id of accountIds) await payload.delete({ collection: 'money-accounts', id })
    for (const id of invoiceIds) await payload.delete({ collection: 'invoices', id })
    for (const id of personIds) await payload.delete({ collection: 'money-people', id })
    if (productId) await payload.delete({ collection: 'products', id: productId })
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      secondaryLanguage: 'ar',
      sellerNameArabic: 'متجر الاختبار',
      sellerNameEnglish: 'Test Shop',
      vatNumber: '310000000000003',
    })
  })

  it('uses the original date and contributes to reports and Service Board totals', async () => {
    const market = MARKET_PROFILES.BD
    await updateShopSettings({
      businessAddress: 'Dhaka, Bangladesh',
      countryCode: 'BD',
      sellerNameBangla: 'পরীক্ষার দোকান',
      sellerNameEnglish: 'Test Shop',
      secondaryLanguage: 'bn',
    })
    const payload = await getPayload({ config })
    const product = await payload.create({
      collection: 'products',
      data: {
        active: true,
        nameBangla: 'পুরোনো সেবা',
        nameEnglish: 'Historical service',
        priceIncludesVat: false,
        priceMinor: 1_150,
        vatCategory: 'exempt',
      },
    })
    productId = product.id
    const reference = `PAPER-${randomUUID()}`
    const issuedAt = new Date(dateInputToISOString('2026-11-10', market))
    const input = {
      idempotencyKey: randomUUID(),
      invoiceType: 'sales' as const,
      items: [
        {
          productId: product.id,
          quantityMilliunits: 2_000,
          unitPriceMinor: 1_150,
        },
      ],
    }
    const invoice = await finalizeInvoice(input, {
      entrySource: 'paperBackfill',
      externalReference: reference,
      generateQr: false,
      issuedAt,
      issuedAtPrecision: 'dateOnly',
    })
    invoiceIds.push(invoice.id)

    assert.equal(invoice.entrySource, 'paperBackfill')
    assert.equal(invoice.externalReference, reference)
    assert.equal(invoice.issuedAtPrecision, 'dateOnly')
    assert.equal(invoice.issuedAt, issuedAt.toISOString())
    assert.equal(invoice.qrPayload, null)
    assert.equal(invoice.totalMinor, 2_300)

    const dashboard = buildSalesDashboard(
      [invoice],
      new Date('2026-11-15T12:00:00.000Z'),
      market,
      'bn',
    )
    assert.equal(dashboard.month.totalMinor, 2_300)
    assert.equal(dashboard.year.totalMinor, 2_300)
    assert.equal(dashboard.allTime.totalMinor, 2_300)

    const summary: ProductSummary = product
    const board = buildServiceBoardView([summary], [invoice], market, 'bn')
    assert.equal(board.columns[0].cards[0].externalReference, reference)
    assert.equal(board.columns[0].summary.todayRevenueMinor, 2_300)

    await assert.rejects(
      finalizeInvoice(
        { ...input, idempotencyKey: randomUUID() },
        {
          entrySource: 'paperBackfill',
          externalReference: reference,
          generateQr: false,
          issuedAt,
          issuedAtPrecision: 'dateOnly',
        },
      ),
      /already been recorded/,
    )

    const invoiceWithoutReference = await finalizeInvoice(
      { ...input, idempotencyKey: randomUUID() },
      {
        entrySource: 'paperBackfill',
        generateQr: false,
        issuedAt,
        issuedAtPrecision: 'dateOnly',
      },
    )
    invoiceIds.push(invoiceWithoutReference.id)
    assert.equal(invoiceWithoutReference.externalReference, null)
    assert.equal(marketSupports(MARKET_PROFILES.BD, 'historicalSales'), true)
    assert.equal(marketSupports(MARKET_PROFILES.SA, 'historicalSales'), false)

    const customer = await createMoneyPerson({ name: 'Past sale customer' })
    personIds.push(customer.id)
    for (const amount of [0, 600]) {
      const recorded = await finalizeInvoiceWithSettlement(
        { ...input, idempotencyKey: randomUUID() },
        { entrySource: 'paperBackfill', generateQr: false, issuedAt, issuedAtPrecision: 'dateOnly' },
        {
          accountIdempotencyKey: randomUUID(),
          personId: customer.id,
          initialPayment: amount ? { amountMinor: amount, paymentMethod: 'cash', idempotencyKey: randomUUID() } : undefined,
        },
      )
      invoiceIds.push(recorded.invoice.id)
      assert.ok(recorded.account)
      accountIds.push(recorded.account.id)
      if (recorded.initialPayment) paymentIds.push(recorded.initialPayment.id)
      assert.equal(recorded.invoice.totalMinor, 2_300)
      assert.equal(recorded.account.recordDate, issuedAt.toISOString())
      assert.equal(recorded.account.originalAmountMinor, 2_300)
      assert.equal(recorded.initialPayment?.paymentDate, amount ? issuedAt.toISOString() : undefined)
    }
    const nextDay = dateInputToISOString('2026-11-11', market)
    const [pastDay, followingDay] = await Promise.all([
      getMoneyLedgerSummary('owedToUs', { start: issuedAt.toISOString(), end: nextDay }),
      getMoneyLedgerSummary('owedToUs', { start: nextDay, end: dateInputToISOString('2026-11-12', market) }),
    ])
    assert.equal(pastDay.paidMinor, 600)
    assert.equal(pastDay.invoiceRemainingMinor, 4_000)
    assert.equal(followingDay.paidMinor, 0)
  })
})
