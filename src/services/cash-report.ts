import config from '@payload-config'
import { getPayload } from 'payload'

import { resolveBusinessReportPeriod } from '@/lib/business-report-periods'
import type { BusinessReportFilter, BusinessReportRange } from '@/lib/business-report-types'
import { dateInputToISOString, todayDateInput, toMarketDateInput } from '@/lib/calendar'
import { cashDeltas, type CashBalances, type CashMovementInput, type CashOpeningInput, type DailyCashOpeningInput } from '@/lib/cash'
import { getMarketProfile, type MarketProfile } from '@/lib/market'
import type { CashLedger } from '@/payload-types'

import { getCashOpening, type CashRequest } from './cash-postings'
import { cashOpeningOnDay, cashReportDay, dailyOpeningId, dailyOpeningSource, openingForFullDay, openingSnapshotSource, originalOpeningAmounts } from './cash-opening'
import { cashLedgerExcludingSalesVat, groupCashMovements, usesRecordedBalance, type CashOpeningBalance, type PaymentSource } from './cash-report-ledger'
import { areShopSettingsComplete, marketContextFromSettings } from './settings'

const pageSize = 20
const emptyOpening = { cashMinor: 0, bankMinor: 0 }

function addBalances(target: CashBalances, amounts: CashBalances) {
  target.cashMinor += amounts.cashMinor
  target.bankMinor += amounts.bankMinor
}

type ActivityKind = 'salesReceived' | 'expensesPaid' | 'payrollPaid' | 'moneyPaidToPeople' | 'otherIn' | 'otherOut' | 'ownerPickup' | 'transfers' | 'adjustments'
type PeriodCash = { history: CashLedger[]; net: CashBalances; moneyIn: CashBalances; moneyOut: CashBalances }

function rowsThrough(rows: readonly CashLedger[], range: BusinessReportRange, now: Date) {
  const asOf = now.toISOString()
  return rows.filter(({ kind, effectiveAt }) => kind !== 'opening' &&
    effectiveAt <= asOf && (!range.end || effectiveAt < range.end))
}

function summarizeActivity(rows: CashLedger[], paymentSources = new Map<string, PaymentSource>()) {
  const activity: PeriodCash = {
    history: rows, net: { cashMinor: 0, bankMinor: 0 },
    moneyIn: { cashMinor: 0, bankMinor: 0 }, moneyOut: { cashMinor: 0, bankMinor: 0 },
  }
  const breakdown: Record<ActivityKind, CashBalances> = {
    salesReceived: { cashMinor: 0, bankMinor: 0 }, expensesPaid: { cashMinor: 0, bankMinor: 0 },
    payrollPaid: { cashMinor: 0, bankMinor: 0 }, moneyPaidToPeople: { cashMinor: 0, bankMinor: 0 },
    otherIn: { cashMinor: 0, bankMinor: 0 },
    otherOut: { cashMinor: 0, bankMinor: 0 }, transfers: { cashMinor: 0, bankMinor: 0 },
    ownerPickup: { cashMinor: 0, bankMinor: 0 },
    adjustments: { cashMinor: 0, bankMinor: 0 },
  }
  for (const { amounts, row } of groupCashMovements(rows)) {
    addBalances(activity.net, amounts)
    const { cashMinor, bankMinor } = amounts
    activity.moneyIn.cashMinor += Math.max(0, cashMinor)
    activity.moneyIn.bankMinor += Math.max(0, bankMinor)
    activity.moneyOut.cashMinor += Math.max(0, -cashMinor)
    activity.moneyOut.bankMinor += Math.max(0, -bankMinor)
    const kind = row.source?.split(':', 1)[0] ?? row.kind
    const subject = kind === 'payment' ? paymentSources.get(row.source ?? '')?.kind : undefined
    switch (subject ?? kind) {
      case 'sale':
      case 'salesReceived': addBalances(breakdown.salesReceived, amounts); break
      case 'expense':
      case 'expensesPaid': addBalances(breakdown.expensesPaid, amounts); break
      case 'payroll': addBalances(breakdown.payrollPaid, amounts); break
      case 'moneyPaidToPeople': addBalances(breakdown.moneyPaidToPeople, amounts); break
      case 'ownerPickup': addBalances(breakdown.ownerPickup, amounts); break
      case 'transfer': addBalances(breakdown.transfers, amounts); break
      case 'reconcile':
      case 'correction': addBalances(breakdown.adjustments, amounts); break
      default:
        breakdown.otherIn.cashMinor += Math.max(0, cashMinor)
        breakdown.otherIn.bankMinor += Math.max(0, bankMinor)
        breakdown.otherOut.cashMinor += Math.min(0, cashMinor)
        breakdown.otherOut.bankMinor += Math.min(0, bankMinor)
    }
  }

  return { ...activity, breakdown }
}

