import config from '@payload-config'
import { randomUUID } from 'node:crypto'
import { getPayload, type PayloadRequest } from 'payload'
import { z } from 'zod'

import { todayDateInput } from '@/lib/calendar'
import type { MarketProfile } from '@/lib/market'
import { SUPPLY_HISTORY_PAGE_SIZE, type SupplyPurchaseInput } from '@/lib/supply-stock'
import {
  SUPPLY_LABEL_LIMIT,
  SUPPLY_NAME_LIMIT,
  SUPPLY_NOTES_LIMIT,
  SUPPLY_VENDOR_LIMIT,
  summarizeSupplyCosts,
  summarizeSupplyOverview,
  summarizeSupplyUsage,
  type SupplySettingsInput,
  type SupplyUsageDetails,
  type SupplyUsageTimeline,
} from '@/lib/supplies'

import { createManualExpense } from './expenses'

const supplyIdSchema = z.uuid()
const lifespanSchema = z.int().positive().nullable()
const costSchema = z.int().nonnegative().max(99_999_999_999).nullable().optional()
const settingsSchema = z.object({
  name: z.string().trim().min(1).max(SUPPLY_NAME_LIMIT),
  expectedLifespanDays: lifespanSchema,
  defaultUnitCostMinor: costSchema,
})
const usageFieldsSchema = z.object({
  label: z.string().trim().max(SUPPLY_LABEL_LIMIT).transform((value) => value || null).nullable(),
  vendor: z.string().trim().max(SUPPLY_VENDOR_LIMIT).transform((value) => value || null).nullish(),
  notes: z.string().trim().max(SUPPLY_NOTES_LIMIT).transform((value) => value || null).nullish(),
  expectedLifespanDays: lifespanSchema.optional(),
  unitCostMinor: costSchema,
})
const usageFieldErrors = {
  label: 'invalidLabel',
  vendor: 'invalidVendor',
  notes: 'invalidNotes',
  expectedLifespanDays: 'invalidEstimate',
  unitCostMinor: 'invalidCost',
} as const
const dateSchema = z.iso.date()
const purchaseSchema = z.object({
  name: z.string().trim().min(1).max(SUPPLY_LABEL_LIMIT),
  purchasedOn: dateSchema,
  quantity: z.int().min(1).max(1_000_000),
  unitCostMinor: costSchema,
  vendor: z.string().trim().max(SUPPLY_VENDOR_LIMIT).optional(),
  notes: z.string().trim().max(SUPPLY_NOTES_LIMIT).optional(),
  expense: z.object({
    categoryId: z.uuid(),
    paymentStatus: z.enum(['paid', 'unpaid']),
    paymentMethod: z.enum(['cash', 'bank', 'other']).optional(),
    paidAt: dateSchema.optional(),
    vatMinor: z.int().min(0).max(99_999_999_999),
  }).optional(),
})
const missing = { depth: 0, disableErrors: true } as const
const latestUsageFirst = ['-finishedOn', '-createdAt', 'id']
type TransactionRequest = Pick<PayloadRequest, 'payload' | 'transactionID'>

export class SupplyError extends Error {
  constructor(
    readonly code:
      | 'invalidSettings'
      | 'invalidLabel'
      | 'invalidVendor'
      | 'invalidNotes'
      | 'invalidEstimate'
      | 'invalidCost'
      | 'invalidDates'
      | 'notFound'
      | 'archived'
      | 'stillInUse'
      | 'alreadyFinished'
      | 'duplicateStart'
      | 'invalidPurchase'
      | 'invalidPurchaseExpense'
      | 'stockUnavailable'
      | 'openedBeforePurchase'
      | 'transactionUnavailable',
  ) {
    super(code)
  }
}

function validateDates(
  startedOn: string,
  finishedOn: string | null,
  profile: MarketProfile,
  now?: Date,
) {
  const today = todayDateInput(profile, now)
  if (
    !dateSchema.safeParse(startedOn).success ||
    startedOn > today ||
    (finishedOn !== null &&
      (!dateSchema.safeParse(finishedOn).success || finishedOn < startedOn || finishedOn > today))
  ) {
    throw new SupplyError('invalidDates')
  }
}

function parseUsageFields(input: SupplyUsageDetails) {
  const result = usageFieldsSchema.safeParse(input)
  if (result.success) return result.data
  const field = result.error.issues[0]?.path[0]
  throw new SupplyError(usageFieldErrors[field as keyof typeof usageFieldErrors] ?? 'invalidLabel')
}

