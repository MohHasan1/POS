import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, it } from 'node:test'
import { getPayload } from 'payload'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { CashSummaryDocument } from '@/components/cash/CashSummaryDocument'
import { resolveBusinessReportPeriod } from '@/lib/business-report-periods'
import { dateInputToISOString, getPeriodBounds, todayDateInput, toMarketDateInput } from '@/lib/calendar'
import { cashMovementSchema } from '@/lib/cash'
import { cashReportFilter, cashReportParams, cashSummaryFigures, openingBalanceRows } from '@/lib/cash-summary-view'
import { dictionaryForLocale } from '@/lib/localization'
import { MARKET_PROFILES } from '@/lib/market'
import type { CashLedger } from '@/payload-types'
import { getBusinessReport } from '@/services/business-reporting'
import { closeCashDay, getCashClosingForReport, getPreviousClosingCash } from '@/services/cash-closing'
import { getCashMovementBalances, getCashReport, getCurrentCashBalances, getExpenseCashLinks, recordCashMovement, saveDailyCashOpening, startCashTracking, summarizeCash } from '@/services/cash-report'
import { cashPaymentTime } from '@/services/cash-postings'
import { classifyCashSales, confirmBankReceipt, getCashSaleReview } from '@/services/cash-sale-review'
import { createEmployee } from '@/services/employees'
import { createExpenseCategory, createVariableExpense, updateExpense, voidExpense } from '@/services/expenses'
import { createMoneyAccount, createMoneyPayment, createMoneyPerson, voidMoneyAccount, voidMoneyPayment } from '@/services/money'
import { createPayrollPayout, updatePayrollEntry } from '@/services/payroll'
import { createProduct } from '@/services/products'
import { finalizeInvoiceWithSettlement } from '@/services/sale-settlement'
import { isCountryLocked, updateShopSettings } from '@/services/settings'

for (const market of [MARKET_PROFILES.SA, MARKET_PROFILES.BD]) {
  it(`carries balances across local midnight and month-end in ${market.timeZone}`, () => {
    const midnight = new Date(dateInputToISOString('2026-12-01', market))
    const now = new Date(midnight.getTime() + 3_600_000)
    const entry = (id: string, time: number, cashMinor: number, bankMinor = 0): CashLedger => ({
      id, cashMinor, bankMinor, countryCode: market.countryCode, currencyCode: market.currencyCode,
      effectiveAt: new Date(time).toISOString(), kind: id === 'opening' ? 'opening' : 'sale',
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    })
    const opening = entry('opening', midnight.getTime() - 43_200_000, 800, 1_200)
    const rows = [
      entry('before-opening', midnight.getTime() - 43_200_001, 90_000),
      entry('previous-day', midnight.getTime() - 1, 100),
      entry('new-month', midnight.getTime(), 0, 300),
      entry('future', now.getTime() + 1, 200_000),
    ]

    const previous = resolveBusinessReportPeriod({ period: 'previousMonth' }, market, now).selected
    assert.deepEqual(summarizeCash(opening, rows, previous, now)?.closing, { cashMinor: 900, bankMinor: 1_200 })
    const month = resolveBusinessReportPeriod({ period: 'month' }, market, now).selected
    const current = summarizeCash(opening, rows, month, now)!
    assert.deepEqual(current.carried, { cashMinor: 900, bankMinor: 1_200 })
    assert.deepEqual(current.closing, { cashMinor: 900, bankMinor: 1_500 })
    assert.deepEqual(current.history.map(({ id }) => id), ['new-month'])
    assert.equal(summarizeCash(opening, rows, { end: opening.effectiveAt }, now), null)

    const earlier = dateInputToISOString('2026-11-30', market)
    assert.equal(cashPaymentTime(earlier, market, now), earlier)
    assert.equal(cashPaymentTime(dateInputToISOString('2026-12-01', market), market, now), now.toISOString())
  })
}