export function summarizeCash(
  opening: CashOpeningBalance, rows: readonly CashLedger[], range: BusinessReportRange, now: Date,
  paymentSources?: Map<string, PaymentSource>,
) {
  if (opening.effectiveAt > now.toISOString() ||
    (range.end && opening.effectiveAt >= range.end && range.start !== range.end)) return null
  const carried = { cashMinor: opening.cashMinor, bankMinor: opening.bankMinor }
  const history = []
  for (const row of rowsThrough(rows, range, now)) {
    if (row.effectiveAt < opening.effectiveAt) continue
    if (range.start && row.effectiveAt < range.start) addBalances(carried, row)
    else history.push(row)
  }
  const { net, moneyIn, moneyOut, breakdown } = summarizeActivity(history, paymentSources)
  const closing = { ...carried }
  addBalances(closing, net)
  return { carried, history, moneyIn, moneyOut, closing, breakdown }
}

export async function cashTransaction<T>(work: (req: CashRequest) => Promise<T>) {
  const payload = await getPayload({ config })
  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null) throw new Error('The database cannot start a cash transaction.')
  try {
    const result = await work({ payload, transactionID })
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    throw error
  }
}

export async function startCashTracking({ basis, ...balances }: CashOpeningInput) {
  return cashTransaction(async (req) => {
    const existing = await getCashOpening(req.payload, req)
    if (existing) return existing
    const settings = await req.payload.findGlobal({ slug: 'shop-settings', req, depth: 0 })
    if (!areShopSettingsComplete(settings)) {
      throw new Error('Complete Business Information before starting cash tracking.')
    }
    const { profile } = marketContextFromSettings(settings)
    const now = new Date()
    const effectiveAt = basis === 'startOfDay'
      ? dateInputToISOString(todayDateInput(profile, now), profile) : now.toISOString()
    return req.payload.create({
      collection: 'cash-ledger', req, depth: 0,
      data: {
        ...balances, id: 'opening', kind: 'opening', effectiveAt,
        countryCode: profile.countryCode, currencyCode: profile.currencyCode,
      },
    })
  })
}

export async function getCurrentCashBalances(now = new Date(), req?: CashRequest) {
  const payload = req?.payload ?? await getPayload({ config })
  const initial = await getCashOpening(payload, req)
  if (!initial) return null
  const market = getMarketProfile(initial.countryCode)

  return getCashMovementBalances(market, todayDateInput(market, now), now, req)
}

export async function saveDailyCashOpening({ date, ...amounts }: DailyCashOpeningInput) {
  return cashTransaction(async (req) => {
    const settings = await req.payload.findGlobal({ slug: 'shop-settings', req, depth: 0 })
    if (!areShopSettingsComplete(settings)) throw new Error('Complete Business Information first.')
    const { profile } = marketContextFromSettings(settings)
    if (date > todayDateInput(profile)) throw new Error('Choose today or an earlier date for opening balances.')

    const id = dailyOpeningId(profile, date)
    const { countryCode, currencyCode } = profile
    const effectiveAt = dateInputToISOString(date, profile)
    const initial = await getCashOpening(req.payload, req)
    if (!initial) {
      await req.payload.create({ collection: 'cash-ledger', req, depth: 0, data: {
        id: 'opening', kind: 'opening', effectiveAt, countryCode, currencyCode,
        cashMinor: 0, bankMinor: 0, source: dailyOpeningSource(date),
      } })
    }
    const existing = await req.payload.findByID({ collection: 'cash-ledger', req, depth: 0, id, disableErrors: true })
    if (existing) return req.payload.update({ collection: 'cash-ledger', req, depth: 0, id,
      data: { ...amounts, source: openingSnapshotSource(existing) },
    })
    return req.payload.create({ collection: 'cash-ledger', req, depth: 0, data: {
      ...amounts, id, kind: 'opening', effectiveAt, countryCode, currencyCode,
    } })
  })
}

export async function recordCashMovement(input: CashMovementInput) {
  return cashTransaction(async (req) => {
    const existing = await req.payload.findByID({
      collection: 'cash-ledger', req, id: input.id, depth: 0, disableErrors: true,
    })
    if (existing) return existing

    const settings = await req.payload.findGlobal({ slug: 'shop-settings', req, depth: 0 })
    if (!areShopSettingsComplete(settings)) throw new Error('Complete Business Information first.')
    const { profile } = marketContextFromSettings(settings)
    const now = new Date()
    const today = todayDateInput(profile, now)
    const date = input.date
    if (date > today || (input.kind === 'reconcile' && date !== today)) {
      throw new Error('Use today for a count and today or an earlier date for other movements.')
    }
    const effectiveAt = date === today ? now.toISOString() : dateInputToISOString(date, profile)
    const balances = await cashMovementDeltas(input, now, req)
    if (input.kind === 'outflow' || input.kind === 'transfer') {
      const available = await getCashMovementBalances(profile, date, now, req)
      if (available && (['cashMinor', 'bankMinor'] as const).some((account) => -balances[account] > Math.max(0, available[account]))) {
        throw new Error('The amount exceeds the available balance.')
      }
    }
    return req.payload.create({
      collection: 'cash-ledger', req, depth: 0,
      data: {
        ...balances, id: input.id, kind: input.kind, note: input.note, effectiveAt,
        source: `${input.kind}:net:${input.id}`,
        countryCode: profile.countryCode, currencyCode: profile.currencyCode,
      },
    })
  })
}