let pendingMutation: Promise<unknown> = Promise.resolve()

function inSupplyTransaction<T>(work: (req: TransactionRequest) => Promise<T>, requireTransaction = false) {
  // Queue local writes because SQLite can reject simultaneous write transactions.
  const operation = pendingMutation.then(async () => {
    const payload = await getPayload({ config })
    const transactionID = await payload.db.beginTransaction()
    if (requireTransaction && transactionID === null) throw new SupplyError('transactionUnavailable')
    try {
      const result = await work({ payload, transactionID: transactionID ?? undefined })
      if (transactionID !== null) await payload.db.commitTransaction(transactionID)
      return result
    } catch (error) {
      if (transactionID !== null) {
        await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
      }
      throw error
    }
  })
  pendingMutation = operation.catch(() => undefined)
  return operation
}

async function findSupply(id: string, req?: Partial<PayloadRequest>) {
  if (!supplyIdSchema.safeParse(id).success) return null
  const payload = req?.payload ?? await getPayload({ config })
  return payload.findByID({ collection: 'supplies', id, req, ...missing })
}

async function requireSupply(id: string, req?: Partial<PayloadRequest>) {
  const supply = await findSupply(id, req)
  if (!supply) throw new SupplyError('notFound')
  return supply
}

async function findUsage(id: string, req: TransactionRequest) {
  if (!supplyIdSchema.safeParse(id).success) return null
  return req.payload.findByID({ collection: 'supply-usages', id, req, ...missing })
}

async function findPurchase(id: string, req: TransactionRequest) {
  if (!supplyIdSchema.safeParse(id).success) return null
  return req.payload.findByID({ collection: 'supply-purchases', id, req, ...missing })
}

export async function addSupplyPurchase(
  supplyId: string,
  id: string,
  input: SupplyPurchaseInput,
  profile: MarketProfile,
  now?: Date,
) {
  const parsed = purchaseSchema.safeParse(input)
  if (!supplyIdSchema.safeParse(id).success || !parsed.success) throw new SupplyError('invalidPurchase')
  const { expense, name, purchasedOn, quantity, unitCostMinor, vendor, notes } = parsed.data
  return inSupplyTransaction(async (req) => {
    const supply = await requireSupply(supplyId, req)
    const existing = await findPurchase(id, req)
    if (existing) {
      if (existing.supply !== supplyId) throw new SupplyError('invalidPurchase')
      return existing
    }
    if (supply.archived) throw new SupplyError('archived')
    validateDates(purchasedOn, null, profile, now)

    let expenseId: string | undefined
    if (expense) {
      const totalMinor = (unitCostMinor ?? 0) * quantity
      const vatMinor = profile.taxMode === 'none' ? 0 : expense.vatMinor
      const paidAt = expense.paymentStatus === 'paid' ? expense.paidAt ?? purchasedOn : undefined
      if (
        totalMinor < 1 || totalMinor > 99_999_999_999 || vatMinor > totalMinor ||
        (paidAt && (paidAt < purchasedOn || paidAt > todayDateInput(profile, now)))
      ) throw new SupplyError('invalidPurchaseExpense')
      const category = await req.payload.findByID({
        collection: 'expense-categories', id: expense.categoryId, req, ...missing,
      })
      if (!category?.active) throw new SupplyError('invalidPurchaseExpense')
      expenseId = (await createManualExpense({
        billDate: purchasedOn,
        categoryId: expense.categoryId,
        idempotencyKey: randomUUID(),
        name,
        note: notes,
        paidAt,
        paymentMethod: expense.paymentMethod,
        paymentStatus: expense.paymentStatus,
        totalMinor,
        vatMinor,
        vendor,
      }, 'variable', req)).id
    }

    return req.payload.create({
      collection: 'supply-purchases',
      req,
      depth: 0,
      data: {
        id, supply: supplyId, expense: expenseId, name, purchasedOn,
        quantity, remainingQuantity: quantity, unitCostMinor: unitCostMinor ?? null,
        costCurrencyCode: unitCostMinor == null ? null : profile.currencyCode,
        vendor: vendor || null,
        notes: notes || null,
      },
    })
  }, Boolean(expense))
}

