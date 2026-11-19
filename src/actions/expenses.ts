'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from '@/actions/products'
import type {
  ExpenseRecordInput,
  ExpenseTemplateInput,
  ManualExpenseRecordInput,
} from '@/lib/expense-types'
import {
  confirmExpenseOccurrence,
  createExpenseCategory,
  createManualExpense,
  createExpenseTemplate,
  setExpenseCategoryActive,
  skipExpenseOccurrence,
  updateExpense,
  updateExpenseTemplate,
  voidExpense,
} from '@/services/expenses'

const optionalText = (maxLength: number) => z.string().trim().max(maxLength).optional()

const templateSchema = z.object({
  active: z.boolean(),
  categoryId: z.uuid(),
  defaultTotalMinor: z.number().int().positive(),
  defaultVatMinor: z.number().int().min(0),
  endDate: z.iso.date().optional(),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  monthlyDay: z.number().int().min(1).max(31).optional(),
  name: z.string().trim().min(1).max(160),
  note: optionalText(500),
  startDate: z.iso.date(),
  vendor: optionalText(160),
  weeklyDay: z.number().int().min(0).max(6).optional(),
  yearlyDay: z.number().int().min(1).max(31).optional(),
  yearlyMonth: z.number().int().min(1).max(12).optional(),
})

const recordSchema = z.object({
  billDate: z.iso.date(),
  categoryId: z.uuid(),
  idempotencyKey: z.uuid(),
  name: z.string().trim().min(1).max(160),
  note: optionalText(500),
  paidAt: z.iso.date().optional(),
  paymentMethod: z.enum(['cash', 'bank', 'other']).optional(),
  paymentStatus: z.enum(['paid', 'unpaid']),
  reference: optionalText(120),
  totalMinor: z.number().int().positive(),
  vatMinor: z.number().int().min(0),
  vendor: optionalText(160),
})

function errorResult(error: unknown): ActionResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : 'Unable to update expenses.',
  }
}

function revalidateExpenses() {
  revalidatePath('/expenses')
  revalidatePath('/reports')
  revalidatePath('/reports/costs')
  revalidatePath('/')
}

export async function createExpenseCategoryAction(input: {
  description?: string
  name: string
}): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = z
    .object({
      description: optionalText(300),
      name: z.string().trim().min(1).max(100),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const category = await createExpenseCategory(parsed.data.name, parsed.data.description)
    revalidateExpenses()
    return { ok: true, data: { id: category.id, name: category.name } }
  } catch (error) {
    return errorResult(error)
  }
}

export async function setExpenseCategoryActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Choose a valid expense category.' }
  try {
    await setExpenseCategoryActive(parsed.data, active)
    revalidateExpenses()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function createExpenseTemplateAction(
  input: ExpenseTemplateInput,
): Promise<ActionResult> {
  const parsed = templateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await createExpenseTemplate(parsed.data)
    revalidateExpenses()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function updateExpenseTemplateAction(
  id: string,
  input: ExpenseTemplateInput,
): Promise<ActionResult> {
  const [parsedId, parsed] = [z.uuid().safeParse(id), templateSchema.safeParse(input)]
  if (!parsedId.success || !parsed.success) {
    return {
      ok: false,
      error: parsed.success ? 'Choose a valid recurring bill.' : parsed.error.issues[0].message,
    }
  }
  try {
    await updateExpenseTemplate(parsedId.data, parsed.data)
    revalidateExpenses()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function createManualExpenseAction(
  input: ManualExpenseRecordInput,
): Promise<ActionResult> {
  const parsed = recordSchema
    .extend({ recordType: z.enum(['variable', 'capital']) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const { recordType, ...record } = parsed.data
    await createManualExpense(record, recordType)
    revalidateExpenses()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function confirmExpenseOccurrenceAction(input: {
  dueDate: string
  record: Omit<ExpenseRecordInput, 'billDate' | 'categoryId' | 'name'>
  templateId: string
}): Promise<ActionResult> {
  const parsed = z
    .object({
      dueDate: z.iso.date(),
      record: recordSchema.omit({ billDate: true, categoryId: true, name: true }),
      templateId: z.uuid(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await confirmExpenseOccurrence(parsed.data.templateId, parsed.data.dueDate, parsed.data.record)
    revalidateExpenses()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function skipExpenseOccurrenceAction(input: {
  dueDate: string
  idempotencyKey: string
  note?: string
  templateId: string
}): Promise<ActionResult> {
  const parsed = z
    .object({
      dueDate: z.iso.date(),
      idempotencyKey: z.uuid(),
      note: optionalText(500),
      templateId: z.uuid(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await skipExpenseOccurrence(
      parsed.data.templateId,
      parsed.data.dueDate,
      parsed.data.idempotencyKey,
      parsed.data.note,
    )
    revalidateExpenses()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function updateExpenseAction(
  id: string,
  input: Omit<ExpenseRecordInput, 'idempotencyKey'> & {
    recordType?: ManualExpenseRecordInput['recordType']
  },
): Promise<ActionResult> {
  const [parsedId, parsed] = [
    z.uuid().safeParse(id),
    recordSchema
      .omit({ idempotencyKey: true })
      .extend({ recordType: z.enum(['variable', 'capital']).optional() })
      .safeParse(input),
  ]
  if (!parsedId.success || !parsed.success) {
    return {
      ok: false,
      error: parsed.success ? 'Choose a valid bill.' : parsed.error.issues[0].message,
    }
  }
  try {
    const { recordType, ...record } = parsed.data
    await updateExpense(parsedId.data, record, recordType)
    revalidateExpenses()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function voidExpenseAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.uuid(), reason: z.string().trim().min(1).max(500) })
    .safeParse({ id, reason })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await voidExpense(parsed.data.id, parsed.data.reason)
    revalidateExpenses()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}