export async function getCashMovementBalances(
  market: MarketProfile, date: string, now = new Date(), req?: CashRequest,
): Promise<CashBalances | null> {
  const report = await getCashReport({ period: 'custom', startDate: date, endDate: date }, market, 1, now, req)
  return report.balances?.closing ?? null
}

function legacyOpeningLookup(initial: CashLedger | null, openings: CashLedger[], rows: CashLedger[], market: MarketProfile) {
  const earliestCountByDay = new Map<string, string>()
  for (const row of rows) {
    if (!usesRecordedBalance(row)) continue
    const date = toMarketDateInput(row.effectiveAt, market)
    const earliest = earliestCountByDay.get(date)
    if (!earliest || row.createdAt < earliest) earliestCountByDay.set(date, row.createdAt)
  }

  // VAT on a past withdrawal depends on the original opening in use when it was recorded.
  const originalOpenings = openings.filter((entry) => {
    const earliest = earliestCountByDay.get(toMarketDateInput(entry.effectiveAt, market))
    return earliest && entry.createdAt <= earliest
  }).map(originalOpeningAmounts)
  return (time: string) => {
    const { opening } = cashOpeningOnDay(initial, originalOpenings, market, toMarketDateInput(time, market))
    return opening && opening.effectiveAt <= time ? opening : null
  }
}

async function cashMovementDeltas(input: CashMovementInput, now: Date, req: CashRequest): Promise<CashBalances> {
  if (input.kind === 'transfer') {
    const balances = cashDeltas(input.account, -input.amountMinor)
    addBalances(balances, cashDeltas(input.account === 'cash' ? 'bank' : 'cash', input.amountMinor))
    return balances
  }

  const amounts = 'account' in input ? {
    cashMinor: input.account === 'cash' ? input.amountMinor : undefined,
    bankMinor: input.account === 'bank' ? input.amountMinor : undefined,
  } : input

  if (input.kind === 'reconcile') {
    const current = await getCurrentCashBalances(now, req)
    if (!current) throw new Error('Enter your starting balances first.')
    if (!input.note.trim()) throw new Error('Enter a reason for the count correction.')
    return {
      cashMinor: amounts.cashMinor === undefined ? 0 : amounts.cashMinor - current.cashMinor,
      bankMinor: amounts.bankMinor === undefined ? 0 : amounts.bankMinor - current.bankMinor,
    }
  }

  const sign = input.kind === 'outflow' ? -1 : 1
  return { cashMinor: amounts.cashMinor ? amounts.cashMinor * sign : 0, bankMinor: amounts.bankMinor ? amounts.bankMinor * sign : 0 }
}

