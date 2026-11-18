'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from './products'
import type { EmployeeSummary } from '@/lib/pos-types'
import {
  createEmployee,
  setDefaultEmployee,
  setEmployeeActive,
  updateEmployee,
  type EmployeeInput,
} from '@/services/employees'
import { getShopSettings } from '@/services/settings'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)

const employeeSchema = z.object({
  address: optionalText(500),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address.')
    .transform((value) => value || undefined),
  employeeCode: optionalText(40),
  name: z.string().trim().min(1, 'Employee name is required.').max(160),
  notes: optionalText(500),
  phone: optionalText(40),
  role: optionalText(100),
})

const quickEmployeeSchema = employeeSchema.pick({ employeeCode: true, name: true, role: true })

export type EmployeeActionInput = z.input<typeof employeeSchema>
export type QuickEmployeeActionInput = z.input<typeof quickEmployeeSchema>

function messageFrom(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unable to save the employee.'
  return /unique|employee_code/i.test(message) ? 'Employee code must be unique.' : message
}

function revalidateEmployeeData() {
  revalidatePath('/employees')
  revalidatePath('/checkout')
  revalidatePath('/service-board')
  revalidatePath('/invoices')
}

export async function createEmployeeAction(
  input: EmployeeActionInput,
): Promise<ActionResult<EmployeeSummary>> {
  const parsed = employeeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const employee = await createEmployee(parsed.data as EmployeeInput)
    revalidateEmployeeData()
    return { ok: true, data: employee }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}

export async function quickCreateEmployeeAction(
  input: QuickEmployeeActionInput,
): Promise<ActionResult<EmployeeSummary>> {
  const parsed = quickEmployeeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const employee = await createEmployee({
      ...parsed.data,
      address: undefined,
      email: undefined,
      notes: undefined,
      phone: undefined,
    })
    revalidateEmployeeData()
    return { ok: true, data: employee }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}

export async function updateEmployeeAction(
  id: string,
  input: EmployeeActionInput,
): Promise<ActionResult<EmployeeSummary>> {
  const parsed = z.uuid().safeParse(id)
  const data = employeeSchema.safeParse(input)
  if (!parsed.success || !data.success) {
    return { ok: false, error: data.success ? 'Select a valid employee.' : data.error.issues[0].message }
  }
  try {
    const employee = await updateEmployee(parsed.data, data.data as EmployeeInput)
    revalidateEmployeeData()
    return { ok: true, data: employee }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}

export async function setEmployeeActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Select a valid employee.' }
  try {
    await setEmployeeActive(parsed.data, active, await getShopSettings())
    revalidateEmployeeData()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}

export async function setDefaultEmployeeAction(
  employeeId: null | string,
): Promise<ActionResult> {
  const parsed = z.uuid().nullable().safeParse(employeeId)
  if (!parsed.success) return { ok: false, error: 'Select a valid employee.' }
  try {
    await setDefaultEmployee(parsed.data)
    revalidateEmployeeData()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: messageFrom(error) }
  }
}
