import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { todayDateInput } from '@/lib/calendar'
import { MARKET_PROFILES } from '@/lib/market'
import {
  createMoneyAccount,
  createMoneyPayment,
  createMoneyPerson,
  getInvoiceMoneyAccount,
  getMoneyDashboard,
  updateMoneyAccount,
  updateMoneyPerson,
  voidMoneyPayment,
} from '@/services/money'
import { finalizeInvoice } from '@/services/invoices'
import { createProduct } from '@/services/products'
import { voidReceiptVoucher } from '@/services/receipt-vouchers'
import { getSalesDashboard } from '@/services/sales-reporting'
import { updateShopSettings } from '@/services/settings'

const personIds: string[] = []
const accountIds: string[] = []
const paymentIds: string[] = []
const invoiceIds: string[] = []
const productIds: string[] = []
const voucherIds: string[] = []

describe('money owed management', () => {
  after(async () => {
    const payload = await getPayload({ config })
    for (const id of paymentIds) await payload.delete({ collection: 'money-payments', id })
    for (const id of accountIds) await payload.delete({ collection: 'money-accounts', id })
    for (const id of voucherIds) await payload.delete({ collection: 'receipt-vouchers', id })
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

  it('stores and updates compact person contact details', async () => {
    const person = await createMoneyPerson({
      address: '12 Market Road, Dhaka',
      email: 'customer@example.com',
      name: 'Contact Details Customer',
      note: 'Prefers phone calls',
      phone: '01700000000',
    })
    personIds.push(person.id)
    assert.equal(person.email, 'customer@example.com')
    assert.equal(person.address, '12 Market Road, Dhaka')

    const updated = await updateMoneyPerson(person.id, {
      active: false,
      address: '15 New Market Road, Dhaka',
      email: 'updated@example.com',
      name: person.name,
      note: person.note || undefined,
      phone: person.phone || undefined,
    })
    assert.equal(updated.active, false)
    assert.equal(updated.email, 'updated@example.com')
    assert.equal(updated.address, '15 New Market Road, Dhaka')

    const cleared = await updateMoneyPerson(person.id, { active: false, name: person.name })
    assert.equal(cleared.email, null)
    assert.equal(cleared.address, null)
  })

  it('tracks partial and full payments without changing the original amount', async () => {
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر اختبار',
      sellerNameEnglish: 'Money Test Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
    const person = await createMoneyPerson({ name: 'Customer One', phone: '0500000000' })
    personIds.push(person.id)
    const today = todayDateInput(MARKET_PROFILES.SA)
    const key = randomUUID()
    const account = await createMoneyAccount({
      direction: 'owedToUs',
      idempotencyKey: key,
      kind: 'moneyLent',
      originalAmountMinor: 10_000,
      personId: person.id,
      recordDate: today,
    })
    accountIds.push(account.id)
    assert.equal((await createMoneyAccount({
      direction: 'owedToUs', idempotencyKey: key, kind: 'moneyLent', originalAmountMinor: 10_000,
      personId: person.id, recordDate: today,
    })).id, account.id)

    const partial = await createMoneyPayment({
      accountId: account.id,
      amountMinor: 3_000,
      idempotencyKey: randomUUID(),
      paymentDate: today,
      paymentMethod: 'cash',
    })
    paymentIds.push(partial.id)
    let view = (await getMoneyDashboard('owedToUs')).accounts.find(({ account: item }) => item.id === account.id)!
    assert.equal(view.paidMinor, 3_000)
    assert.equal(view.remainingMinor, 7_000)
    assert.equal(view.derivedStatus, 'open')
    await assert.rejects(
      createMoneyPayment({
        accountId: account.id,
        amountMinor: 7_001,
        idempotencyKey: randomUUID(),
        paymentDate: today,
        paymentMethod: 'cash',
      }),
      /remaining amount/,
    )
    const final = await createMoneyPayment({
      accountId: account.id,
      amountMinor: 7_000,
      createReceiptVoucher: true,
      idempotencyKey: randomUUID(),
      paymentDate: today,
      paymentMethod: 'cash',
    })
    paymentIds.push(final.id)
    const voucherId = typeof final.receiptVoucher === 'string' ? final.receiptVoucher : final.receiptVoucher?.id
    assert.ok(voucherId)
    voucherIds.push(voucherId!)
    const payload = await getPayload({ config })
    assert.equal((await payload.findByID({ collection: 'receipt-vouchers', id: voucherId! })).status, 'issued')
    await assert.rejects(voidReceiptVoucher(voucherId!, 'Wrong'), /linked money payment/)
    view = (await getMoneyDashboard('owedToUs')).accounts.find(({ account: item }) => item.id === account.id)!
    assert.equal(view.remainingMinor, 0)
    assert.equal(view.derivedStatus, 'paid')
    await voidMoneyPayment(final.id, 'Entered incorrectly')
    assert.equal((await payload.findByID({ collection: 'receipt-vouchers', id: voucherId! })).status, 'voided')
    view = (await getMoneyDashboard('owedToUs')).accounts.find(({ account: item }) => item.id === account.id)!
    assert.equal(view.remainingMinor, 7_000)
  })

  it('locks invoice amounts and stores supplier products as references only', async () => {
    const person = await createMoneyPerson({ name: 'Supplier and Customer' })
    personIds.push(person.id)
    const product = await createProduct({
      nameEnglish: 'Reference Product',
      priceIncludesVat: true,
      priceMinor: 11_500,
      unitCostMinor: 2_000,
      vatCategory: 'standard',
    })
    productIds.push(product.id)
    const invoice = await finalizeInvoice({
      idempotencyKey: randomUUID(),
      invoiceType: 'simplified',
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 11_500 }],
    })
    invoiceIds.push(invoice.id)
    const today = todayDateInput(MARKET_PROFILES.SA)
    const linked = await createMoneyAccount({
      direction: 'owedToUs',
      idempotencyKey: randomUUID(),
      invoiceId: invoice.id,
      kind: 'unpaidInvoice',
      originalAmountMinor: 1,
      personId: person.id,
      recordDate: today,
    })
    accountIds.push(linked.id)
    assert.equal(linked.originalAmountMinor, invoice.totalMinor)
    const edited = await updateMoneyAccount(linked.id, {
      kind: 'unpaidInvoice',
      originalAmountMinor: 999_999,
      personId: person.id,
      recordDate: today,
    })
    assert.equal(edited.originalAmountMinor, invoice.totalMinor)
    assert.equal((await getInvoiceMoneyAccount(invoice.id))?.account.id, linked.id)
    await assert.rejects(
      createMoneyAccount({
        direction: 'owedToUs', idempotencyKey: randomUUID(), invoiceId: invoice.id,
        kind: 'unpaidInvoice', personId: person.id, recordDate: today,
      }),
      /already being tracked/,
    )

    const payable = await createMoneyAccount({
      direction: 'weOwe',
      idempotencyKey: randomUUID(),
      kind: 'supplierCredit',
      originalAmountMinor: 25_000,
      personId: person.id,
      products: [{ productId: product.id, quantityMilliunits: 2_500, unitPriceMinor: 3_500 }],
      recordDate: today,
    })
    accountIds.push(payable.id)
    assert.equal(payable.products?.[0].quantityMilliunits, 2_500)
    assert.equal(payable.products?.[0].unitPriceMinor, 3_500)
    assert.equal(payable.originalAmountMinor, 8_750)
    await assert.rejects(
      createMoneyAccount({
        direction: 'weOwe',
        idempotencyKey: randomUUID(),
        kind: 'supplierCredit',
        personId: person.id,
        products: [
          { productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 2_000 },
          { productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 2_000 },
        ],
        recordDate: today,
      }),
      /only once/,
    )
    const unchangedProduct = await (await getPayload({ config })).findByID({ collection: 'products', id: product.id })
    assert.equal(unchangedProduct.unitCostMinor, 2_000)
  })

  it('stores Bangladesh balances and payments in BDT with Dhaka dates', async () => {
    await updateShopSettings({
      businessAddress: 'Dhaka, Bangladesh',
      countryCode: 'BD',
      sellerNameBangla: 'টাকার হিসাব',
      sellerNameEnglish: 'Bangladesh Money Shop',
      secondaryLanguage: 'bn',
    })
    const before = await getSalesDashboard()
    const person = await createMoneyPerson({ name: 'Dhaka Lender' })
    personIds.push(person.id)
    const date = todayDateInput(MARKET_PROFILES.BD)
    const account = await createMoneyAccount({
      direction: 'weOwe',
      idempotencyKey: randomUUID(),
      kind: 'borrowedMoney',
      originalAmountMinor: 50_000,
      personId: person.id,
      recordDate: date,
    })
    accountIds.push(account.id)
    assert.equal(account.countryCode, 'BD')
    assert.equal(account.currencyCode, 'BDT')
    assert.equal(account.timeZone, 'Asia/Dhaka')
    const payment = await createMoneyPayment({
      accountId: account.id,
      amountMinor: 10_000,
      idempotencyKey: randomUUID(),
      paymentDate: date,
      paymentMethod: 'cash',
    })
    paymentIds.push(payment.id)
    assert.equal(payment.currencyCode, 'BDT')
    assert.equal(payment.timeZone, 'Asia/Dhaka')
    const after = await getSalesDashboard()
    assert.equal(after.moneyToPayMinor - before.moneyToPayMinor, 40_000)
    assert.equal(after.moneyPaidMinor - before.moneyPaidMinor, 10_000)
    assert.equal(after.today.totalMinor, before.today.totalMinor)
  })
})
