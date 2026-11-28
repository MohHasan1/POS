import config from '@payload-config'
import { getPayload } from 'payload'

import { resolveBusinessReportPeriod } from '@/lib/business-report-periods'
import type { BusinessReportFilter } from '@/lib/business-report-types'
import { dateInputToISOString, todayDateInput, toMarketDateInput } from '@/lib/calendar'
import { cashClosingSchema, type CashClosingInput } from '@/lib/cash'
import type { MarketProfile } from '@/lib/market'
import type { CashClosing } from '@/payload-types'

import { saveClosingMovements, saveNextDayOpening } from './cash-closing-ledger'
import type { CashRequest } from './cash-postings'
import { cashTransaction, getCashMovementBalances, getCashReport } from './cash-report'
import { marketContextFromSettings } from './settings'

function closingId(market: MarketProfile, businessDate: string) {
  return `${market.countryCode}:${businessDate}`
}

async function readCashClosing(payload: CashRequest['payload'], id: string, req?: CashRequest) {
  const options = { collection: 'cash-closings' as const, depth: 0, disableErrors: true, req } as const
  return await payload.findByID({ ...options, id: `${id}:net` }) ?? payload.findByID({ ...options, id })
}

async function closingForDisplay(closing: CashClosing, market: MarketProfile, req?: CashRequest) {
  const legacyVat = market.taxMode === 'saudiVat' && !closing.id.endsWith(':net') && !closing.lastEditRequestId
  if (!legacyVat && closing.expectedBankMinor != null) return closing

  const { businessDate, closedAt, id } = closing
  const filter = { period: 'custom', startDate: businessDate, endDate: businessDate } as const
  const report = await getCashReport(filter, market, 'all', new Date(closedAt), req)
  const end = report.balances?.closing ?? report.activity.net
  if (!legacyVat) return { ...closing, expectedBankMinor: end.bankMinor }

  const reconcile = report.activity.history.find(({ source }) => source === `reconcile:close:${id}`)
  const pickup = report.activity.history.find(({ source }) => source === `ownerPickup:close:${id}`)
  const actualCashMinor = end.cashMinor - (pickup?.cashMinor ?? 0)
  const actualBankMinor = end.bankMinor - (pickup?.bankMinor ?? 0)
  return {
    ...closing, actualCashMinor,
    expectedCashMinor: actualCashMinor - (reconcile?.cashMinor ?? 0),
    ownerPickupMinor: -(pickup?.cashMinor ?? 0),
    expectedBankMinor: actualBankMinor - (reconcile?.bankMinor ?? 0),
    ...(closing.actualBankMinor != null && { actualBankMinor, bankPickupMinor: -(pickup?.bankMinor ?? 0) }),
  }
}

export async function getCashClosingForReport(filter: BusinessReportFilter, market: MarketProfile, now: Date) {
  if (filter.period !== 'today' && filter.period !== 'yesterday' && filter.period !== 'custom') return null
  const { start, end } = resolveBusinessReportPeriod(filter, market, now).selected
  if (!start || !end) return null
  const businessDate = toMarketDateInput(start, market)
  if (filter.period === 'custom' && toMarketDateInput(new Date(Date.parse(end) - 1), market) !== businessDate) return null

  const payload = await getPayload({ config })
  const closing = await readCashClosing(payload, closingId(market, businessDate))
  return { businessDate, closing: closing && await closingForDisplay(closing, market) }
}

export type CashClosingReport = NonNullable<Awaited<ReturnType<typeof getCashClosingForReport>>>

export async function getPreviousClosingCash(date: string, market: MarketProfile) {
  const dayStart = new Date(dateInputToISOString(date, market))
  const report = await getCashClosingForReport({ period: 'yesterday' }, market, dayStart)
  const closing = report?.closing
  if (!closing) return null
  return closing.nextDayCashMinor ?? Math.max(0, closing.actualCashMinor - closing.ownerPickupMinor)
}

export async function closeCashDay(input: CashClosingInput, nowOverride?: Date) {
  const {
    businessDate, requestId, revision, expectedCashMinor, actualCashMinor, ownerPickupMinor, nextDayCashMinor,
    expectedBankMinor, actualBankMinor, bankPickupMinor, note,
  } = cashClosingSchema.parse(input)

  return cashTransaction(async (req) => {
    const settings = await req.payload.findGlobal({ slug: 'shop-settings', req, depth: 0 })
    const { profile } = marketContextFromSettings(settings)
    const dayId = closingId(profile, businessDate)
    const existing = await readCashClosing(req.payload, dayId, req)

    if (revision) {
      if (!existing) return { status: 'closingChanged' as const }
      if (existing.lastEditRequestId === requestId) return { status: 'saved' as const }
      if (revision !== (existing.lastEditRequestId ?? existing.requestId)) return { status: 'closingChanged' as const }
    } else if (existing) {
      return existing.requestId === requestId ? { status: 'saved' as const } : { status: 'alreadyClosed' as const }
    }

    const now = nowOverride ?? new Date()
    if (!existing && businessDate !== todayDateInput(profile, now)) return { status: 'dayChanged' as const }
    const closedAt = existing ? new Date(existing.closedAt) : now
    const previous = existing && await closingForDisplay(existing, profile, req)
    const balances = previous
      ? { cashMinor: previous.expectedCashMinor, bankMinor: previous.expectedBankMinor ?? 0 }
      : await getCashMovementBalances(profile, businessDate, closedAt, req)
    if (!balances) return { status: 'notTracking' as const }
    if (balances.cashMinor !== expectedCashMinor || (expectedBankMinor !== undefined && balances.bankMinor !== expectedBankMinor)) {
      return { status: 'drawerChanged' as const, balances }
    }

    const cashDifference = actualCashMinor - expectedCashMinor
    const bankDifference = actualBankMinor === undefined ? 0 : actualBankMinor - balances.bankMinor
    const retainedCash = nextDayCashMinor ?? existing?.nextDayCashMinor ?? null
    if (ownerPickupMinor + (retainedCash ?? 0) > actualCashMinor) return { status: 'invalid' as const }
    if ((cashDifference || bankDifference) && !note) return { status: 'reasonRequired' as const }
    if (!await saveNextDayOpening(req, profile, closedAt, nextDayCashMinor, existing)) return { status: 'openingAlreadySet' as const }

    const data = {
      note, expectedCashMinor, actualCashMinor, ownerPickupMinor,
      expectedBankMinor: expectedBankMinor ?? null, actualBankMinor: actualBankMinor ?? null, bankPickupMinor: bankPickupMinor ?? null,
      nextDayCashMinor: retainedCash,
    }
    if (existing) {
      await req.payload.update({
        collection: 'cash-closings', req, id: existing.id, depth: 0,
        data: { ...data, lastEditRequestId: requestId },
      })
    } else {
      const { countryCode, currencyCode, timeZone } = profile
      await req.payload.create({
        collection: 'cash-closings', req, depth: 0,
        data: { ...data, id: `${dayId}:net`, businessDate, requestId, closedAt: closedAt.toISOString(), countryCode, currencyCode, timeZone },
      })
    }

    await saveClosingMovements(req, profile, dayId, closedAt.toISOString(), [
      { kind: 'reconcile', cashMinor: cashDifference, bankMinor: bankDifference, note },
      { kind: 'ownerPickup', cashMinor: -ownerPickupMinor, bankMinor: -(bankPickupMinor ?? 0) },
    ], Boolean(existing))
    return { status: 'saved' as const }
  })
}
