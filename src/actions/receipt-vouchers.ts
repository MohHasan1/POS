'use server'

import { revalidatePath } from 'next/cache'

import type { ActionResult } from '@/actions/products'
import {
  createReceiptVoucherSchema,
  receiptVoucherDetailsSchema,
  type CreateReceiptVoucherInput,
  type ReceiptVoucherDetailsInput,
  voidReceiptVoucherSchema,
} from '@/lib/receipt-voucher-validation'
import {
  createReceiptVoucherDraft,
  issueReceiptVoucher,
  updateReceiptVoucherDraft,
  voidReceiptVoucher,
} from '@/services/receipt-vouchers'

export async function createReceiptVoucherDraftAction(
  input: CreateReceiptVoucherInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createReceiptVoucherSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const voucher = await createReceiptVoucherDraft(parsed.data)
    revalidatePath('/receipt-vouchers')
    return { ok: true, data: { id: voucher.id } }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to save the receipt voucher draft.',
    }
  }
}

export async function updateReceiptVoucherDraftAction(
  id: string,
  input: ReceiptVoucherDetailsInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = receiptVoucherDetailsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const voucher = await updateReceiptVoucherDraft(id, parsed.data)
    revalidatePath('/receipt-vouchers')
    revalidatePath(`/receipt-vouchers/${id}`)
    return { ok: true, data: { id: voucher.id } }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to update the receipt voucher draft.',
    }
  }
}

export async function issueReceiptVoucherAction(id: string): Promise<ActionResult> {
  try {
    await issueReceiptVoucher(id)
    revalidatePath('/receipt-vouchers')
    revalidatePath(`/receipt-vouchers/${id}`)
    return { ok: true, data: undefined }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to issue the receipt voucher.',
    }
  }
}

export async function voidReceiptVoucherAction(input: {
  id: string
  reason: string
}): Promise<ActionResult> {
  const parsed = voidReceiptVoucherSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    await voidReceiptVoucher(parsed.data.id, parsed.data.reason)
    revalidatePath('/receipt-vouchers')
    revalidatePath(`/receipt-vouchers/${parsed.data.id}`)
    return { ok: true, data: undefined }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to void the receipt voucher.',
    }
  }
}
