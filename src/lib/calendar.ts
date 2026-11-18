import type { MarketProfile } from './market'

export type PeriodBounds = {
  monthStart: Date
  nextDayStart: Date
  nextMonthStart: Date
  nextYearStart: Date
  todayStart: Date
  yearStart: Date
}

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(value)
  const record = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    day: Number(record.day),
    hour: Number(record.hour),
    minute: Number(record.minute),
    month: Number(record.month),
    second: Number(record.second),
    year: Number(record.year),
  }
}

function zonedCalendarStart(year: number, monthIndex: number, day: number, timeZone: string): Date {
  const normalized = new Date(Date.UTC(year, monthIndex, day))
  const target = Date.UTC(
    normalized.getUTCFullYear(),
    normalized.getUTCMonth(),
    normalized.getUTCDate(),
  )
  let candidate = new Date(target)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(candidate, timeZone)
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    candidate = new Date(candidate.getTime() + target - represented)
  }
  return candidate
}

export function getPeriodBounds(profile: MarketProfile, now = new Date()): PeriodBounds {
  const { day, month, year } = zonedParts(now, profile.timeZone)
  return {
    todayStart: zonedCalendarStart(year, month - 1, day, profile.timeZone),
    nextDayStart: zonedCalendarStart(year, month - 1, day + 1, profile.timeZone),
    monthStart: zonedCalendarStart(year, month - 1, 1, profile.timeZone),
    nextMonthStart: zonedCalendarStart(year, month, 1, profile.timeZone),
    yearStart: zonedCalendarStart(year, 0, 1, profile.timeZone),
    nextYearStart: zonedCalendarStart(year + 1, 0, 1, profile.timeZone),
  }
}

export function formatMarketDateTime(
  value: string | Date,
  profile: MarketProfile,
  locale = profile.locale,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: profile.timeZone,
  }).format(new Date(value))
}

export function formatMarketDate(
  value: string | Date,
  profile: MarketProfile,
  locale = profile.locale,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: profile.timeZone,
  }).format(new Date(value))
}

export function marketDateKey(date: Date, profile: MarketProfile): string {
  const { day, month, year } = zonedParts(date, profile.timeZone)
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`
}

export function dateInputToISOString(value: string, profile: MarketProfile): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Date must use YYYY-MM-DD format.')
  const result = zonedCalendarStart(Number(match[1]), Number(match[2]) - 1, Number(match[3]), profile.timeZone)
  const parts = zonedParts(result, profile.timeZone)
  if (`${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}` !== value) {
    throw new Error('Invalid date.')
  }
  return result.toISOString()
}

export function todayDateInput(profile: MarketProfile, now = new Date()): string {
  const { day, month, year } = zonedParts(now, profile.timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function toMarketDateInput(value: string | Date, profile: MarketProfile): string {
  return todayDateInput(profile, new Date(value))
}

