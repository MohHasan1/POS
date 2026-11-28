import config from '@payload-config'
import { getPayload, type PayloadRequest } from 'payload'

import { dateInputToISOString, todayDateInput, toMarketDateInput } from '@/lib/calendar'
import { expenseOccurrenceKey, recurringOccurrenceDates } from '@/lib/expense-recurrence'
import type {
  DueExpenseOccurrence,
  ExpenseRecordInput,
  ExpenseTemplateInput,
  ManualExpenseRecordType,
} from '@/lib/expense-types'
import type { Expense, ExpenseCategory, ExpenseTemplate } from '@/payload-types'

import { areShopSettingsComplete, getShopSettings, marketContextFromSettings } from './settings'

const DEFAULT_CATEGORIES = [
  'Rent',
  'Utilities',
  'Supplies',
  'Maintenance',
  'Marketing',
  'Transport',
  'Other',
]

function relationshipId(value: { id: string } | null | string | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.id
}

function normalizeOptional(value: null | string | undefined): string | undefined {
  return value?.trim() || undefined
}

async function expenseMarket(req?: Partial<PayloadRequest>) {
  const settings = req?.payload
    ? await req.payload.findGlobal({ slug: 'shop-settings', depth: 0, req })
    : await getShopSettings()
  if (!areShopSettingsComplete(settings)) {
    throw new Error('Complete business setup before recording expenses.')
  }
  return marketContextFromSettings(settings).profile
}

export async function ensureDefaultExpenseCategories(): Promise<void> {
  const payload = await getPayload({ config })
  const count = await payload.count({ collection: 'expense-categories' })
  if (count.totalDocs) return
  for (const name of DEFAULT_CATEGORIES) {
    await payload.create({ collection: 'expense-categories', data: { name, active: true } })
  }
}

export async function getExpenseCategories(includeInactive = false): Promise<ExpenseCategory[]> {
  await ensureDefaultExpenseCategories()
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'expense-categories',
    pagination: false,
    sort: 'name',
    where: includeInactive ? undefined : { active: { equals: true } },
  })
  return result.docs
}

export async function createExpenseCategory(
  name: string,
  description?: string,
): Promise<ExpenseCategory> {
  const payload = await getPayload({ config })
  return payload.create({
    collection: 'expense-categories',
    data: { active: true, description: normalizeOptional(description), name: name.trim() },
  })
}

export async function setExpenseCategoryActive(
  id: string,
  active: boolean,
): Promise<ExpenseCategory> {
  const payload = await getPayload({ config })
  return payload.update({ collection: 'expense-categories', id, data: { active } })
}

async function activeCategory(id: string, req?: Partial<PayloadRequest>): Promise<ExpenseCategory> {
  const payload = req?.payload ?? await getPayload({ config })
  const category = await payload.findByID({ collection: 'expense-categories', id, req })
  if (!category.active) throw new Error('Choose an active expense category.')
  return category
}

function validateTemplateSchedule(input: ExpenseTemplateInput): void {
  if (input.endDate && input.endDate < input.startDate) {
    throw new Error('The recurring end date cannot be before the start date.')
  }
  if (
    input.frequency === 'weekly' &&
    (input.weeklyDay === undefined || input.weeklyDay < 0 || input.weeklyDay > 6)
  ) {
    throw new Error('Choose a weekday for the recurring bill.')
  }
  if (
    input.frequency === 'monthly' &&
    (input.monthlyDay === undefined || input.monthlyDay < 1 || input.monthlyDay > 31)
  ) {
    throw new Error('Choose a monthly due day from 1 to 31.')
  }
  if (
    input.frequency === 'yearly' &&
    (input.yearlyMonth === undefined ||
      input.yearlyMonth < 1 ||
      input.yearlyMonth > 12 ||
      input.yearlyDay === undefined ||
      input.yearlyDay < 1 ||
      input.yearlyDay > 31)
  ) {
    throw new Error('Choose a valid month and day for the yearly bill.')
  }
}

async function templateData(input: ExpenseTemplateInput) {
  const profile = await expenseMarket()
  await activeCategory(input.categoryId)
  validateTemplateSchedule(input)
  if (!Number.isSafeInteger(input.defaultTotalMinor) || input.defaultTotalMinor < 1) {
    throw new Error('Enter a recurring bill amount greater than zero.')
  }
  const vatMinor = profile.taxMode === 'none' ? 0 : input.defaultVatMinor
  if (!Number.isSafeInteger(vatMinor) || vatMinor < 0 || vatMinor > input.defaultTotalMinor) {
    throw new Error('VAT cannot exceed the bill total.')
  }
  return {
    active: input.active,
    category: input.categoryId,
    defaultTotalMinor: input.defaultTotalMinor,
    defaultVatMinor: vatMinor,
    endDate: input.endDate ? dateInputToISOString(input.endDate, profile) : null,
    frequency: input.frequency,
    monthlyDay: input.frequency === 'monthly' ? input.monthlyDay : null,
    name: input.name.trim(),
    note: normalizeOptional(input.note),
    startDate: dateInputToISOString(input.startDate, profile),
    vendor: normalizeOptional(input.vendor),
    weeklyDay: input.frequency === 'weekly' ? input.weeklyDay : null,
    yearlyDay: input.frequency === 'yearly' ? input.yearlyDay : null,
    yearlyMonth: input.frequency === 'yearly' ? input.yearlyMonth : null,
  }
}

