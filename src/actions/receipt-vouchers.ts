'use server'

import { revalidatePath } from 'next/cache'

import type { ActionResult } from '@/actions/products'
import {
  finalizeReceiptVoucherSchema,
  type FinalizeReceiptVoucherInput,
  voidReceiptVoucherSchema,
} from '@/lib/receipt-voucher-validation'
import { finalizeReceiptVoucher, voidReceiptVoucher } from '@/services/receipt-vouchers'

export async function finalizeReceiptVoucherAction(
  input: FinalizeReceiptVoucherInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = finalizeReceiptVoucherSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const voucher = await finalizeReceiptVoucher(parsed.data)
    revalidatePath('/receipt-vouchers')
    return { ok: true, data: { id: voucher.id } }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to finalize the receipt voucher.',
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
