import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { todayDateInput } from '@/lib/calendar'
import { MARKET_PROFILES } from '@/lib/market'
import {
  confirmExpenseOccurrence,
  createExpenseCategory,
  createManualExpense,
  createExpenseTemplate,
  createVariableExpense,
  getDueExpenseOccurrences,
  skipExpenseOccurrence,
  updateExpense,
  voidExpense,
} from '@/services/expenses'
import { updateShopSettings } from '@/services/settings'

const expenseIds: string[] = []
const templateIds: string[] = []
const categoryIds: string[] = []

describe('expense management', () => {
  after(async () => {
    const payload = await getPayload({ config })
    for (const id of expenseIds) await payload.delete({ collection: 'expenses', id })
    for (const id of templateIds) await payload.delete({ collection: 'expense-templates', id })
    for (const id of categoryIds) await payload.delete({ collection: 'expense-categories', id })
  })

  it('records and edits a variable bill idempotently, then voids it', async () => {
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر المصروفات',
      sellerNameEnglish: 'Expense Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
    const category = await createExpenseCategory(`Test utilities ${randomUUID()}`)
    categoryIds.push(category.id)
    const date = todayDateInput(MARKET_PROFILES.SA)
    const input = {
      billDate: date,
      categoryId: category.id,
      idempotencyKey: randomUUID(),
      name: 'Electricity',
      paymentStatus: 'unpaid' as const,
      totalMinor: 11_500,
      vatMinor: 1_500,
    }
    const expense = await createVariableExpense(input)
    expenseIds.push(expense.id)
    assert.equal(expense.netMinor, 10_000)
    assert.equal((await createVariableExpense(input)).id, expense.id)

    const capital = await createManualExpense(
      {
        ...input,
        idempotencyKey: randomUUID(),
        name: 'Shop setup',
      },
      'capital',
    )
    expenseIds.push(capital.id)
    assert.equal(capital.recordType, 'capital')

    const updated = await updateExpense(expense.id, {
      ...input,
      paidAt: date,
      paymentMethod: 'bank',
      paymentStatus: 'paid',
      reference: 'BANK-1',
    })
    assert.equal(updated.paymentStatus, 'paid')
    assert.equal(updated.paymentMethod, 'bank')
    assert.equal((await voidExpense(expense.id, 'Entered twice')).status, 'voided')
  })

  it('requires each recurring occurrence to be confirmed or skipped once', async () => {
    const category = await createExpenseCategory(`Test rent ${randomUUID()}`)
    categoryIds.push(category.id)
    const dueDate = todayDateInput(MARKET_PROFILES.SA)
    const schedule = {
      active: true,
      categoryId: category.id,
      defaultTotalMinor: 23_000,
      defaultVatMinor: 3_000,
      frequency: 'monthly' as const,
      monthlyDay: Number(dueDate.slice(8, 10)),
      name: `Rent ${randomUUID()}`,
      startDate: dueDate,
    }
    const confirmedTemplate = await createExpenseTemplate(schedule)
    templateIds.push(confirmedTemplate.id)
    const due = (await getDueExpenseOccurrences()).find(
      ({ templateId }) => templateId === confirmedTemplate.id,
    )
    assert.equal(due?.dueDate, dueDate)
    const confirmed = await confirmExpenseOccurrence(confirmedTemplate.id, dueDate, {
      idempotencyKey: randomUUID(),
      paymentStatus: 'unpaid',
      totalMinor: 23_000,
      vatMinor: 3_000,
    })
    expenseIds.push(confirmed.id)
    assert.equal(confirmed.recordType, 'fixed')
    assert.equal(confirmed.netMinor, 20_000)

    const skippedTemplate = await createExpenseTemplate({
      ...schedule,
      name: `Maintenance ${randomUUID()}`,
    })
    templateIds.push(skippedTemplate.id)
    const skipped = await skipExpenseOccurrence(
      skippedTemplate.id,
      dueDate,
      randomUUID(),
      'Not charged',
    )
    expenseIds.push(skipped.id)
    assert.equal(skipped.status, 'skipped')
    assert.equal(skipped.netMinor, 0)

    const remaining = await getDueExpenseOccurrences()
    assert.equal(
      remaining.some(({ templateId }) => templateId === confirmedTemplate.id),
      false,
    )
    assert.equal(
      remaining.some(({ templateId }) => templateId === skippedTemplate.id),
      false,
    )
  })
})