export async function createExpenseTemplate(input: ExpenseTemplateInput): Promise<ExpenseTemplate> {
  const payload = await getPayload({ config })
  return payload.create({ collection: 'expense-templates', data: await templateData(input) })
}

export async function updateExpenseTemplate(
  id: string,
  input: ExpenseTemplateInput,
): Promise<ExpenseTemplate> {
  const payload = await getPayload({ config })
  return payload.update({ collection: 'expense-templates', id, data: await templateData(input) })
}

export async function getExpenseTemplates(includeInactive = false): Promise<ExpenseTemplate[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'expense-templates',
    depth: 1,
    pagination: false,
    sort: 'name',
    where: includeInactive ? undefined : { active: { equals: true } },
  })
  return result.docs
}

function validateRecordAmounts(input: ExpenseRecordInput, taxMode: string) {
  if (!Number.isSafeInteger(input.totalMinor) || input.totalMinor < 1) {
    throw new Error('Enter a bill amount greater than zero.')
  }
  const vatMinor = taxMode === 'none' ? 0 : input.vatMinor
  if (!Number.isSafeInteger(vatMinor) || vatMinor < 0 || vatMinor > input.totalMinor) {
    throw new Error('VAT cannot exceed the bill total.')
  }
  if (input.paymentStatus === 'paid' && !input.paidAt) {
    throw new Error('Choose the payment date for a paid bill.')
  }
  return { netMinor: input.totalMinor - vatMinor, vatMinor }
}

async function recordData(input: ExpenseRecordInput, req?: Partial<PayloadRequest>) {
  const profile = await expenseMarket(req)
  const category = await activeCategory(input.categoryId, req)
  const amounts = validateRecordAmounts(input, profile.taxMode)
  return {
    ...amounts,
    billDate: dateInputToISOString(input.billDate, profile),
    cashPayment: input.paymentStatus === 'paid' ? input.cashPaymentId ?? null : null,
    category: category.id,
    categorySnapshot: { name: category.name },
    countryCode: profile.countryCode,
    currencyCode: profile.currencyCode,
    currencyMinorUnitDigits: profile.minorUnitDigits,
    idempotencyKey: input.idempotencyKey,
    name: input.name.trim(),
    note: normalizeOptional(input.note),
    paidAt:
      input.paymentStatus === 'paid'
        ? dateInputToISOString(input.paidAt || input.billDate, profile)
        : null,
    paymentMethod: input.paymentStatus === 'paid' ? input.paymentMethod || 'cash' : null,
    paymentStatus: input.paymentStatus,
    reference: normalizeOptional(input.reference),
    status: 'confirmed' as const,
    timeZone: profile.timeZone,
    totalMinor: input.totalMinor,
    vendor: normalizeOptional(input.vendor),
  }
}

export async function createManualExpense(
  input: ExpenseRecordInput,
  recordType: ManualExpenseRecordType,
  req?: Partial<PayloadRequest>,
): Promise<Expense> {
  const payload = req?.payload ?? await getPayload({ config })
  const duplicate = await payload.find({
    collection: 'expenses',
    limit: 1,
    req,
    where: { idempotencyKey: { equals: input.idempotencyKey } },
  })
  if (duplicate.docs[0]) return duplicate.docs[0]
  return payload.create({
    collection: 'expenses',
    data: { ...(await recordData(input, req)), recordType },
    req,
  })
}

export function createVariableExpense(input: ExpenseRecordInput): Promise<Expense> {
  return createManualExpense(input, 'variable')
}

export async function getDueExpenseOccurrences(): Promise<DueExpenseOccurrence[]> {
  const [templates, profile] = await Promise.all([getExpenseTemplates(), expenseMarket()])
  const payload = await getPayload({ config })
  const recorded = await payload.find({
    collection: 'expenses',
    pagination: false,
    where: { occurrenceKey: { exists: true } },
  })
  const keys = new Set(
    recorded.docs.flatMap(({ occurrenceKey }) => (occurrenceKey ? [occurrenceKey] : [])),
  )
  const today = todayDateInput(profile)
  return templates
    .flatMap((template) => {
      const categoryId = relationshipId(template.category)
      const categoryName = typeof template.category === 'string' ? 'Other' : template.category.name
      if (!categoryId) return []
      return recurringOccurrenceDates(template, profile, today).flatMap((dueDate) => {
        if (keys.has(expenseOccurrenceKey(template.id, dueDate))) return []
        return [
          {
            categoryId,
            categoryName,
            dueDate,
            market: profile,
            name: template.name,
            note: normalizeOptional(template.note),
            templateId: template.id,
            totalMinor: template.defaultTotalMinor,
            vatMinor: template.defaultVatMinor,
            vendor: normalizeOptional(template.vendor),
          },
        ]
      })
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name))
}

