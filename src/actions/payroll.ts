'use server'

import { requirePosAccess } from '@/lib/require-pos-access'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from './products'
import type { CompensationType, PayrollPaymentMethod } from '@/lib/payroll-types'
import {
  createMonthlySalary,
  createPayrollPayout,
  getCommissionRates,
  saveCompensationPlan,
  updatePayrollEntry,
  upsertCommissionOverride,
} from '@/services/payroll'

const compensationSchema = z.object({
  compensationType: z.enum(['unconfigured', 'monthly', 'commission']),
  employeeId: z.uuid(),
  monthlySalaryMinor: z.number().int().positive().nullable(),
  rates: z.array(
    z.object({ productId: z.uuid(), rateBps: z.number().int().min(0).max(10_000) }),
  ),
})

const entrySchema = z.object({
  amountMinor: z.number().int().positive(),
  employeeId: z.uuid(),
  entryDate: z.iso.date(),
  idempotencyKey: z.uuid(),
  note: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(['cash', 'bank', 'other']).optional(),
  reference: z.string().trim().max(120).optional(),
  salaryMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

const monthlySchema = z.object({
  amountMinor: z.number().int().positive(),
  employeeId: z.uuid(),
  idempotencyKey: z.uuid(),
  note: z.string().trim().max(500).optional(),
  salaryMonth: z.string().regex(/^\d{4}-\d{2}$/),
  payout: entrySchema.omit({ employeeId: true, salaryMonth: true }).optional(),
})

function errorResult(error: unknown): ActionResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : 'Unable to update payroll.',
  }
}

function revalidatePayroll() {
  revalidatePath('/payroll')
  revalidatePath('/employees')
  revalidatePath('/')
}

export async function getEmployeeCommissionRatesAction(
  employeeId: string,
): Promise<ActionResult<Array<{ productId: string; rateBps: number }>>> {
  await requirePosAccess()
  const parsed = z.uuid().safeParse(employeeId)
  if (!parsed.success) return { ok: false, error: 'Select a valid employee.' }
  try {
    const rates = await getCommissionRates(parsed.data)
    return {
      ok: true,
      data: rates.flatMap((rate) => {
        if (!rate.active) return []
        const productId = typeof rate.product === 'string' ? rate.product : rate.product.id
        return [{ productId, rateBps: rate.rateBps }]
      }),
    }
  } catch (error) {
    return errorResult(error)
  }
}

export async function saveCompensationPlanAction(input: {
  compensationType: CompensationType
  employeeId: string
  monthlySalaryMinor: number | null
  rates: Array<{ productId: string; rateBps: number }>
}): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = compensationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await saveCompensationPlan(
      parsed.data.employeeId,
      parsed.data.compensationType,
      parsed.data.monthlySalaryMinor,
      parsed.data.rates,
    )
    revalidatePayroll()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export type PayrollEntryActionInput = {
  amountMinor: number
  employeeId: string
  entryDate: string
  idempotencyKey: string
  note?: string
  paymentMethod?: PayrollPaymentMethod
  reference?: string
  salaryMonth?: string
}

export async function recordPayoutAction(input: PayrollEntryActionInput): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = entrySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await createPayrollPayout(parsed.data)
    revalidatePayroll()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function recordMonthlySalaryAction(input: {
  amountMinor: number
  employeeId: string
  idempotencyKey: string
  note?: string
  payout?: Omit<PayrollEntryActionInput, 'employeeId' | 'salaryMonth'>
  salaryMonth: string
}): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = monthlySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await createMonthlySalary(parsed.data)
    revalidatePayroll()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function updatePayrollEntryAction(
  id: string,
  input: Omit<PayrollEntryActionInput, 'idempotencyKey'>,
): Promise<ActionResult> {
  await requirePosAccess()
  const parsedId = z.uuid().safeParse(id)
  const parsed = entrySchema.omit({ idempotencyKey: true }).safeParse(input)
  if (!parsedId.success || !parsed.success) {
    return { ok: false, error: parsed.success ? 'Select a valid payroll entry.' : parsed.error.issues[0].message }
  }
  try {
    await updatePayrollEntry(parsedId.data, parsed.data)
    revalidatePayroll()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function correctCommissionAction(input: {
  correctedAmountMinor: number
  invoiceId: string
  invoiceItemId: string
  note?: string
}): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = z.object({
    correctedAmountMinor: z.number().int().min(0),
    invoiceId: z.uuid(),
    invoiceItemId: z.string().trim().min(1).max(100),
    note: z.string().trim().max(500).optional(),
  }).safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await upsertCommissionOverride(parsed.data)
    revalidatePayroll()
    return { ok: true }
  } catch (error) {
    return errorResult(error)
  }
}
