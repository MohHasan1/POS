'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from '@/actions/products'
import { cashAccountSchema, cashAmountSchema, cashClosingSchema, cashMovementSchema, dailyCashOpeningSchema, type CashClosingInput, type CashOpeningInput, type CashMovementInput, type CashBalances, type DailyCashOpeningInput } from '@/lib/cash'
import { todayDateInput } from '@/lib/calendar'
import { requirePosAccess } from '@/lib/require-pos-access'
import { closeCashDay, getPreviousClosingCash } from '@/services/cash-closing'
import { getCashMovementBalances, recordCashMovement, saveDailyCashOpening, startCashTracking } from '@/services/cash-report'
import { classifyCashSales, confirmBankReceipt } from '@/services/cash-sale-review'
import { getMarketContext } from '@/services/settings'

const openingSchema = z.object({
  bankMinor: cashAmountSchema, cashMinor: cashAmountSchema.nonnegative(),
  basis: z.enum(['startOfDay', 'countNow']),
})

function errorMessage(error: unknown) {
  return { ok: false as const, error: error instanceof Error ? error.message : 'Unable to save cash activity.' }
}

export async function startCashTrackingAction(input: CashOpeningInput): Promise<ActionResult> {
  await requirePosAccess('/reports/cash')
  const parsed = openingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Enter valid starting balances.' }
  try {
    await startCashTracking(parsed.data)
    revalidatePath('/checkout')
    revalidatePath('/service-board')
    revalidatePath('/expenses')
    revalidatePath('/reports/cash')
    return { ok: true }
  } catch (error) {
    return errorMessage(error)
  }
}

export async function saveDailyCashOpeningAction(input: DailyCashOpeningInput): Promise<ActionResult> {
  await requirePosAccess('/reports/cash')
  const parsed = dailyCashOpeningSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Enter valid opening balances.' }
  try {
    await saveDailyCashOpening(parsed.data)
    revalidatePath('/reports/cash')
    return { ok: true }
  } catch (error) {
    return errorMessage(error)
  }
}

export async function getCashMovementBalancesAction(date: string): Promise<ActionResult<CashBalances | null>> {
  await requirePosAccess('/reports/cash')
  try {
    const { profile } = await getMarketContext()
    const now = new Date()
    if (!z.iso.date().safeParse(date).success || date > todayDateInput(profile, now)) {
      return { ok: false, error: 'Choose today or an earlier date.' }
    }
    return { ok: true, data: await getCashMovementBalances(profile, date, now) }
  } catch (error) {
    return errorMessage(error)
  }
}

export async function getPreviousClosingCashAction(date: string): Promise<ActionResult<number | null>> {
  await requirePosAccess('/reports/cash')
  try {
    const { profile } = await getMarketContext()
    if (!z.iso.date().safeParse(date).success || date > todayDateInput(profile)) {
      return { ok: false, error: 'Choose today or an earlier date.' }
    }
    return { ok: true, data: await getPreviousClosingCash(date, profile) }
  } catch (error) {
    return errorMessage(error)
  }
}

export async function recordCashMovementAction(input: CashMovementInput): Promise<ActionResult> {
  await requirePosAccess('/reports/cash')
  const parsed = cashMovementSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Check the amount, date, and account.' }
  try {
    await recordCashMovement(parsed.data)
    revalidatePath('/reports/cash')
    return { ok: true }
  } catch (error) {
    return errorMessage(error)
  }
}

export async function closeCashDayAction(input: CashClosingInput) {
  await requirePosAccess('/reports/cash')
  const parsed = cashClosingSchema.safeParse(input)
  if (!parsed.success) return { status: 'invalid' as const }
  try {
    const result = await closeCashDay(parsed.data)
    if (result.status === 'saved' || result.status === 'alreadyClosed') revalidatePath('/reports/cash')
    return result
  } catch (error) {
    console.error('Could not save the cash closing.', error)
    return { status: 'failed' as const }
  }
}

export async function classifyCashSalesAction(input: { invoiceIds: string[]; account: 'cash' | 'bank' }): Promise<ActionResult> {
  await requirePosAccess('/reports/cash')
  const parsed = z.object({ invoiceIds: z.array(z.uuid()).min(1).max(200), account: cashAccountSchema }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Select the sales and choose Cash or Bank.' }
  try {
    await classifyCashSales(parsed.data.invoiceIds, parsed.data.account)
    revalidatePath('/reports/cash')
    return { ok: true }
  } catch (error) {
    return errorMessage(error)
  }
}

export async function confirmBankReceiptAction(input: { invoiceId: string; date: string; amountMinor: number }): Promise<ActionResult> {
  await requirePosAccess('/reports/cash')
  const parsed = z.object({ invoiceId: z.uuid(), date: z.iso.date(), amountMinor: cashAmountSchema.positive() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Enter a valid receipt date and amount.' }
  try {
    const { invoiceId, date, amountMinor } = parsed.data
    await confirmBankReceipt(invoiceId, date, amountMinor)
    revalidatePath('/reports/cash')
    return { ok: true }
  } catch (error) {
    return errorMessage(error)
  }
}