async function templateForOccurrence(
  templateId: string,
  dueDate: string,
): Promise<{
  profile: Awaited<ReturnType<typeof expenseMarket>>
  template: ExpenseTemplate
}> {
  const payload = await getPayload({ config })
  const [template, profile] = await Promise.all([
    payload.findByID({ collection: 'expense-templates', id: templateId, depth: 1 }),
    expenseMarket(),
  ])
  if (!recurringOccurrenceDates(template, profile, dueDate).includes(dueDate)) {
    throw new Error('This date is not a valid occurrence for the recurring bill.')
  }
  return { profile, template }
}

export async function confirmExpenseOccurrence(
  templateId: string,
  dueDate: string,
  input: Omit<ExpenseRecordInput, 'billDate' | 'categoryId' | 'name'>,
): Promise<Expense> {
  const { template } = await templateForOccurrence(templateId, dueDate)
  const categoryId = relationshipId(template.category)
  if (!categoryId) throw new Error('The recurring bill category is missing.')
  const payload = await getPayload({ config })
  return payload.create({
    collection: 'expenses',
    data: {
      ...(await recordData({
        ...input,
        billDate: dueDate,
        categoryId,
        name: template.name,
        vendor: input.vendor || template.vendor || undefined,
      })),
      occurrenceKey: expenseOccurrenceKey(template.id, dueDate),
      recordType: 'fixed',
      template: template.id,
    },
  })
}

export async function skipExpenseOccurrence(
  templateId: string,
  dueDate: string,
  idempotencyKey: string,
  note?: string,
): Promise<Expense> {
  const { profile, template } = await templateForOccurrence(templateId, dueDate)
  const categoryId = relationshipId(template.category)
  const categoryName = typeof template.category === 'string' ? 'Other' : template.category.name
  if (!categoryId) throw new Error('The recurring bill category is missing.')
  const payload = await getPayload({ config })
  return payload.create({
    collection: 'expenses',
    data: {
      billDate: dateInputToISOString(dueDate, profile),
      category: categoryId,
      categorySnapshot: { name: categoryName },
      countryCode: profile.countryCode,
      currencyCode: profile.currencyCode,
      currencyMinorUnitDigits: profile.minorUnitDigits,
      idempotencyKey,
      name: template.name,
      netMinor: 0,
      note: normalizeOptional(note),
      occurrenceKey: expenseOccurrenceKey(template.id, dueDate),
      paymentStatus: 'unpaid',
      recordType: 'fixed',
      status: 'skipped',
      template: template.id,
      timeZone: profile.timeZone,
      totalMinor: 0,
      vatMinor: 0,
      vendor: normalizeOptional(template.vendor),
    },
  })
}

export async function updateExpense(
  id: string,
  input: Omit<ExpenseRecordInput, 'idempotencyKey'>,
  recordType?: ManualExpenseRecordType,
): Promise<Expense> {
  const payload = await getPayload({ config })
  const current = await payload.findByID({ collection: 'expenses', id })
  if (current.status !== 'confirmed') throw new Error('Only confirmed expenses can be edited.')
  const data = await recordData({ ...input, idempotencyKey: current.idempotencyKey })
  return payload.update({
    collection: 'expenses',
    id,
    data: {
      ...data,
      idempotencyKey: current.idempotencyKey,
      occurrenceKey: current.occurrenceKey,
      recordType: current.recordType === 'fixed' ? 'fixed' : recordType || current.recordType,
      template: relationshipId(current.template),
    },
  })
}

export async function voidExpense(id: string, reason: string): Promise<Expense> {
  const payload = await getPayload({ config })
  const current = await payload.findByID({ collection: 'expenses', id })
  if (current.status !== 'confirmed') throw new Error('Only confirmed expenses can be voided.')
  return payload.update({
    collection: 'expenses',
    id,
    data: { status: 'voided', voidReason: reason.trim(), cashPayment: null },
  })
}

export async function getExpenses(): Promise<Expense[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'expenses',
    depth: 1,
    pagination: false,
    sort: '-billDate,-createdAt',
  })
  return result.docs
}

export function expenseDateInput(
  expense: Expense,
  profile: Parameters<typeof toMarketDateInput>[1],
) {
  return toMarketDateInput(expense.billDate, profile)
}
