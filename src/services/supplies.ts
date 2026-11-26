import config from '@payload-config'
import { randomUUID } from 'node:crypto'
import { getPayload, type PayloadRequest } from 'payload'
import { z } from 'zod'

import { todayDateInput } from '@/lib/calendar'
import type { MarketProfile } from '@/lib/market'
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
      | 'duplicateStart',
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

function inSupplyTransaction<T>(work: (req: TransactionRequest) => Promise<T>) {
  // Queue local writes because SQLite can reject simultaneous write transactions.
  const operation = pendingMutation.then(async () => {
    const payload = await getPayload({ config })
    const transactionID = await payload.db.beginTransaction()
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

export async function getSupplyCatalog(today: string) {
  const payload = await getPayload({ config })
  const [supplies, usages] = await Promise.all([
    payload.find({ collection: 'supplies', depth: 0, pagination: false, sort: ['name', 'id'] }),
    payload.find({
      collection: 'supply-usages',
      depth: 0,
      pagination: false,
      select: { supply: true, startedOn: true, finishedOn: true, expectedLifespanDays: true, unitCostMinor: true, costCurrencyCode: true },
      sort: latestUsageFirst,
    }),
  ])
  const usageBySupply = new Map<string, SupplyUsageTimeline[]>()
  for (const usage of usages.docs) {
    const id = typeof usage.supply === 'string' ? usage.supply : usage.supply.id
    const records = usageBySupply.get(id)
    if (records) records.push(usage)
    else usageBySupply.set(id, [usage])
  }
  const groups = supplies.docs.map((supply) => ({
    supply,
    usages: usageBySupply.get(supply.id) ?? [],
  }))
  return {
    entries: groups.map(({ supply, usages }) => ({
      supply,
      summary: summarizeSupplyUsage(usages),
      costs: summarizeSupplyCosts(usages),
    })),
    overview: summarizeSupplyOverview(groups, today),
  }
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
  input: SupplyUsageDetails,
  profile: MarketProfile,
  now?: Date,
) {
  if (!supplyIdSchema.safeParse(id).success) throw new SupplyError('notFound')
  return inSupplyTransaction(async (req) => {
    const supply = await requireSupply(supplyId, req)
    const existing = await findUsage(id, req)
    if (existing) {
      if (existing.supply !== supplyId) throw new SupplyError('duplicateStart')
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
    return req.payload.create({
      collection: 'supply-usages',
      depth: 0,
      req,
      data: {
        id, supply: supplyId, startedOn, expectedLifespanDays, unitCostMinor,
        costCurrencyCode: unitCostMinor === null ? null : profile.currencyCode,
        ...fields,
      },
    })
  })
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

    const fields = change.operation === 'correct' ? parseUsageFields(change) : undefined
    const cost = fields?.unitCostMinor
    const data = {
      startedOn,
      finishedOn,
      ...fields,
      ...(cost !== undefined ? { costCurrencyCode: cost === null ? null : usage.costCurrencyCode ?? profile.currencyCode } : {}),
    }
    return req.payload.update({ collection: 'supply-usages', depth: 0, id, req, data })
  })
}