describe('cash tracking with real source records', () => {
  const rows: { collection: 'expenses' | 'money-payments' | 'money-accounts' | 'invoices' | 'products' |
    'money-people' | 'employees' | 'employee-payroll-entries' | 'expense-categories' | 'receipt-vouchers' | 'cash-closings'; id: string }[] = []
  const market = MARKET_PROFILES.SA

  const keep = <T extends { id: string }>(collection: typeof rows[number]['collection'], record: T) => {
    rows.unshift({ collection, id: record.id })
    return record
  }

  afterEach(async () => {
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'cash-ledger', where: { id: { exists: true } } })
    for (const { collection, id } of rows.splice(0)) {
      await payload.delete({ collection, id })
    }
  })

  it('captures paid amounts, updates linked records once, and reconciles both accounts', async () => {
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر الاختبار',
      sellerNameEnglish: 'Cash Summary Fixture Shop',
      vatNumber: '310000000000003',
    })
    const profile = MARKET_PROFILES.SA
    const today = todayDateInput(profile)
    const product = keep('products', await createProduct({
      nameEnglish: 'Cash Summary fixture', priceMinor: 11_500, priceIncludesVat: true,
      unitCostMinor: 1_000, vatCategory: 'standard',
    }))
    const sale = () => ({
      idempotencyKey: randomUUID(), invoiceType: 'simplified' as const,
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 11_500 }],
    })
    const balance = async (cashMinor: number, bankMinor: number) => {
      assert.deepEqual(
        (await getCashReport({ period: 'all' }, market, 1)).balances?.closing,
        { cashMinor, bankMinor },
      )
    }
    keep('invoices', (await finalizeInvoiceWithSettlement(sale(), { cashAccount: 'cash' })).invoice)
    const opening = await startCashTracking({ basis: 'countNow', cashMinor: 10_000, bankMinor: 20_000 })
    assert(await isCountryLocked())
    assert.equal((await startCashTracking({ basis: 'startOfDay', cashMinor: 1, bankMinor: 1 })).effectiveAt, opening.effectiveAt)
    await balance(10_000, 20_000)
    assert.equal((await getCashReport({ period: 'today' }, market, 1)).activity.includesBeforeOpening, false)

    const input = sale()
    await assert.rejects(finalizeInvoiceWithSettlement(input), /Select Cash or Bank/)
    const paid = keep('invoices', (await finalizeInvoiceWithSettlement(input, { cashAccount: 'cash' })).invoice)
    assert.equal((await finalizeInvoiceWithSettlement(input, { cashAccount: 'bank' })).invoice.id, paid.id)
    await balance(20_000, 20_000)

    const person = keep('money-people', await createMoneyPerson({ name: 'Cash test person' }))
    const partialInput = sale()
    const settlement = {
      accountIdempotencyKey: randomUUID(), personId: person.id,
      initialPayment: { amountMinor: 2_000, idempotencyKey: randomUUID(), paymentMethod: 'cash' as const },
    }
    const partial = await finalizeInvoiceWithSettlement(partialInput, { salesChannel: 'serviceBoard' }, settlement)
    keep('invoices', partial.invoice)
    keep('money-accounts', partial.account!)
    keep('money-payments', partial.initialPayment!)
    const retried = await finalizeInvoiceWithSettlement(partialInput, {}, settlement)
    assert.equal(retried.initialPayment?.id, partial.initialPayment!.id)
    await balance(21_739, 20_000)

    const collected = await createMoneyPayment({
      accountId: partial.account!.id, amountMinor: 9_500, idempotencyKey: randomUUID(),
      paymentDate: today, paymentMethod: 'bank_transfer', bankName: 'Bank',
      transactionReference: 'CASH-TEST', transferDate: today, createReceiptVoucher: true,
    })
    const voucherId = typeof collected.receiptVoucher === 'string' ? collected.receiptVoucher : collected.receiptVoucher?.id
    keep('receipt-vouchers', { id: voucherId! })
    keep('money-payments', collected)
    await balance(21_739, 28_261)
    const report = await getBusinessReport({ period: 'today' })
    assert.equal(report.summary.grossSalesMinor, 34_500)
    assert.equal(report.summary.vatMinor, 4_500)
    assert.equal(report.summary.netSalesMinor, 30_000)

    const debt = keep('money-accounts', await createMoneyAccount({
      direction: 'owedToUs', invoiceId: paid.id, kind: 'unpaidInvoice',
      idempotencyKey: randomUUID(), personId: person.id, recordDate: today,
    }))
    await balance(11_739, 28_261)
    await voidMoneyAccount(debt.id, 'The sale was paid')
    await balance(21_739, 28_261)

    const category = keep('expense-categories', await createExpenseCategory('Cash test expenses'))
    const bill = {
      billDate: today, categoryId: category.id, idempotencyKey: randomUUID(), name: 'A paid bill',
      totalMinor: 500, vatMinor: 0, paymentStatus: 'unpaid' as const,
    }
    const expense = keep('expenses', await createVariableExpense(bill))
    await balance(21_739, 28_261)
    await updateExpense(expense.id, { ...bill, paymentStatus: 'paid', paymentMethod: 'cash', paidAt: today })
    await balance(21_239, 28_261)
    await updateExpense(expense.id, {
      ...bill, totalMinor: 800, paymentStatus: 'paid', paymentMethod: 'bank', paidAt: today,
    })
    await balance(21_739, 27_461)
    await voidExpense(expense.id, 'Duplicate bill')
    await balance(21_739, 28_261)

    const supplier = keep('money-accounts', await createMoneyAccount({
      direction: 'weOwe', kind: 'supplierCredit', idempotencyKey: randomUUID(),
      personId: person.id, recordDate: today, originalAmountMinor: 1_000,
    }))
    const paidSupplier = keep('money-payments', await createMoneyPayment({
      accountId: supplier.id, amountMinor: 1_000, idempotencyKey: randomUUID(),
      paymentDate: today, paymentMethod: 'cash',
    }))
    const paymentReport = await getCashReport({ period: 'today' }, profile, 1)
    assert.deepEqual(paymentReport.activity.breakdown.moneyPaidToPeople, { cashMinor: -1_000, bankMinor: 0 })
    assert.deepEqual(paymentReport.balances?.breakdown.moneyPaidToPeople, paymentReport.activity.breakdown.moneyPaidToPeople)
    assert.deepEqual(paymentReport.activity.breakdown.otherOut, { cashMinor: 0, bankMinor: 0 })
    const linked = keep('expenses', await createVariableExpense({
      ...bill, idempotencyKey: randomUUID(), totalMinor: 1_000, paymentMethod: 'cash',
      paymentStatus: 'paid', paidAt: today, cashPaymentId: paidSupplier.id,
    }))
    await balance(20_739, 28_261)
    assert.equal((await getExpenseCashLinks(profile)).find(({ id }) => id === paidSupplier.id)?.claimedBy, linked.id)
    const expenseReport = await getCashReport({ period: 'today' }, profile, 1)
    assert.deepEqual(expenseReport.balances?.breakdown.expensesPaid, { cashMinor: -1_000, bankMinor: 0 })
    assert.deepEqual(expenseReport.activity.breakdown.expensesPaid, expenseReport.balances?.breakdown.expensesPaid)
    assert.deepEqual(expenseReport.activity.breakdown.moneyPaidToPeople, { cashMinor: 0, bankMinor: 0 })
    const figures = cashSummaryFigures(expenseReport, (await getBusinessReport({ period: 'today' })).summary,
      'today', dictionaryForLocale('en'), profile)
    assert.deepEqual(figures.productCosts.map(({ value }) => value), [3_000, 27_000])
    assert.deepEqual(figures.profit.map(({ value }) => value), [27_000, 1_000, 26_000])
    assert.equal(figures.totalProfitExpenses, 4_000)
    await assert.rejects(voidMoneyPayment(paidSupplier.id, 'Mistake'), /Unlink this payment/)
    await voidExpense(linked.id, 'Duplicate bill')
    await voidMoneyPayment(paidSupplier.id, 'Mistake')
    await balance(21_739, 28_261)

    const employee = keep('employees', await createEmployee({ name: 'Cash payout fixture' }))
    const payroll = { employeeId: employee.id, entryDate: today, amountMinor: 600, paymentMethod: 'cash' as const }
    const payout = keep('employee-payroll-entries', await createPayrollPayout({ ...payroll, idempotencyKey: randomUUID() }))
    await balance(21_139, 28_261)
    await updatePayrollEntry(payout.id, { ...payroll, paymentMethod: 'bank' })
    await balance(21_739, 27_661)

    const movement = { id: randomUUID(), date: today, account: 'cash' as const, note: 'Bank deposit' }
    const transfer = await recordCashMovement({ ...movement, kind: 'transfer', amountMinor: 1_500 })
    assert.equal((await recordCashMovement({ ...movement, kind: 'transfer', amountMinor: 1_500 })).id, transfer.id)
    await balance(20_239, 29_161)
    await recordCashMovement({ ...movement, id: randomUUID(), kind: 'reconcile', amountMinor: 20_139, note: 'Drawer count' })
    await balance(20_139, 29_161)

    const cash = (await getCashReport({ period: 'today' }, market, 1)).balances!
    assert.equal(cash.current, true)
    assert.deepEqual(cash.carried, { cashMinor: 0, bankMinor: 20_000 })
    assert.deepEqual(cash.breakdown.salesReceived, { cashMinor: 21_739, bankMinor: 8_261 })
    assert.deepEqual(cash.breakdown.payrollPaid, { cashMinor: 0, bankMinor: -600 })
    assert.deepEqual(cash.breakdown.transfers, { cashMinor: -1_500, bankMinor: 1_500 })
    assert.deepEqual(cash.breakdown.adjustments, { cashMinor: -100, bankMinor: 0 })
    assert.equal(cash.moneyIn.cashMinor - cash.moneyOut.cashMinor, 20_139)
    assert.equal(cash.moneyIn.bankMinor - cash.moneyOut.bankMinor, 9_161)
    const yesterday = await getCashReport({ period: 'yesterday' }, market, 1)
    assert.equal(yesterday.balances, null)

    const pendingSale = keep('invoices', (await finalizeInvoiceWithSettlement(
      sale(), { bankPending: true, cashAccount: 'bank' },
    )).invoice)
    assert.equal(pendingSale.cashAccount, 'bank')
    assert.equal(pendingSale.bankPending, true)
    await balance(20_139, 29_161)
    assert((await getCashSaleReview(profile)).pending.some(({ id }) => id === pendingSale.id))
    await confirmBankReceipt(pendingSale.id, today, 11_200)
    await confirmBankReceipt(pendingSale.id, today, 11_200)
    await balance(20_139, 38_900)
    assert(!(await getCashSaleReview(profile)).pending.some(({ id }) => id === pendingSale.id))
    const { activity, balances } = await getCashReport({ period: 'today' }, profile, 1)
    assert.deepEqual(activity.breakdown.salesReceived, { cashMinor: 21_739, bankMinor: 18_000 })
    assert.deepEqual(balances?.breakdown.salesReceived, activity.breakdown.salesReceived)
    assert.deepEqual(balances?.closing, { cashMinor: 20_139, bankMinor: 38_900 })
    assert.equal(activity.history.find((row) => row.note === pendingSale.invoiceNumber)?.bankMinor, 9_739)
    const nextDay = new Date(Date.parse(dateInputToISOString(today, profile)) + 86_400_000)
    const nextDayReport = await getCashReport({ period: 'today' }, profile, 1, nextDay)
    assert.deepEqual(nextDayReport.balances?.breakdown.salesReceived, { cashMinor: 0, bankMinor: 0 })
    assert.deepEqual(nextDayReport.balances?.carried, balances?.closing)
    assert.deepEqual(nextDayReport.balances?.closing, balances?.closing)
    const month = await getCashReport({ period: 'month' }, profile, 1, nextDay)
    assert.deepEqual(month.openingEditor, {
      date: todayDateInput(profile, nextDay),
      balances: { cashMinor: 20_139, bankMinor: 38_900 },
    })
  })

  it('allocates invoice VAT across cash and bank payments on different days', async () => {
    const today = todayDateInput(market)
    const yesterday = toMarketDateInput(new Date(Date.parse(dateInputToISOString(today, market)) - 1), market)
    const product = keep('products', await createProduct({
      nameEnglish: 'VAT rounding fixture', priceMinor: 7, priceIncludesVat: true, vatCategory: 'standard',
    }))
    const person = keep('money-people', await createMoneyPerson({ name: 'VAT rounding customer' }))
    const sale = await finalizeInvoiceWithSettlement({
      idempotencyKey: randomUUID(), invoiceType: 'simplified',
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 7 }],
    }, { issuedAt: new Date(dateInputToISOString(yesterday, market)) }, {
      accountIdempotencyKey: randomUUID(), personId: person.id,
      initialPayment: { amountMinor: 2, idempotencyKey: randomUUID(), paymentMethod: 'cash' },
    })
    keep('invoices', sale.invoice)
    const accountId = keep('money-accounts', sale.account!).id
    keep('money-payments', sale.initialPayment!)
    assert.equal(sale.invoice.vatMinor, 1)

    keep('money-payments', await createMoneyPayment({
      accountId, amountMinor: 2, idempotencyKey: randomUUID(), paymentDate: today,
      paymentMethod: 'bank_transfer', bankName: 'Bank', transactionReference: 'VAT-ROUNDING', transferDate: today,
    }))
    keep('money-payments', await createMoneyPayment({
      accountId, amountMinor: 3, idempotencyKey: randomUUID(), paymentDate: today, paymentMethod: 'cash',
    }))

    const { activity } = await getCashReport({ period: 'today' }, market, 1)
    assert.deepEqual(activity.breakdown.salesReceived, { cashMinor: 3, bankMinor: 1 })
    assert.deepEqual((await getCashReport({ period: 'yesterday' }, market, 1)).activity.breakdown.salesReceived,
      { cashMinor: 2, bankMinor: 0 })
  })

  it('includes early bank receipts in the first day’s zero opening balance calculation', async () => {
    const product = keep('products', await createProduct({
      nameEnglish: 'Before legacy count', priceMinor: 11_500, priceIncludesVat: true, vatCategory: 'standard',
    }))
    const paidSale = async (cashAccount: 'cash' | 'bank') => keep('invoices', (await finalizeInvoiceWithSettlement({
      idempotencyKey: randomUUID(), invoiceType: 'simplified',
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 11_500 }],
    }, { cashAccount })).invoice)
    await paidSale('bank')
    await paidSale('cash')
    await startCashTracking({ basis: 'countNow', cashMinor: 10_000, bankMinor: 0 })
    await paidSale('bank')

    const { nextDayStart } = getPeriodBounds(market)
    const yesterday = await getCashReport({ period: 'yesterday' }, market, 1, nextDayStart)
    assert.deepEqual(yesterday.activity.breakdown.salesReceived, { cashMinor: 10_000, bankMinor: 20_000 })
    assert.deepEqual(yesterday.balances?.breakdown.salesReceived, yesterday.activity.breakdown.salesReceived)
    assert.deepEqual(yesterday.balances?.carried, { cashMinor: 0, bankMinor: 0 })
    assert.deepEqual(yesterday.balances?.closing, { cashMinor: 10_000, bankMinor: 20_000 })
  })

  it('shows sales and expenses before setup and includes them in a start-of-day opening', async () => {
    const today = todayDateInput(market)
    const product = keep('products', await createProduct({
      nameEnglish: 'Before opening sale', priceMinor: 11_500, priceIncludesVat: true,
      unitCostMinor: 1000, vatCategory: 'standard',
    }))
    const sale = () => ({
      idempotencyKey: randomUUID(), invoiceType: 'simplified' as const,
      items: [{ productId: product.id, quantityMilliunits: 1000, unitPriceMinor: 11_500 }],
    })
    const recorded = keep('invoices', (await finalizeInvoiceWithSettlement(sale(), { cashAccount: 'cash' })).invoice)
    assert.equal(recorded.cashAccount, 'cash')
    const legacy = keep('invoices', (await finalizeInvoiceWithSettlement(sale())).invoice)
    assert((await getCashSaleReview(market)).legacy.some(({ id }) => id === legacy.id))
    const category = keep('expense-categories', await createExpenseCategory('Before opening expense category'))
    keep('expenses', await createVariableExpense({
      billDate: today, categoryId: category.id, idempotencyKey: randomUUID(), name: 'Before opening expense',
      totalMinor: 1_000, vatMinor: 0, paidAt: today, paymentStatus: 'paid', paymentMethod: 'cash',
    }))
    const employee = keep('employees', await createEmployee({ name: 'Before opening payroll' }))
    keep('employee-payroll-entries', await createPayrollPayout({
      employeeId: employee.id, entryDate: today, amountMinor: 200, paymentMethod: 'bank', idempotencyKey: randomUUID(),
    }))
    const summary = () => getCashReport({ period: 'today' }, market, 1)
    const before = await summary()
    assert.equal(before.balances, null)
    assert.equal(await getCurrentCashBalances(), null)
    assert.deepEqual(openingBalanceRows(before, dictionaryForLocale('en')), [])
    assert.deepEqual(before.activity.net, { cashMinor: 9_000, bankMinor: -200 })
    assert.deepEqual(before.activity.breakdown.expensesPaid, { cashMinor: -1000, bankMinor: 0 })
    assert.deepEqual(before.activity.breakdown.payrollPaid, { cashMinor: 0, bankMinor: -200 })

    const opening = await startCashTracking({ basis: 'startOfDay', cashMinor: 500, bankMinor: 800 })
    assert.equal(opening.effectiveAt, dateInputToISOString(today, market))
    await classifyCashSales([legacy.id], 'bank')
    await classifyCashSales([legacy.id], 'bank')
    assert(!(await getCashSaleReview(market)).legacy.some(({ id }) => id === legacy.id))
    const after = await summary()
    assert.deepEqual(after.balances?.closing, { cashMinor: 9_500, bankMinor: 10_600 })
  })

  it('records both account amounts together and distinguishes a blank balance from zero', async () => {
    await startCashTracking({ basis: 'startOfDay', cashMinor: 10_000, bankMinor: 5_000 })
    const next = () => ({ id: randomUUID(), date: todayDateInput(market), note: 'Both accounts' })
    const income = cashMovementSchema.parse({ ...next(), kind: 'income', cashMinor: 5_000, bankMinor: 2_000 })
    const recorded = await recordCashMovement(income)
    assert.deepEqual({ cashMinor: recorded.cashMinor, bankMinor: recorded.bankMinor }, { cashMinor: 5_000, bankMinor: 2_000 })
    assert.equal((await recordCashMovement(income)).id, recorded.id)
    assert.deepEqual(await getCurrentCashBalances(), { cashMinor: 15_000, bankMinor: 7_000 })

    assert.equal(cashMovementSchema.safeParse({ ...next(), kind: 'outflow', cashMinor: -200, bankMinor: 600 }).success, false)
    assert.equal(cashMovementSchema.safeParse({ ...next(), kind: 'income' }).success, false)
    await recordCashMovement(cashMovementSchema.parse({ ...next(), kind: 'outflow', cashMinor: 2_000, bankMinor: 3_000 }))
    assert.deepEqual(await getCurrentCashBalances(), { cashMinor: 13_000, bankMinor: 4_000 })

    await recordCashMovement(cashMovementSchema.parse({ ...next(), kind: 'reconcile', cashMinor: 12_000, bankMinor: 0 }))
    assert.deepEqual(await getCurrentCashBalances(), { cashMinor: 12_000, bankMinor: 0 })
    await recordCashMovement(cashMovementSchema.parse({ ...next(), kind: 'reconcile', bankMinor: 800 }))
    assert.deepEqual(await getCurrentCashBalances(), { cashMinor: 12_000, bankMinor: 800 })
  })

  it('closes the VAT-exclusive SAR drawer once and records the correction and pickup separately', async () => {
    const today = todayDateInput(market)
    const { nextDayStart } = getPeriodBounds(market)
    await startCashTracking({ basis: 'startOfDay', cashMinor: 500, bankMinor: 10_000 })
    const product = keep('products', await createProduct({
      nameEnglish: 'Closing fixture', priceMinor: 11_500, priceIncludesVat: true, vatCategory: 'standard',
    }))
    const { invoice } = await finalizeInvoiceWithSettlement({
      idempotencyKey: randomUUID(), invoiceType: 'simplified',
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 11_500 }],
    }, { cashAccount: 'cash' })
    keep('invoices', invoice)
    const input = {
      requestId: randomUUID(), businessDate: today, expectedCashMinor: 10_500,
      actualCashMinor: 10_300, ownerPickupMinor: 8_000, note: 'Drawer counted short by two riyals.',
    }
    assert.deepEqual(await closeCashDay({ ...input, businessDate: todayDateInput(market, nextDayStart) }), { status: 'dayChanged' })
    assert.deepEqual(await closeCashDay({ ...input, expectedCashMinor: 12_000 }),
      { status: 'drawerChanged', balances: { cashMinor: 10_500, bankMinor: 10_000 } })
    assert.deepEqual(await closeCashDay({ ...input, note: ' ' }), { status: 'reasonRequired' })
    await assert.rejects(closeCashDay({ ...input, ownerPickupMinor: 10_301 }))
    assert.deepEqual(await closeCashDay(input), { status: 'saved' })
    const saved = (await getCashClosingForReport({ period: 'yesterday' }, market, nextDayStart))?.closing
    assert(saved)
    keep('cash-closings', saved)
    assert.equal(saved.currencyCode, 'SAR')
    assert.equal(saved.timeZone, 'Asia/Riyadh')
    assert.equal(saved.expectedCashMinor, 10_500)
    assert.equal(saved.actualCashMinor, 10_300)
    assert.equal(saved.ownerPickupMinor, 8_000)
    assert.deepEqual(await closeCashDay(input, nextDayStart), { status: 'saved' })
    assert.deepEqual(await closeCashDay({ ...input, requestId: randomUUID() }), { status: 'alreadyClosed' })

    const closingDay = await getCashReport({ period: 'yesterday' }, market, 1, nextDayStart)
    assert.deepEqual(closingDay.balances?.closing, { cashMinor: 2_300, bankMinor: 10_000 })
    assert.deepEqual(await getCurrentCashBalances(), closingDay.balances?.closing)
    assert.deepEqual(openingBalanceRows(closingDay, dictionaryForLocale('en')).map(({ values }) => values.map(({ value }) => value)),
      [[2_300, 500, 1_800], [10_000, 10_000, 0]])
    assert.deepEqual(closingDay.activity.breakdown.adjustments, { cashMinor: -200, bankMinor: 0 })
    assert.deepEqual(closingDay.activity.breakdown.ownerPickup, { cashMinor: -8_000, bankMinor: 0 })
    assert.equal(closingDay.activity.history.filter(({ kind }) => kind === 'ownerPickup').length, 1)
    assert.equal(closingDay.activity.history.filter(({ kind }) => kind === 'reconcile').length, 1)
    assert.equal((await getBusinessReport({ period: 'today' })).summary.grossSalesMinor, invoice.totalMinor)

    await recordCashMovement({ id: randomUUID(), kind: 'income', account: 'cash', date: today, amountMinor: 200, note: 'After closing' })
    const tomorrow = await getCashReport({ period: 'today' }, market, 1, nextDayStart)
    assert.deepEqual(tomorrow.balances?.carried, { cashMinor: 2_500, bankMinor: 10_000 })
    assert.deepEqual((await getCashClosingForReport({ period: 'custom', startDate: today, endDate: today }, market, nextDayStart))?.closing, saved)
    assert.equal(await getCashClosingForReport({ period: 'month' }, market, nextDayStart), null)
  })

  it('edits opening balances, resets them at midnight, and closes using VAT-exclusive amounts', async () => {
    const today = todayDateInput(market)
    await saveDailyCashOpening({ date: today, cashMinor: 500, bankMinor: 2_000 })
    const product = keep('products', await createProduct({
      nameEnglish: 'Withdrawal VAT fixture', priceMinor: 11_500, priceIncludesVat: true, vatCategory: 'standard',
    }))
    keep('invoices', (await finalizeInvoiceWithSettlement({
      idempotencyKey: randomUUID(), invoiceType: 'simplified',
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 11_500 }],
    }, { cashAccount: 'cash' })).invoice)
    await saveDailyCashOpening({ date: today, cashMinor: 0, bankMinor: 3_000 })
    assert.deepEqual(await getCashMovementBalances(market, today), { cashMinor: 10_000, bankMinor: 3_000 })
    const withdraw = { id: randomUUID(), kind: 'outflow' as const, date: today, note: '' }
    await assert.rejects(recordCashMovement({ ...withdraw, cashMinor: 11_500 }), /exceeds the available balance/)
    await recordCashMovement({ ...withdraw, cashMinor: 9_000 })
    assert.deepEqual(await getCashMovementBalances(market, today), { cashMinor: 1_000, bankMinor: 3_000 })

    const input = {
      requestId: randomUUID(), businessDate: today, expectedCashMinor: 1_000, actualCashMinor: 1_000,
      ownerPickupMinor: 1_000, expectedBankMinor: 3_000, actualBankMinor: 3_000, bankPickupMinor: 3_000, note: '',
    }
    assert.deepEqual(await closeCashDay(input), { status: 'saved' })
    assert.deepEqual(await closeCashDay(input), { status: 'saved' })
    const closing = (await getCashClosingForReport({ period: 'today' }, market, new Date()))?.closing
    assert(closing)
    keep('cash-closings', closing)
    assert.equal(closing.actualBankMinor, 3_000)
    assert.equal(closing.bankPickupMinor, 3_000)
    const report = await getCashReport({ period: 'custom', startDate: today, endDate: today }, market, 1)
    assert.deepEqual(report.balances?.carried, { cashMinor: 0, bankMinor: 3_000 })
    assert.deepEqual(report.balances?.closing, { cashMinor: 0, bankMinor: 0 })
    assert.deepEqual(report.activity.breakdown.adjustments, { cashMinor: 0, bankMinor: 0 })

    // Even an amount left after closing belongs to the selected day.
    await recordCashMovement({ id: randomUUID(), kind: 'income', date: today, cashMinor: 200, bankMinor: 300, note: '' })
    assert.deepEqual(await getCurrentCashBalances(), { cashMinor: 200, bankMinor: 300 })
    const { nextDayStart } = getPeriodBounds(market)
    const tomorrow = await getCashReport({ period: 'today' }, market, 1, nextDayStart)
    assert.deepEqual(tomorrow.balances?.carried, { cashMinor: 0, bankMinor: 0 })
    assert.deepEqual(tomorrow.balances?.closing, { cashMinor: 0, bankMinor: 0 })
    const month = await getCashReport({ period: 'month' }, market, 1, nextDayStart)
    assert.equal(month.dailyBalanceDate, todayDateInput(market, nextDayStart))
    assert.deepEqual(month.activity.breakdown.salesReceived, { cashMinor: 10_000, bankMinor: 0 })
    assert.deepEqual(month.balances?.breakdown.salesReceived, { cashMinor: 0, bankMinor: 0 })
  })

  it('prints a selected date with the closing and every cash movement across pages', async () => {
    const payload = await getPayload({ config })
    const today = todayDateInput(market)
    const opening = await startCashTracking({ basis: 'startOfDay', cashMinor: 400, bankMinor: 300 })
    for (let number = 1; number <= 21; number++) {
      await payload.create({
        collection: 'cash-ledger',
        data: {
          kind: 'income', cashMinor: 100, bankMinor: number === 1 ? 75 : 0, effectiveAt: opening.effectiveAt,
          countryCode: market.countryCode, currencyCode: market.currencyCode, note: `Export movement ${number}`,
        },
      })
    }
    const result = await closeCashDay({
      requestId: randomUUID(), businessDate: today, expectedCashMinor: 2_500,
      actualCashMinor: 2_500, ownerPickupMinor: 2_200, note: 'End of day count',
    })
    assert.equal(result.status, 'saved')

    const filter = cashReportFilter(Object.fromEntries(cashReportParams({ period: 'custom', startDate: today, endDate: today })))
    assert.deepEqual(filter, { period: 'custom', startDate: today, endDate: today })
    const report = await getBusinessReport(filter)
    const now = new Date(report.generatedAt)
    const closing = (await getCashClosingForReport(filter, market, now))?.closing
    assert(closing)
    keep('cash-closings', closing)
    const paged = await getCashReport(filter, market, 1, now)
    const cash = await getCashReport(filter, market, 'all', now)
    assert.equal(paged.activity.history.length, 20)
    assert.equal(cash.activity.history.length, 22)
    assert.deepEqual(cash.balances?.closing, paged.balances?.closing)
    const dictionary = dictionaryForLocale('en')
    assert.deepEqual(openingBalanceRows(cash, dictionary).map(({ values }) => values.map(({ value }) => value)),
      [[300, 400, -100], [375, 300, 75]])

    const html = renderToStaticMarkup(createElement(CashSummaryDocument, {
      cash, closing, dictionary, locale: 'en', report,
    }))
    assert.match(html, /professional-report/)
    assert.match(html, /End of day count/)
    assert.match(html, /Profit after expenses/)
    assert.match(html, /Direct product costs/)
    assert.match(html, /Sales after product costs/)
    assert.match(html, /Cash change after opening/)
    assert.match(html, /Bank change after opening/)
    assert.equal([...html.matchAll(/Export movement \d+/g)].length, 21)
  })

  it('keeps part of the drawer as the next day’s opening cash', async () => {
    const today = todayDateInput(market)
    const { nextDayStart } = getPeriodBounds(market)
    const closingTime = new Date(nextDayStart.getTime() - 1)
    await saveDailyCashOpening({ date: today, cashMinor: 50_000, bankMinor: 10_000 })
    const input = {
      requestId: randomUUID(), businessDate: today,
      expectedCashMinor: 50_000, actualCashMinor: 50_000, ownerPickupMinor: 45_000,
      nextDayCashMinor: 5_000, note: '',
    }
    await assert.rejects(closeCashDay({ ...input, nextDayCashMinor: 5_001 }, closingTime))
    assert.deepEqual(await closeCashDay(input, closingTime), { status: 'saved' })
    assert.deepEqual(await closeCashDay(input, nextDayStart), { status: 'saved' })

    const yesterday = await getCashReport({ period: 'yesterday' }, market, 'all', nextDayStart)
    assert.deepEqual(yesterday.balances?.closing, { cashMinor: 5_000, bankMinor: 10_000 })
    assert.deepEqual(yesterday.balances?.moneyOut, { cashMinor: 45_000, bankMinor: 0 })
    assert.equal(yesterday.activity.history.length, 1)
    const tomorrow = await getCashReport({ period: 'today' }, market, 'all', nextDayStart)
    assert.deepEqual(tomorrow.openingEditor.balances, { cashMinor: 5_000, bankMinor: 0 })
    assert.deepEqual(tomorrow.balances?.closing, { cashMinor: 5_000, bankMinor: 0 })
    assert.equal(tomorrow.activity.history.length, 0)

    const closing = (await getCashClosingForReport({ period: 'yesterday' }, market, nextDayStart))?.closing
    assert(closing)
    keep('cash-closings', closing)
    assert.equal(closing.nextDayCashMinor, 5_000)
    const nextDate = todayDateInput(market, nextDayStart)
    assert.equal(await getPreviousClosingCash(nextDate, market), 5_000)
    const report = await getBusinessReport({ period: 'today' })
    const html = renderToStaticMarkup(createElement(CashSummaryDocument, {
      cash: yesterday, closing, dictionary: dictionaryForLocale('en'), locale: 'en', report,
    }))
    assert.match(html, /Daily cash closing[\s\S]*Cash for tomorrow/)

    const edit = {
      ...input, requestId: randomUUID(), revision: closing.requestId,
      actualCashMinor: 49_000, ownerPickupMinor: 42_000, nextDayCashMinor: 7_000,
      expectedBankMinor: 10_000, actualBankMinor: 10_000, bankPickupMinor: 9_000,
      note: 'Corrected counted cash.',
    }
    assert.deepEqual(await closeCashDay({ ...edit, note: '' }, nextDayStart), { status: 'reasonRequired' })
    assert.deepEqual(await closeCashDay(edit, nextDayStart), { status: 'saved' })
    assert.deepEqual(await closeCashDay(edit, nextDayStart), { status: 'saved' })
    assert.deepEqual(await closeCashDay({ ...edit, requestId: randomUUID() }, nextDayStart), { status: 'closingChanged' })

    const corrected = await getCashReport({ period: 'yesterday' }, market, 'all', nextDayStart)
    assert.deepEqual(corrected.balances?.closing, { cashMinor: 7_000, bankMinor: 1_000 })
    assert.deepEqual(corrected.activity.breakdown.ownerPickup, { cashMinor: -42_000, bankMinor: -9_000 })
    assert.deepEqual(corrected.activity.breakdown.adjustments, { cashMinor: -1_000, bankMinor: 0 })
    assert.equal(corrected.activity.history.length, 2)
    const nextOpening = await getCashReport({ period: 'today' }, market, 1, nextDayStart)
    assert.deepEqual(nextOpening.balances?.carried, { cashMinor: 7_000, bankMinor: 0 })
    const savedEdit = (await getCashClosingForReport({ period: 'yesterday' }, market, nextDayStart))?.closing
    assert.equal(savedEdit?.closedAt, closing.closedAt)
    assert.equal(savedEdit?.nextDayCashMinor, 7_000)

    const payload = await getPayload({ config })
    await payload.update({
      collection: 'cash-ledger', id: `opening:SA:${nextDate}`,
      data: { cashMinor: 9_000, bankMinor: 1_200, source: 'opening-snapshot:7000:0' },
    })
    assert.deepEqual(await closeCashDay({
      ...edit, requestId: randomUUID(), revision: edit.requestId, ownerPickupMinor: 41_000, nextDayCashMinor: 8_000,
    }, nextDayStart), { status: 'saved' })
    assert.equal(await getPreviousClosingCash(nextDate, market), 8_000)
    assert.deepEqual((await getCashReport({ period: 'today' }, market, 1, nextDayStart)).openingEditor.balances,
      { cashMinor: 9_000, bankMinor: 1_200 })
  })

  it('shows a legacy full withdrawal and closing at zero without a VAT adjustment row', async () => {
    const today = todayDateInput(market)
    await saveDailyCashOpening({ date: today, cashMinor: 0, bankMinor: 0 })
    const product = keep('products', await createProduct({
      nameEnglish: 'Legacy closing VAT fixture', priceMinor: 11_500, priceIncludesVat: true, vatCategory: 'standard',
    }))
    const { invoice } = await finalizeInvoiceWithSettlement({
      idempotencyKey: randomUUID(), invoiceType: 'simplified',
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 11_500 }],
    }, { cashAccount: 'cash' })
    keep('invoices', invoice)
    const payload = await getPayload({ config })
    const closedAt = new Date().toISOString()
    const id = `SA:${today}`
    const requestId = randomUUID()
    const settings = { countryCode: 'SA', currencyCode: 'SAR' }
    keep('cash-closings', await payload.create({ collection: 'cash-closings', data: {
      ...settings, id, businessDate: today, closedAt, requestId, timeZone: market.timeZone,
      expectedCashMinor: 11_500, actualCashMinor: 11_500, ownerPickupMinor: 11_500,
    } }))
    await payload.create({ collection: 'cash-ledger', data: {
      ...settings, cashMinor: -11_500, bankMinor: 0, kind: 'ownerPickup',
      effectiveAt: closedAt, source: `ownerPickup:close:${id}`,
    } })

    const filter = { period: 'custom', startDate: today, endDate: today } as const
    const cash = await getCashReport(filter, market, 'all')
    assert.deepEqual(cash.balances?.closing, { cashMinor: 0, bankMinor: 0 })
    assert.deepEqual(cash.balances?.moneyIn, { cashMinor: 10_000, bankMinor: 0 })
    assert.deepEqual(cash.balances?.moneyOut, { cashMinor: 10_000, bankMinor: 0 })
    assert.equal(cash.activity.history.find(({ kind }) => kind === 'ownerPickup')?.cashMinor, -10_000)
    const closing = (await getCashClosingForReport(filter, market, new Date()))?.closing
    assert.equal(closing?.expectedCashMinor, 10_000)
    assert.equal(closing?.ownerPickupMinor, 10_000)
    const report = await getBusinessReport(filter)
    assert.equal(report.summary.vatMinor, 1_500)
    const html = renderToStaticMarkup(createElement(CashSummaryDocument, {
      cash, closing: closing ?? null, dictionary: dictionaryForLocale('en'), locale: 'en', report,
    }))
    assert.doesNotMatch(html, /Recorded balances|Sales VAT withdrawn/)
    assert.deepEqual(await closeCashDay({
      requestId, businessDate: today, expectedCashMinor: 0, actualCashMinor: 0, ownerPickupMinor: 0, note: '',
    }), { status: 'saved' })

    await saveDailyCashOpening({ date: today, cashMinor: 1_000, bankMinor: 0 })
    const edited = await getCashReport(filter, market, 'all')
    assert.deepEqual(edited.balances?.moneyOut, cash.balances?.moneyOut)
    assert.deepEqual(edited.balances?.closing, { cashMinor: 1_000, bankMinor: 0 })
    assert.equal(edited.activity.history.length, cash.activity.history.length)
    const oldClosing = (await getCashClosingForReport(filter, market, new Date()))?.closing
    assert(oldClosing)
    const editRequest = randomUUID()
    assert.deepEqual(await closeCashDay({
      requestId: editRequest, revision: oldClosing.requestId, businessDate: today,
      actualCashMinor: oldClosing.actualCashMinor, expectedCashMinor: oldClosing.expectedCashMinor,
      ownerPickupMinor: 8_000, note: '',
    }), { status: 'saved' })
    const afterClosingEdit = (await getCashClosingForReport(filter, market, new Date()))?.closing
    assert.equal(afterClosingEdit?.id, id)
    assert.equal(afterClosingEdit?.lastEditRequestId, editRequest)
    assert.equal(afterClosingEdit?.ownerPickupMinor, 8_000)
  })

  it('preserves the net amount of an older withdrawal when a daily opening is added afterward', async () => {
    const today = todayDateInput(market)
    const dayStart = dateInputToISOString(today, market)
    const priorDay = new Date(Date.parse(dayStart) - 1).toISOString()
    const payload = await getPayload({ config })
    const opening = await startCashTracking({ basis: 'startOfDay', cashMinor: 0, bankMinor: 0 })
    await payload.update({ collection: 'cash-ledger', id: opening.id, data: { effectiveAt: priorDay } })
    const product = keep('products', await createProduct({
      nameEnglish: 'Before daily opening VAT fixture', priceMinor: 11_500, priceIncludesVat: true, vatCategory: 'standard',
    }))
    const { invoice } = await finalizeInvoiceWithSettlement({
      idempotencyKey: randomUUID(), invoiceType: 'simplified',
      items: [{ productId: product.id, quantityMilliunits: 1_000, unitPriceMinor: 11_500 }],
    }, { cashAccount: 'cash' })
    keep('invoices', invoice)
    const sale = await payload.find({ collection: 'cash-ledger', limit: 1, where: { source: { equals: `sale:${invoice.id}` } } })
    await payload.update({ collection: 'cash-ledger', id: sale.docs[0].id, data: { effectiveAt: priorDay } })
    await payload.create({ collection: 'cash-ledger', data: {
      effectiveAt: new Date().toISOString(), countryCode: 'SA', currencyCode: 'SAR',
      kind: 'outflow', cashMinor: -11_500, bankMinor: 0,
    } })

    await saveDailyCashOpening({ date: today, cashMinor: 10_000, bankMinor: 0 })
    const after = await getCashReport({ period: 'today' }, market, 'all')
    assert.deepEqual(after.balances?.moneyOut, { cashMinor: 10_000, bankMinor: 0 })
    assert.deepEqual(after.balances?.closing, { cashMinor: 0, bankMinor: 0 })
    assert.equal(after.activity.history.length, 1)
  })
})
