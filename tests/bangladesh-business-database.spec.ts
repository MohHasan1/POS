import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { createEmployee } from '@/services/employees'
import { createVariableExpense, createExpenseCategory } from '@/services/expenses'
import { finalizeInvoice } from '@/services/invoices'
import { saveCompensationPlan } from '@/services/payroll'
import { createProduct } from '@/services/products'
import { getBusinessReport } from '@/services/business-reporting'
import { updateShopSettings } from '@/services/settings'

const expenseIds: string[] = []
const categoryIds: string[] = []
const invoiceIds: string[] = []
const rateIds: string[] = []
const productIds: string[] = []
const employeeIds: string[] = []

describe('Bangladesh business database flow', () => {
  after(async () => {
    const payload = await getPayload({ config })
    for (const id of expenseIds) await payload.delete({ collection: 'expenses', id })
    for (const id of invoiceIds) await payload.delete({ collection: 'invoices', id })
    for (const id of rateIds) await payload.delete({ collection: 'employee-commission-rates', id })
    for (const id of productIds) await payload.delete({ collection: 'products', id })
    for (const id of employeeIds) await payload.delete({ collection: 'employees', id })
    for (const id of categoryIds) await payload.delete({ collection: 'expense-categories', id })

    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر الاختبار',
      sellerNameEnglish: 'Test Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
  })

  it('persists a tax-free BDT sale and expense and calculates Dhaka-day profit', async () => {
    await updateShopSettings({
      businessAddress: 'Dhaka, Bangladesh',
      countryCode: 'BD',
      sellerNameBangla: 'বাংলাদেশ ব্যবসা',
      sellerNameEnglish: 'Bangladesh Business',
      secondaryLanguage: 'bn',
    })

    const employee = await createEmployee({
      employeeCode: `EMP-BD-${randomUUID().slice(0, 8)}`,
      name: 'BD Commission Worker',
    })
    employeeIds.push(employee.id)
    const product = await createProduct({
      nameBangla: 'ফেসিয়াল',
      nameEnglish: 'BD Costed Facial',
      priceIncludesVat: false,
      priceMinor: 10_000,
      translations: [{ language: 'bn', name: 'ফেসিয়াল' }],
      unitCostMinor: 4_000,
      vatCategory: 'exempt',
    })
    productIds.push(product.id)
    await saveCompensationPlan(employee.id, 'commission', null, [
      { productId: product.id, rateBps: 2_500 },
    ])
    const payload = await getPayload({ config })
    const rates = await payload.find({
      collection: 'employee-commission-rates',
      pagination: false,
      where: { employee: { equals: employee.id } },
    })
    rateIds.push(...rates.docs.map(({ id }) => id))

    const invoice = await finalizeInvoice(
      {
        employeeId: employee.id,
        idempotencyKey: randomUUID(),
        invoiceType: 'sales',
        items: [
          {
            productId: product.id,
            quantityMilliunits: 1_500,
            unitPriceMinor: 10_000,
          },
        ],
      },
      {
        entrySource: 'paperBackfill',
        externalReference: `BD-PAPER-${randomUUID()}`,
        issuedAt: new Date('2025-04-15T06:00:00.000Z'),
        issuedAtPrecision: 'dateOnly',
      },
    )
    invoiceIds.push(invoice.id)

    const category = await createExpenseCategory(`BD Rent ${randomUUID()}`)
    categoryIds.push(category.id)
    const expense = await createVariableExpense({
      billDate: '2025-04-15',
      categoryId: category.id,
      idempotencyKey: randomUUID(),
      name: 'Dhaka shop rent',
      paidAt: '2025-04-15',
      paymentMethod: 'bank',
      paymentStatus: 'paid',
      totalMinor: 2_000,
      vatMinor: 500,
    })
    expenseIds.push(expense.id)

    assert.equal(invoice.countryCode, 'BD')
    assert.equal(invoice.currencyCode, 'BDT')
    assert.equal(invoice.timeZone, 'Asia/Dhaka')
    assert.equal(invoice.vatMinor, 0)
    assert.deepEqual(invoice.items[0].cost, {
      totalCostMinor: 6_000,
      unitCostMinor: 4_000,
    })
    assert.deepEqual(invoice.items[0].commission, {
      amountMinor: 3_750,
      basisMinor: 15_000,
      rateBps: 2_500,
    })
    assert.equal(expense.countryCode, 'BD')
    assert.equal(expense.currencyCode, 'BDT')
    assert.equal(expense.timeZone, 'Asia/Dhaka')
    assert.equal(expense.vatMinor, 0)
    assert.equal(expense.netMinor, 2_000)

    const report = await getBusinessReport(
      {
        employeeId: employee.id,
        endDate: '2025-04-15',
        period: 'custom',
        startDate: '2025-04-15',
      },
      'bn',
    )

    assert.equal(report.market.countryCode, 'BD')
    assert.equal(report.market.currencyCode, 'BDT')
    assert.equal(report.market.timeZone, 'Asia/Dhaka')
    assert.equal(report.summary.grossSalesMinor, 15_000)
    assert.equal(report.summary.netSalesMinor, 15_000)
    assert.equal(report.summary.vatMinor, 0)
    assert.equal(report.summary.directCostMinor, 6_000)
    assert.equal(report.summary.commissionEarnedMinor, 3_750)
    assert.equal(report.summary.expenseMinor, 2_000)
    assert.equal(report.summary.operatingProfitMinor, 3_250)
    assert.equal(report.summary.billPaidMinor, 2_000)
    assert.equal(report.warnings.costCoverageBps, 10_000)
    assert.equal(report.productMetrics[0].contributionMinor, 5_250)
    assert.equal(report.employeeMetrics[0].contributionMinor, 5_250)
    assert.equal(
      report.trend.reduce((total, point) => total + point.operatingProfitMinor, 0),
      3_250,
    )
  })
})
