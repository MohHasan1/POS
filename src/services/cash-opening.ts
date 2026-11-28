import type { BusinessReportRange } from '@/lib/business-report-types'
import { dateInputToISOString, todayDateInput, toMarketDateInput } from '@/lib/calendar'
import type { MarketProfile } from '@/lib/market'
import type { CashLedger } from '@/payload-types'

import type { CashOpeningBalance } from './cash-report-ledger'

const dailySourcePrefix = 'daily-openings:'
const openingSnapshot = /^opening-snapshot:(\d+):(-?\d+)$/

export function dailyOpeningSource(date: string) {
  return `${dailySourcePrefix}${date}`
}

export function dailyOpeningId(market: MarketProfile, date: string) {
  return `opening:${market.countryCode}:${date}`
}

export function openingSnapshotSource(entry: CashLedger) {
  return entry.source ?? `opening-snapshot:${entry.cashMinor}:${entry.bankMinor}`
}

export function originalOpeningAmounts(entry: CashLedger): CashLedger {
  const snapshot = openingSnapshot.exec(entry.source ?? '')
  return snapshot ? { ...entry, cashMinor: Number(snapshot[1]), bankMinor: Number(snapshot[2]) } : entry
}

export function cashOpeningOnDay(initial: CashLedger | null, rows: readonly CashLedger[], market: MarketProfile, date: string) {
  const entry = rows.find(({ id }) => id === dailyOpeningId(market, date))
  if (entry) return { opening: entry, daily: true }
  const dailyFrom = initial?.source?.startsWith(dailySourcePrefix) ? initial.source.slice(dailySourcePrefix.length) : undefined
  if (dailyFrom && date >= dailyFrom) {
    return { opening: { cashMinor: 0, bankMinor: 0, effectiveAt: dateInputToISOString(date, market) }, daily: true }
  }
  return { opening: initial, daily: false }
}

export function openingForFullDay(opening: CashOpeningBalance, movements: readonly CashLedger[], dayStart: string, date: string, market: MarketProfile) {
  if (opening.effectiveAt <= dayStart || toMarketDateInput(opening.effectiveAt, market) !== date) return opening

  let cashBeforeCount = 0
  let bankBeforeCount = 0
  for (const movement of movements) {
    if (movement.effectiveAt >= dayStart && movement.effectiveAt < opening.effectiveAt) {
      cashBeforeCount += movement.cashMinor
      bankBeforeCount += movement.bankMinor
    }
  }

  // A legacy count made partway through the day can already contain earlier activity.
  // Keep a zero opening at zero so earlier receipts are included in that day's balance.
  return {
    effectiveAt: dayStart,
    cashMinor: opening.cashMinor === 0 ? 0 : opening.cashMinor - cashBeforeCount,
    bankMinor: opening.bankMinor === 0 ? 0 : opening.bankMinor - bankBeforeCount,
  }
}

export function cashReportDay(range: BusinessReportRange, market: MarketProfile, now: Date) {
  const start = range.start ? Date.parse(range.start) : -Infinity
  const end = range.end ? Date.parse(range.end) - 1 : now.getTime()
  const last = Math.min(Math.max(start, end), now.getTime())
  return todayDateInput(market, new Date(last))
}
