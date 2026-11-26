import type { MarketProfile } from './market'

export const SUPPLY_NAME_LIMIT = 160
export const SUPPLY_LABEL_LIMIT = 80
export const SUPPLY_VENDOR_LIMIT = 160
export const SUPPLY_NOTES_LIMIT = 500

export type SupplySettingsInput = {
  name: string
  expectedLifespanDays: number | null
  defaultUnitCostMinor?: number | null
}

export type SupplyUsageDetails = {
  label: string | null
  startedOn: string
  vendor?: string | null
  notes?: string | null
  expectedLifespanDays?: number | null
  unitCostMinor?: number | null
}

export type SupplyUsageDates = {
  startedOn: string
  finishedOn?: string | null
}

export type SupplyCostCurrency = MarketProfile['currencyCode']

type SupplyUnitCost = {
  unitCostMinor?: number | null
  costCurrencyCode?: SupplyCostCurrency | null
}

export type SupplyUsageTimeline = SupplyUsageDates & SupplyUnitCost & {
  expectedLifespanDays?: number | null
}

export type SupplySummary = {
  inUse: number
  finished: number
  lastLifespan: number | null
  averageLifespan: number | null
}

export function supplyElapsedDays(startedOn: string, endOn: string): number {
  return (Date.parse(endOn) - Date.parse(startedOn)) / 86_400_000
}

export function getSupplyEstimate(expectedLifespanDays: number, elapsedDays: number) {
  const daysLeft = expectedLifespanDays - elapsedDays
  if (daysLeft === 0) return { status: 'today', days: 0 } as const
  if (daysLeft < 0) return { status: 'past', days: -daysLeft } as const
  return { status: 'remaining', days: daysLeft } as const
}

export function summarizeSupplyUsage(usages: readonly SupplyUsageDates[]): SupplySummary {
  let inUse = 0
  let finished = 0
  let totalDays = 0
  let lastFinishedOn = ''
  let lastLifespan: number | null = null

  for (const usage of usages) {
    if (!usage.finishedOn) {
      inUse += 1
      continue
    }

    const days = supplyElapsedDays(usage.startedOn, usage.finishedOn)
    finished += 1
    totalDays += days
    if (usage.finishedOn > lastFinishedOn) {
      lastFinishedOn = usage.finishedOn
      lastLifespan = days
    }
  }

  return { inUse, finished, lastLifespan, averageLifespan: finished ? totalDays / finished : null }
}

export type SupplyFinishedMonth = {
  month: string
  finished: number
}

export function summarizeSupplyCosts(units: readonly SupplyUnitCost[]) {
  const totals = new Map<SupplyCostCurrency, {
    currencyCode: SupplyCostCurrency
    totalMinor: number
    lowestMinor: number
    highestMinor: number
    units: number
  }>()
  for (const { unitCostMinor, costCurrencyCode } of units) {
    if (unitCostMinor == null || !costCurrencyCode) continue
    const total = totals.get(costCurrencyCode) ?? {
      currencyCode: costCurrencyCode,
      totalMinor: 0,
      lowestMinor: unitCostMinor,
      highestMinor: unitCostMinor,
      units: 0,
    }
    total.units += 1
    total.totalMinor += unitCostMinor
    total.lowestMinor = Math.min(total.lowestMinor, unitCostMinor)
    total.highestMinor = Math.max(total.highestMinor, unitCostMinor)
    totals.set(costCurrencyCode, total)
  }
  return Array.from(totals.values())
}

export type SupplyCostTotals = ReturnType<typeof summarizeSupplyCosts>

type SupplyTrendUsage = SupplyUsageTimeline & {
  id: string
  label?: string | null
}

function supplyFinishMonths(today: string): SupplyFinishedMonth[] {
  const firstOfMonth = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(firstOfMonth)
    date.setUTCMonth(date.getUTCMonth() - 5 + index)
    return { month: date.toISOString().slice(0, 7), finished: 0 }
  })
}

export function getSupplyUsageTrends(usages: readonly SupplyTrendUsage[], today: string) {
  const monthly = supplyFinishMonths(today)
  const counts = new Map(monthly.map((point) => [point.month, point]))
  const completed = []

  for (const usage of usages) {
    const { finishedOn } = usage
    if (!finishedOn) continue
    const month = counts.get(finishedOn.slice(0, 7))
    if (month) month.finished += 1
    completed.push({
      id: usage.id,
      label: usage.label ?? null,
      finishedOn,
      actual: supplyElapsedDays(usage.startedOn, finishedOn),
      expected: usage.expectedLifespanDays ?? null,
    })
  }

  const recent = completed
    .sort((a, b) => b.finishedOn.localeCompare(a.finishedOn))
    .slice(0, 10)
    .reverse()
  return { recent, monthly }
}

export function summarizeSupplyOverview(
  groups: readonly {
    supply: { id: string; name: string; archived: boolean }
    usages: readonly SupplyUsageTimeline[]
  }[],
  today: string,
) {
  const monthly = supplyFinishMonths(today)
  const months = new Map(monthly.map((point) => [point.month, point]))
  const currentMonth = today.slice(0, 7)
  let activeSupplies = 0
  let inUse = 0
  let pastEstimate = 0
  const openedThisMonth: SupplyUnitCost[] = []
  const ranking: { id: string; name: string; finished: number }[] = []

  for (const { supply, usages } of groups) {
    if (!supply.archived) activeSupplies += 1
    let finishes = 0
    for (const usage of usages) {
      const { finishedOn, startedOn, expectedLifespanDays } = usage
      if (startedOn.slice(0, 7) === currentMonth && startedOn <= today) openedThisMonth.push(usage)
      if (finishedOn) {
        if (finishedOn > today) continue
        const month = months.get(finishedOn.slice(0, 7))
        if (month) month.finished += 1
        if (month?.month === currentMonth) finishes += 1
      } else {
        inUse += 1
        if (expectedLifespanDays != null && supplyElapsedDays(startedOn, today) > expectedLifespanDays) {
          pastEstimate += 1
        }
      }
    }
    if (finishes) ranking.push({ id: supply.id, name: supply.name, finished: finishes })
  }

  ranking.sort((a, b) => b.finished - a.finished || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  return {
    activeSupplies,
    inUse,
    pastEstimate,
    finishedThisMonth: months.get(currentMonth)?.finished ?? 0,
    openedThisMonth: openedThisMonth.length,
    costsThisMonth: summarizeSupplyCosts(openedThisMonth),
    monthly,
    topSupplies: ranking.slice(0, 5),
  }
}

export type SupplyOverview = ReturnType<typeof summarizeSupplyOverview>

export function matchesSupplyFilter(
  supply: { name: string; archived: boolean },
  search: string,
  archived: boolean,
) {
  return supply.archived === archived &&
    supply.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
}