export async function getCashReport(filter: BusinessReportFilter, market: MarketProfile, requestedPage: number | 'all', now = new Date(), req?: CashRequest) {
  const payload = req?.payload ?? await getPayload({ config })
  const initial = await getCashOpening(payload, req)
  const { selected } = resolveBusinessReportPeriod(filter, market, now)
  const { docs } = await payload.find({
    collection: 'cash-ledger', req, depth: 0, pagination: false,
    sort: ['-effectiveAt', '-createdAt', 'id'],
    where: { effectiveAt: { less_than_equal: now.toISOString() }, countryCode: { equals: market.countryCode } },
  })
  const storedRows = rowsThrough(docs, selected, now)
  const openings = docs.filter(({ kind }) => kind === 'opening')
  const usesVat = market.taxMode === 'saudiVat'
  const inPeriod = ({ effectiveAt }: CashLedger) => !selected.start || effectiveAt >= selected.start
  const paymentSources = await getPaymentSources(payload, usesVat ? storedRows : storedRows.filter(inPeriod), req)
  const through = usesVat
    ? await cashLedgerExcludingSalesVat(payload, storedRows, paymentSources, legacyOpeningLookup(initial, openings, storedRows, market), req)
    : storedRows
  const rows = through.filter(inPeriod)
  const activity = summarizeActivity(rows, paymentSources)
  const currentPeriod = filter.period === 'today' || filter.period === 'month' || filter.period === 'year' || filter.period === 'all'
  const date = currentPeriod ? todayDateInput(market, now) : cashReportDay(selected, market, now)
  const dayStart = dateInputToISOString(date, market)
  const singleDay = filter.period === 'today' || filter.period === 'yesterday' ||
    (filter.period === 'custom' && selected.start === dayStart && selected.end &&
      toMarketDateInput(new Date(Date.parse(selected.end) - 1), market) === date)
  const { opening, daily } = cashOpeningOnDay(initial, openings, market, date)
  const balanceRange = daily ? { ...selected, start: dayStart } : selected
  const reportOpening = opening && openingForFullDay(opening, through, dayStart, date, market)
  const balances = reportOpening && summarizeCash(reportOpening, through, balanceRange, now, paymentSources)
  const dayBalances = balances && balanceRange.start !== dayStart
    ? summarizeCash(reportOpening, through, { ...balanceRange, start: dayStart }, now)
    : balances
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = requestedPage === 'all' ? 1 : Math.min(Math.max(1, requestedPage), totalPages)
  const history = requestedPage === 'all' ? rows : rows.slice((page - 1) * pageSize, page * pageSize)
  return {
    startedAt: initial?.effectiveAt ?? null,
    dailyBalanceDate: daily && !singleDay ? date : null,
    openingEditor: { date, balances: dayBalances?.carried ?? emptyOpening },
    balances: balances ? { carried: balances.carried, closing: balances.closing,
      moneyIn: balances.moneyIn, moneyOut: balances.moneyOut, breakdown: balances.breakdown,
      current: !selected.end || selected.end >= now.toISOString() } : null,
    activity: { ...activity, history, page, totalPages,
      includesBeforeOpening: Boolean(balances && reportOpening && rows.some(({ effectiveAt }) => effectiveAt < reportOpening.effectiveAt)) },
  }
}

async function getPaymentSources(payload: Awaited<ReturnType<typeof getPayload>>, rows: CashLedger[], req?: CashRequest) {
  const keys = [...new Set(rows.flatMap(({ source }) =>
    source?.startsWith('payment:') ? [source.slice('payment:'.length)] : []))]
  const sources = new Map<string, PaymentSource>()
  for (let i = 0; i < keys.length; i += 200) {
    const ids = keys.slice(i, i + 200)
    const [{ docs: payments }, { docs: expenses }] = await Promise.all([
      payload.find({
        collection: 'money-payments', req, depth: 1, pagination: false, select: { account: true, direction: true },
        populate: { 'money-accounts': { invoice: true } }, where: { id: { in: ids } },
      }),
      payload.find({
        collection: 'expenses', req, depth: 0, pagination: false, select: { cashPayment: true },
        where: { cashPayment: { in: ids }, status: { equals: 'confirmed' } },
      }),
    ])
    for (const payment of payments) {
      if (payment.direction === 'weOwe') {
        sources.set(`payment:${payment.id}`, { kind: 'moneyPaidToPeople' })
        continue
      }
      const invoice = typeof payment.account === 'string' ? undefined : payment.account?.invoice
      const invoiceId = typeof invoice === 'string' ? invoice : invoice?.id
      if (invoiceId) sources.set(`payment:${payment.id}`, { kind: 'salesReceived', invoiceId })
    }
    for (const expense of expenses) {
      if (typeof expense.cashPayment === 'string') sources.set(`payment:${expense.cashPayment}`, { kind: 'expensesPaid' })
    }
  }
  return sources
}

export type CashReport = Awaited<ReturnType<typeof getCashReport>>

export async function getExpenseCashLinks(market: MarketProfile) {
  const payload = await getPayload({ config })
  const [{ docs }, { docs: linkedExpenses }] = await Promise.all([
    payload.find({
      collection: 'cash-ledger', depth: 0, pagination: false, sort: '-effectiveAt',
      where: { kind: { equals: 'payment' }, activeSource: { exists: true } },
    }),
    payload.find({
      collection: 'expenses', depth: 0, pagination: false, select: { cashPayment: true },
      where: { cashPayment: { exists: true } },
    }),
  ])
  const claims = new Map(linkedExpenses.map(({ id, cashPayment }) => [cashPayment, id]))
  return docs.filter(({ cashMinor, bankMinor }) => cashMinor < 0 || bankMinor < 0)
    .map(({ activeSource, cashMinor, bankMinor, note, effectiveAt }) => {
      const id = activeSource!.slice('payment:'.length)
      return {
        id, claimedBy: claims.get(id),
        method: cashMinor < 0 ? 'cash' as const : 'bank' as const,
        amountMinor: -(cashMinor + bankMinor),
        date: toMarketDateInput(effectiveAt, market),
        label: note || '',
      }
    })
}

export type ExpenseCashLink = Awaited<ReturnType<typeof getExpenseCashLinks>>[number]
