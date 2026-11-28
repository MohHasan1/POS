'use server'

import { requirePosAccess } from '@/lib/require-pos-access'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from '@/actions/products'
import type { MoneyAccountInput, MoneyAccountUpdateInput, MoneyPaymentInput } from '@/lib/money-types'
import {
  createMoneyAccount,
  createMoneyPayment,
  createMoneyPerson,
  updateMoneyAccount,
  updateMoneyPerson,
  voidMoneyAccount,
  voidMoneyPayment,
} from '@/services/money'

const optionalText = (max: number) => z.string().trim().max(max).optional()
const productSchema = z.object({
  productId: z.uuid(),
  quantityMilliunits: z.number().int().positive().max(100_000_000),
  unitPriceMinor: z.number().int().nonnegative().max(99_999_999_999).optional(),
})
const accountSchema = z.object({
  direction: z.enum(['owedToUs', 'weOwe']),
  dueDate: z.iso.date().optional(),
  idempotencyKey: z.uuid(),
  invoiceId: z.uuid().optional(),
  kind: z.enum(['unpaidInvoice', 'moneyLent', 'supplierCredit', 'borrowedMoney', 'other']),
  note: optionalText(500),
  originalAmountMinor: z.number().int().positive().max(99_999_999_999).optional(),
  personId: z.uuid(),
  products: z.array(productSchema).max(100).optional(),
  recordDate: z.iso.date(),
  reference: optionalText(120),
})
const personSchema = z.object({
  address: optionalText(300),
  email: z.string().trim().max(254).pipe(z.email().or(z.literal(''))).optional(),
  name: z.string().trim().min(1).max(160),
  note: optionalText(500),
  phone: optionalText(40),
})
const paymentSchema = z
  .object({
    accountId: z.uuid(),
    amountMinor: z.number().int().positive().max(99_999_999_999),
    bankName: optionalText(200),
    chequeDate: z.iso.date().optional(),
    chequeNumber: optionalText(200),
    createReceiptVoucher: z.boolean().optional(),
    idempotencyKey: z.uuid(),
    note: optionalText(500),
    otherDescription: optionalText(500),
    otherReference: optionalText(200),
    paymentDate: z.iso.date(),
    paymentMethod: z.enum(['cash', 'bank_transfer', 'cheque', 'other']),
    reference: optionalText(120),
    transactionReference: optionalText(200),
    transferDate: z.iso.date().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.paymentMethod === 'bank_transfer' &&
      (!value.bankName || !value.transactionReference || !value.transferDate)
    ) {
      context.addIssue({ code: 'custom', message: 'Bank name, transfer date and reference are required.' })
    }
    if (
      value.paymentMethod === 'cheque' &&
      (!value.bankName || !value.chequeDate || !value.chequeNumber)
    ) {
      context.addIssue({ code: 'custom', message: 'Bank name, cheque date and cheque number are required.' })
    }
    if (value.paymentMethod === 'other' && !value.otherDescription) {
      context.addIssue({ code: 'custom', message: 'Describe the payment method.' })
    }
  })

function resultError(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : 'Unable to update money records.' }
}

function revalidateMoney(invoiceId?: string) {
  revalidatePath('/people')
  revalidatePath('/money/owed-to-us')
  revalidatePath('/money/we-owe')
  revalidatePath('/service-board')
  revalidatePath('/reports')
  revalidatePath('/reports/cash')
  revalidatePath('/reports/print')
  revalidatePath('/')
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`)
}

export async function createMoneyPersonAction(input: {
  address?: string
  email?: string
  name: string
  note?: string
  phone?: string
}): Promise<ActionResult<{ id: string; name: string }>> {
  await requirePosAccess()
  const parsed = personSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const person = await createMoneyPerson(parsed.data)
    revalidateMoney()
    return { ok: true, data: { id: person.id, name: person.name } }
  } catch (error) {
    return resultError(error)
  }
}

export async function updateMoneyPersonAction(
  id: string,
  input: {
    active: boolean
    address?: string
    email?: string
    name: string
    note?: string
    phone?: string
  },
): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = personSchema.extend({ active: z.boolean(), id: z.uuid() }).safeParse({ id, ...input })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await updateMoneyPerson(parsed.data.id, parsed.data)
    revalidateMoney()
    return { ok: true }
  } catch (error) {
    return resultError(error)
  }
}

export async function createMoneyAccountAction(
  input: MoneyAccountInput,
): Promise<ActionResult<{ id: string }>> {
  await requirePosAccess()
  const parsed = accountSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const account = await createMoneyAccount(parsed.data)
    revalidateMoney(typeof account.invoice === 'string' ? account.invoice : account.invoice?.id)
    return { ok: true, data: { id: account.id } }
  } catch (error) {
    return resultError(error)
  }
}

export async function updateMoneyAccountAction(
  id: string,
  input: MoneyAccountUpdateInput,
): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = accountSchema
    .omit({ direction: true, idempotencyKey: true, invoiceId: true })
    .extend({ id: z.uuid() })
    .safeParse({ id, ...input })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const { id: parsedId, ...data } = parsed.data
    const account = await updateMoneyAccount(parsedId, data)
    revalidateMoney(typeof account.invoice === 'string' ? account.invoice : account.invoice?.id)
    return { ok: true }
  } catch (error) {
    return resultError(error)
  }
}

export async function voidMoneyAccountAction(id: string, reason: string): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = z.object({ id: z.uuid(), reason: z.string().trim().min(1).max(500) }).safeParse({ id, reason })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const account = await voidMoneyAccount(parsed.data.id, parsed.data.reason)
    revalidateMoney(typeof account.invoice === 'string' ? account.invoice : account.invoice?.id)
    return { ok: true }
  } catch (error) {
    return resultError(error)
  }
}

export async function createMoneyPaymentAction(
  input: MoneyPaymentInput,
): Promise<ActionResult<{ id: string }>> {
  await requirePosAccess()
  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const payment = await createMoneyPayment(parsed.data)
    revalidateMoney()
    return { ok: true, data: { id: payment.id } }
  } catch (error) {
    return resultError(error)
  }
}

export async function voidMoneyPaymentAction(id: string, reason: string): Promise<ActionResult> {
  await requirePosAccess()
  const parsed = z.object({ id: z.uuid(), reason: z.string().trim().min(1).max(500) }).safeParse({ id, reason })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    await voidMoneyPayment(parsed.data.id, parsed.data.reason)
    revalidateMoney()
    return { ok: true }
  } catch (error) {
    return resultError(error)
  }
}