export async function getSupplyCatalog(today: string) {
  const payload = await getPayload({ config })
  const [supplies, usages, stock] = await Promise.all([
    payload.find({ collection: 'supplies', depth: 0, pagination: false, sort: ['name', 'id'] }),
    payload.find({
      collection: 'supply-usages',
      depth: 0,
      pagination: false,
      select: { supply: true, startedOn: true, finishedOn: true, expectedLifespanDays: true, unitCostMinor: true, costCurrencyCode: true },
      sort: latestUsageFirst,
    }),
    payload.find({
      collection: 'supply-purchases', depth: 0, pagination: false,
      select: { supply: true, remainingQuantity: true },
      where: { remainingQuantity: { greater_than: 0 } },
    }),
  ])
  const usageBySupply = new Map<string, SupplyUsageTimeline[]>()
  for (const usage of usages.docs) {
    const id = typeof usage.supply === 'string' ? usage.supply : usage.supply.id
    const records = usageBySupply.get(id)
    if (records) records.push(usage)
    else usageBySupply.set(id, [usage])
  }
  const unopenedBySupply = new Map<string, number>()
  for (const purchase of stock.docs) {
    const id = typeof purchase.supply === 'string' ? purchase.supply : purchase.supply.id
    unopenedBySupply.set(id, (unopenedBySupply.get(id) ?? 0) + purchase.remainingQuantity)
  }
  const groups = supplies.docs.map((supply) => ({
    supply,
    usages: usageBySupply.get(supply.id) ?? [],
  }))
  const entries = groups.map(({ supply, usages }) => ({
    supply,
    summary: summarizeSupplyUsage(usages),
    costs: summarizeSupplyCosts(usages),
    unopened: unopenedBySupply.get(supply.id) ?? 0,
  }))
  return {
    entries,
    currentStock: entries.filter(({ supply }) => !supply.archived).map(({ supply, summary, unopened }) => ({
      id: supply.id, name: supply.name, unopened, inUse: summary.inUse,
    })),
    overview: summarizeSupplyOverview(groups, today),
  }
}

export async function getAvailableSupplyPurchases(supplyId: string) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'supply-purchases',
    depth: 0,
    pagination: false,
    sort: ['purchasedOn', 'createdAt', 'id'],
    where: { supply: { equals: supplyId }, remainingQuantity: { greater_than: 0 } },
    select: { name: true, purchasedOn: true, remainingQuantity: true, unitCostMinor: true, costCurrencyCode: true, vendor: true },
  })
  return docs
}

