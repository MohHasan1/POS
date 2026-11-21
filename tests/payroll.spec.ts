import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { todayDateInput } from '@/lib/calendar'
import { MARKET_PROFILES } from '@/lib/market'
import { createEmployee } from '@/services/employees'
import { finalizeInvoice } from '@/services/invoices'
import {
  createMonthlySalary,
  createPayrollPayout,
  getPayrollDashboard,
  saveCompensationPlan,
  updatePayrollEntry,
  upsertCommissionOverride,
} from '@/services/payroll'
import { createProduct } from '@/services/products'
import { updateShopSettings } from '@/services/settings'

const employeeIds: string[] = []
const productIds: string[] = []
const invoiceIds: string[] = []
const entryIds: string[] = []
const overrideIds: string[] = []
const rateIds: string[] = []

describe('employee payroll and commission', () => {
  after(async () => {
    const payload = await getPayload({ config })
    for (const id of overrideIds)
      await payload.delete({ collection: 'employee-commission-overrides', id })
    for (const id of entryIds) await payload.delete({ collection: 'employee-payroll-entries', id })
    for (const id of invoiceIds) await payload.delete({ collection: 'invoices', id })
    for (const id of rateIds) await payload.delete({ collection: 'employee-commission-rates', id })
    for (const id of productIds) await payload.delete({ collection: 'products', id })
    for (const id of employeeIds) await payload.delete({ collection: 'employees', id })
  })

  it('snapshots VAT-exclusive service commission and supports an editable override', async () => {
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر الرواتب',
      sellerNameEnglish: 'Payroll Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
    const employee = await createEmployee({
      employeeCode: `EMP-${randomUUID().slice(0, 8)}`,
      name: 'Commission Stylist',
    })
    employeeIds.push(employee.id)
    const product = await createProduct({
      nameArabic: 'قص شعر',
      nameEnglish: 'Commission Haircut',
      priceIncludesVat: true,
      priceMinor: 11_500,
      translations: [{ language: 'ar', name: 'قص شعر' }],
      unitCostMinor: 2_000,
      vatCategory: 'standard',
    })
    productIds.push(product.id)
    await saveCompensationPlan(employee.id, 'commission', null, [
      { productId: product.id, rateBps: 6_000 },
    ])
    const payload = await getPayload({ config })
    const rates = await payload.find({
      collection: 'employee-commission-rates',
      pagination: false,
      where: { employee: { equals: employee.id } },
    })
    rateIds.push(...rates.docs.map(({ id }) => id))

    const input = {
      employeeId: employee.id,
      idempotencyKey: randomUUID(),
      invoiceType: 'simplified' as const,
      items: [
        {
          productId: product.id,
          quantityMilliunits: 1_000,
          unitPriceMinor: 11_500,
        },
      ],
    }
    const invoice = await finalizeInvoice(input)
    invoiceIds.push(invoice.id)
    assert.deepEqual(invoice.items[0].commission, {
      amountMinor: 6_000,
      basisMinor: 10_000,
      rateBps: 6_000,
    })
    assert.equal((await finalizeInvoice(input)).items[0].commission?.amountMinor, 6_000)

    await saveCompensationPlan(employee.id, 'commission', null, [
      { productId: product.id, rateBps: 3_000 },
    ])
    assert.equal(invoice.items[0].commission?.rateBps, 6_000)

    const override = await upsertCommissionOverride({
      correctedAmountMinor: 5_500,
      invoiceId: invoice.id,
      invoiceItemId: invoice.items[0].id!,
      note: 'Corrected by manager',
    })
    overrideIds.push(override.id)
    const updatedOverride = await upsertCommissionOverride({
      correctedAmountMinor: 5_000,
      invoiceId: invoice.id,
      invoiceItemId: invoice.items[0].id!,
    })
    assert.equal(updatedOverride.id, override.id)

    const commissionPayout = await createPayrollPayout({
      amountMinor: 2_000,
      employeeId: employee.id,
      entryDate: todayDateInput(MARKET_PROFILES.SA),
      idempotencyKey: randomUUID(),
      paymentMethod: 'cash',
    })
    entryIds.push(commissionPayout.id)

    const dashboard = await getPayrollDashboard({ employeeId: employee.id, mode: 'all' })
    assert.equal(dashboard.metrics.commissionEarnedMinor, 5_000)
    assert.equal(dashboard.metrics.paidMinor, 2_000)
    assert.equal(dashboard.metrics.currentBalanceMinor, 3_000)
    assert.equal(dashboard.employeeSummaries[0].salesGeneratedMinor, 10_000)
    assert.equal(dashboard.employeeSummaries[0].directCostMinor, 2_000)
    assert.equal(dashboard.employeeSummaries[0].businessResultMinor, 3_000)
    assert.equal(dashboard.metrics.businessResultMinor, 3_000)
    assert.equal(
      dashboard.activities.find(({ kind }) => kind === 'commission')?.correctedAmountMinor,
      5_000,
    )
  })

  it('accumulates multiple payouts toward a monthly salary and allows advances', async () => {
    const date = todayDateInput(MARKET_PROFILES.SA)
    const monthly = await createEmployee({
      employeeCode: `EMP-${randomUUID().slice(0, 8)}`,
      name: 'Monthly Worker',
    })
    employeeIds.push(monthly.id)
    await saveCompensationPlan(monthly.id, 'monthly', 50_000, [])

    const salaryMonth = date.slice(0, 7)
    const monthlyResult = await createMonthlySalary({
      amountMinor: 50_000,
      employeeId: monthly.id,
      idempotencyKey: randomUUID(),
      salaryMonth,
      payout: {
        amountMinor: 20_000,
        entryDate: date,
        idempotencyKey: randomUUID(),
        paymentMethod: 'bank',
        reference: 'PAY-001',
      },
    })
    entryIds.push(monthlyResult.salary.id, monthlyResult.payout!.id)
    const editedSalary = await updatePayrollEntry(monthlyResult.salary.id, {
      amountMinor: 55_000,
      employeeId: monthly.id,
      entryDate: date,
      salaryMonth,
    })
    assert.equal(editedSalary.amountMinor, 55_000)
    const advance = await createPayrollPayout({
      amountMinor: 60_000,
      employeeId: monthly.id,
      entryDate: date,
      idempotencyKey: randomUUID(),
      paymentMethod: 'cash',
    })
    entryIds.push(advance.id)

    const monthlyDashboard = await getPayrollDashboard({ employeeId: monthly.id, mode: 'all' })
    assert.equal(monthlyDashboard.metrics.fixedEarnedMinor, 55_000)
    assert.equal(monthlyDashboard.metrics.paidMinor, 80_000)
    assert.equal(monthlyDashboard.metrics.currentBalanceMinor, -25_000)
    assert.equal(monthlyDashboard.metrics.businessResultMinor, -55_000)

    const selectedDay = await getPayrollDashboard({
      employeeId: monthly.id,
      mode: 'day',
      value: date,
    })
    assert.equal(selectedDay.employeeSummaries[0].totalEarnedMinor, 55_000)
    assert.equal(selectedDay.employeeSummaries[0].paidMinor, 80_000)
    assert.equal(selectedDay.employeeSummaries[0].currentBalanceMinor, -25_000)
    assert.equal(selectedDay.employeeSummaries[0].businessResultMinor, -55_000)

    const priorDate = new Date(`${date}T00:00:00Z`)
    priorDate.setUTCDate(priorDate.getUTCDate() - 1)
    const priorDay = await getPayrollDashboard({
      employeeId: monthly.id,
      mode: 'day',
      value: priorDate.toISOString().slice(0, 10),
    })
    assert.equal(priorDay.employeeSummaries[0].totalEarnedMinor, 0)
    assert.equal(priorDay.employeeSummaries[0].paidMinor, 0)
    assert.equal(priorDay.employeeSummaries[0].currentBalanceMinor, -25_000)
    assert.equal(priorDay.employeeSummaries[0].businessResultMinor, 0)

    const selectedMonth = await getPayrollDashboard({
      employeeId: monthly.id,
      mode: 'month',
      value: salaryMonth,
    })
    assert.equal(selectedMonth.salaryActionMonth, salaryMonth)
    assert.equal(selectedMonth.employeeSummaries[0].salaryConfirmedForActionMonth, true)

    const priorMonthDate = new Date(`${salaryMonth}-01T00:00:00Z`)
    priorMonthDate.setUTCMonth(priorMonthDate.getUTCMonth() - 1)
    const priorMonth = priorMonthDate.toISOString().slice(0, 7)
    const previousMonthDashboard = await getPayrollDashboard({
      employeeId: monthly.id,
      mode: 'month',
      value: priorMonth,
    })
    assert.equal(previousMonthDashboard.salaryActionMonth, priorMonth)
    assert.equal(previousMonthDashboard.employeeSummaries[0].salaryConfirmedForActionMonth, false)
  })

  it('uses tax-free BDT line totals and the original date for paper-sale commission', async () => {
    await updateShopSettings({
      businessAddress: 'Dhaka, Bangladesh',
      countryCode: 'BD',
      sellerNameBangla: 'বেতন দোকান',
      sellerNameEnglish: 'Payroll Shop BD',
      secondaryLanguage: 'bn',
    })
    const employee = await createEmployee({
      employeeCode: `EMP-${randomUUID().slice(0, 8)}`,
      name: 'Bangladesh Stylist',
    })
    employeeIds.push(employee.id)
    const product = await createProduct({
      nameBangla: 'ফেসিয়াল',
      nameEnglish: 'BD Facial',
      priceIncludesVat: false,
      priceMinor: 10_000,
      translations: [{ language: 'bn', name: 'ফেসিয়াল' }],
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
        externalReference: `PAPER-${randomUUID()}`,
        issuedAt: new Date('2026-11-01T06:00:00.000Z'),
        issuedAtPrecision: 'dateOnly',
      },
    )
    invoiceIds.push(invoice.id)
    assert.deepEqual(invoice.items[0].commission, {
      amountMinor: 3_750,
      basisMinor: 15_000,
      rateBps: 2_500,
    })
    const originalDay = await getPayrollDashboard({
      employeeId: employee.id,
      mode: 'day',
      value: '2026-11-01',
    })
    assert.equal(originalDay.metrics.commissionEarnedMinor, 3_750)
    assert.equal(originalDay.employeeSummaries[0].salesGeneratedMinor, 15_000)
    assert.equal(originalDay.employeeSummaries[0].businessResultMinor, 11_250)

    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر الرواتب',
      sellerNameEnglish: 'Payroll Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
  })
})
