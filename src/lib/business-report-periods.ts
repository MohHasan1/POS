import { dateInputToISOString, todayDateInput } from './calendar'
import type { BusinessReportFilter, BusinessReportRange } from './business-report-types'
import type { MarketProfile } from './market'

type ResolvedReportPeriod = {
  comparison?: BusinessReportRange
  selected: BusinessReportRange
}

function inputDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function shiftDay(value: string, amount: number): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return inputDate(date)
}

function shiftMonth(value: string, amount: number): string {
  const [year, month] = value.split('-').map(Number)
  return inputDate(new Date(Date.UTC(year, month - 1 + amount, 1)))
}

function startOfYear(value: string, amount = 0): string {
  return `${Number(value.slice(0, 4)) + amount}-01-01`
}

function isoRange(start: string, end: string, profile: MarketProfile): BusinessReportRange {
  return {
    end: dateInputToISOString(end, profile),
    start: dateInputToISOString(start, profile),
  }
}

function elapsedComparison(
  selectedStart: string,
  selectedEnd: string,
  comparisonStart: string,
  comparisonLimit: string,
): BusinessReportRange {
  const elapsed = new Date(selectedEnd).getTime() - new Date(selectedStart).getTime()
  const end = Math.min(
    new Date(comparisonStart).getTime() + elapsed,
    new Date(comparisonLimit).getTime(),
  )
  return { start: comparisonStart, end: new Date(end).toISOString() }
}

export function resolveBusinessReportPeriod(
  filter: BusinessReportFilter,
  profile: MarketProfile,
  now = new Date(),
): ResolvedReportPeriod {
  if (filter.period === 'all') return { selected: {} }
  const today = todayDateInput(profile, now)
  const todayStart = dateInputToISOString(today, profile)

  if (filter.period === 'today') {
    const yesterday = shiftDay(today, -1)
    const yesterdayStart = dateInputToISOString(yesterday, profile)
    return {
      selected: { start: todayStart, end: now.toISOString() },
      comparison: elapsedComparison(todayStart, now.toISOString(), yesterdayStart, todayStart),
    }
  }

  if (filter.period === 'yesterday') {
    const yesterday = shiftDay(today, -1)
    return {
      selected: isoRange(yesterday, today, profile),
      comparison: isoRange(shiftDay(today, -2), yesterday, profile),
    }
  }

  const thisMonth = `${today.slice(0, 7)}-01`
  const previousMonth = shiftMonth(thisMonth, -1)
  if (filter.period === 'month') {
    const monthStart = dateInputToISOString(thisMonth, profile)
    const previousStart = dateInputToISOString(previousMonth, profile)
    return {
      selected: { start: monthStart, end: now.toISOString() },
      comparison: elapsedComparison(
        monthStart,
        now.toISOString(),
        previousStart,
        dateInputToISOString(thisMonth, profile),
      ),
    }
  }

  if (filter.period === 'previousMonth') {
    const twoMonthsAgo = shiftMonth(thisMonth, -2)
    return {
      selected: isoRange(previousMonth, thisMonth, profile),
      comparison: isoRange(twoMonthsAgo, previousMonth, profile),
    }
  }

  const thisYear = startOfYear(today)
  const previousYear = startOfYear(today, -1)
  if (filter.period === 'year') {
    const yearStart = dateInputToISOString(thisYear, profile)
    const previousStart = dateInputToISOString(previousYear, profile)
    return {
      selected: { start: yearStart, end: now.toISOString() },
      comparison: elapsedComparison(
        yearStart,
        now.toISOString(),
        previousStart,
        dateInputToISOString(thisYear, profile),
      ),
    }
  }

  if (filter.period === 'previousYear') {
    return {
      selected: isoRange(previousYear, thisYear, profile),
      comparison: isoRange(startOfYear(today, -2), previousYear, profile),
    }
  }

  const start = /^\d{4}-\d{2}-\d{2}$/.test(filter.startDate || '') ? filter.startDate! : today
  const inclusiveEnd = /^\d{4}-\d{2}-\d{2}$/.test(filter.endDate || '') ? filter.endDate! : start
  const normalizedEnd = inclusiveEnd < start ? start : inclusiveEnd
  const selected = isoRange(start, shiftDay(normalizedEnd, 1), profile)
  const durationDays = Math.max(
    1,
    Math.round(
      (new Date(`${shiftDay(normalizedEnd, 1)}T00:00:00Z`).getTime() -
        new Date(`${start}T00:00:00Z`).getTime()) /
        86_400_000,
    ),
  )
  const comparisonEnd = start
  const comparisonStart = shiftDay(start, -durationDays)
  return {
    selected,
    comparison: isoRange(comparisonStart, comparisonEnd, profile),
  }
}

export function dateInBusinessRange(value: string, range: BusinessReportRange): boolean {
  const time = new Date(value).getTime()
  return (
    (range.start === undefined || time >= new Date(range.start).getTime()) &&
    (range.end === undefined || time < new Date(range.end).getTime())
  )
}
