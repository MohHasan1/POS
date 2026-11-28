import { z } from 'zod'

export const cashAccountSchema = z.enum(['cash', 'bank'])
export type CashAccount = z.infer<typeof cashAccountSchema>

export const cashKinds = [
  'opening', 'sale', 'payment', 'expense', 'payroll', 'income', 'outflow', 'transfer',
  'reconcile', 'correction', 'ownerPickup',
] as const

export const cashAmountSchema = z.number().int().min(-99_999_999_999).max(99_999_999_999)
const movementDetails = {
  id: z.uuid(),
  date: z.iso.date(),
  note: z.string().trim().max(500),
}

const singleAccountMovementSchema = z.discriminatedUnion('kind', [
  z.object({
    ...movementDetails,
    kind: z.enum(['income', 'outflow', 'transfer']),
    account: cashAccountSchema,
    amountMinor: cashAmountSchema.positive(),
  }),
  z.object({
    ...movementDetails,
    kind: z.literal('reconcile'),
    account: cashAccountSchema,
    amountMinor: cashAmountSchema,
  }).refine(({ account, amountMinor }) => account === 'bank' || amountMinor >= 0),
])

const combinedMovementSchema = z.discriminatedUnion('kind', [
  z.object({
    ...movementDetails,
    kind: z.enum(['income', 'outflow']),
    cashMinor: cashAmountSchema.nonnegative().optional(),
    bankMinor: cashAmountSchema.nonnegative().optional(),
  }).refine(({ cashMinor, bankMinor }) => (cashMinor ?? 0) > 0 || (bankMinor ?? 0) > 0),
  z.object({
    ...movementDetails,
    kind: z.literal('reconcile'),
    cashMinor: cashAmountSchema.nonnegative().optional(),
    bankMinor: cashAmountSchema.optional(),
  }).refine(({ cashMinor, bankMinor }) => cashMinor !== undefined || bankMinor !== undefined),
])

export const cashMovementSchema = z.union([singleAccountMovementSchema, combinedMovementSchema])
export type CashMovementInput = z.infer<typeof cashMovementSchema>

export type CashBalances = { cashMinor: number; bankMinor: number }
export type CashOpeningBasis = 'startOfDay' | 'countNow'
export type CashOpeningInput = CashBalances & { basis: CashOpeningBasis }

export const dailyCashOpeningSchema = z.object({
  date: z.iso.date(),
  cashMinor: cashAmountSchema.nonnegative(),
  bankMinor: cashAmountSchema,
})
export type DailyCashOpeningInput = z.infer<typeof dailyCashOpeningSchema>

export const cashClosingSchema = z.object({
  requestId: z.uuid(),
  revision: z.uuid().optional(),
  businessDate: z.iso.date(),
  expectedCashMinor: z.int(),
  actualCashMinor: cashAmountSchema.nonnegative(),
  ownerPickupMinor: cashAmountSchema.nonnegative(),
  nextDayCashMinor: cashAmountSchema.nonnegative().optional(),
  expectedBankMinor: z.int().optional(),
  actualBankMinor: cashAmountSchema.optional(),
  bankPickupMinor: cashAmountSchema.nonnegative().optional(),
  note: z.string().trim().max(500),
}).refine(({ actualCashMinor, ownerPickupMinor, nextDayCashMinor, expectedBankMinor, actualBankMinor, bankPickupMinor }) =>
  ownerPickupMinor + (nextDayCashMinor ?? 0) <= actualCashMinor &&
  (expectedBankMinor === undefined) === (actualBankMinor === undefined) &&
  (bankPickupMinor ?? 0) <= Math.max(0, actualBankMinor ?? 0),
)

export type CashClosingInput = z.infer<typeof cashClosingSchema>

export function cashAccountForPayment(method: string | null | undefined): CashAccount | undefined {
  if (method === 'cash') return 'cash'
  if (method === 'bank' || method === 'bank_transfer') return 'bank'
}

export function cashDeltas(account: CashAccount, amount: number): CashBalances {
  return account === 'cash' ? { cashMinor: amount, bankMinor: 0 } : { cashMinor: 0, bankMinor: amount }
}