export async function getSupplyPurchaseHistory(supplyId: string, includeOpened: boolean, requestedPage: number) {
  const payload = await getPayload({ config })
  const where = {
    supply: { equals: supplyId },
    ...(includeOpened ? {} : { remainingQuantity: { greater_than: 0 } }),
  }
  const { totalDocs } = await payload.count({ collection: 'supply-purchases', where })
  const totalPages = Math.max(1, Math.ceil(totalDocs / SUPPLY_HISTORY_PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  const { docs: records } = await payload.find({
    collection: 'supply-purchases', depth: 0, sort: ['-purchasedOn', '-createdAt', 'id'],
    limit: SUPPLY_HISTORY_PAGE_SIZE, page, where,
  })
  return { records, page, totalPages }
}

export async function getSupplyDetails(id: string) {
  const supply = await findSupply(id)
  if (!supply) return null

  const payload = await getPayload({ config })
  const { docs: usages } = await payload.find({
    collection: 'supply-usages',
    depth: 0,
    pagination: false,
    sort: latestUsageFirst,
    where: { supply: { equals: id } },
  })
  return { supply, usages, summary: summarizeSupplyUsage(usages), costs: summarizeSupplyCosts(usages) }
}

export async function saveSupply(input: SupplySettingsInput, id?: string) {
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) {
    throw new SupplyError(parsed.error.issues[0]?.path[0] === 'defaultUnitCostMinor' ? 'invalidCost' : 'invalidSettings')
  }

  return inSupplyTransaction(async (req) => {
    const { payload } = req
    if (id === undefined) {
      return payload.create({
        collection: 'supplies',
        req,
        data: { id: randomUUID(), archived: false, ...parsed.data },
      })
    }
    await requireSupply(id, req)
    return payload.update({ collection: 'supplies', id, req, data: parsed.data })
  })
}

export async function setSupplyArchived(id: string, archived: boolean) {
  return inSupplyTransaction(async (req) => {
    await requireSupply(id, req)
    const { payload } = req
    if (archived) {
      const { totalDocs } = await payload.count({
        collection: 'supply-usages',
        req,
        where: { supply: { equals: id }, finishedOn: { exists: false } },
      })
      if (totalDocs) throw new SupplyError('stillInUse')
    }
    return payload.update({ collection: 'supplies', id, req, data: { archived } })
  })
}

export async function startSupplyUsage(
  supplyId: string,
  id: string,
  input: SupplyUsageDetails & { purchaseId?: string },
  profile: MarketProfile,
  now?: Date,
) {
  if (!supplyIdSchema.safeParse(id).success) throw new SupplyError('notFound')
  return inSupplyTransaction(async (req) => {
    const supply = await requireSupply(supplyId, req)
    const existing = await findUsage(id, req)
    if (existing) {
      if (existing.supply !== supplyId || (existing.purchase ?? undefined) !== input.purchaseId) {
        throw new SupplyError('duplicateStart')
      }
      return existing
    }
    if (supply.archived) throw new SupplyError('archived')

    const { startedOn } = input
    validateDates(startedOn, null, profile, now)
    const {
      expectedLifespanDays = supply.expectedLifespanDays ?? null,
      unitCostMinor = supply.defaultUnitCostMinor ?? null,
      ...fields
    } = parseUsageFields(input)
    const purchase = input.purchaseId === undefined ? null : await findPurchase(input.purchaseId, req)
    if (input.purchaseId !== undefined && (!purchase || purchase.supply !== supplyId || purchase.remainingQuantity < 1)) {
      throw new SupplyError('stockUnavailable')
    }
    if (purchase) {
      if (startedOn < purchase.purchasedOn) throw new SupplyError('openedBeforePurchase')
      await req.payload.update({
        collection: 'supply-purchases', id: purchase.id, req, depth: 0,
        data: { remainingQuantity: purchase.remainingQuantity - 1 },
      })
    }
    return req.payload.create({
      collection: 'supply-usages',
      depth: 0,
      req,
      data: {
        id, supply: supplyId, startedOn, expectedLifespanDays, unitCostMinor,
        costCurrencyCode: unitCostMinor === null ? null : profile.currencyCode,
        ...fields,
        ...(purchase ? {
          purchase: purchase.id,
          label: purchase.name,
          vendor: purchase.vendor,
          unitCostMinor: purchase.unitCostMinor,
          costCurrencyCode: purchase.costCurrencyCode,
        } : {}),
      },
    })
  }, input.purchaseId !== undefined)
}

type UsageChange =
  | { operation: 'finish'; finishedOn: string }
  | (SupplyUsageDetails & { operation: 'correct'; finishedOn: string | null })

export async function updateSupplyUsage(
  supplyId: string,
  id: string,
  change: UsageChange,
  profile: MarketProfile,
  now?: Date,
) {
  return inSupplyTransaction(async (req) => {
    const supply = await requireSupply(supplyId, req)
    const usage = await findUsage(id, req)
    if (!usage || usage.supply !== supplyId) throw new SupplyError('notFound')
    const { finishedOn } = change

    if (change.operation === 'finish' && !dateSchema.safeParse(finishedOn).success) {
      throw new SupplyError('invalidDates')
    }
    if (change.operation === 'finish' && usage.finishedOn) {
      if (usage.finishedOn === finishedOn) return usage
      throw new SupplyError('alreadyFinished')
    }

    const startedOn = change.operation === 'correct' ? change.startedOn : usage.startedOn
    validateDates(startedOn, finishedOn, profile, now)
    if (supply.archived && !finishedOn) throw new SupplyError('archived')
    if (change.operation === 'correct' && typeof usage.purchase === 'string') {
      const purchase = await findPurchase(usage.purchase, req)
      if (purchase && startedOn < purchase.purchasedOn) throw new SupplyError('openedBeforePurchase')
    }

    const fields = change.operation === 'correct' ? parseUsageFields(change) : undefined
    const { unitCostMinor: requestedCost, ...details } = fields ?? {}
    const cost = usage.purchase ? undefined : requestedCost
    const data = {
      startedOn,
      finishedOn,
      ...details,
      ...(cost !== undefined ? {
        unitCostMinor: cost,
        costCurrencyCode: cost === null ? null : usage.costCurrencyCode ?? profile.currencyCode,
      } : {}),
    }
    return req.payload.update({ collection: 'supply-usages', depth: 0, id, req, data })
  })
}
