const SAUDI_OFFSET_HOURS = 3
const SAUDI_OFFSET_MILLISECONDS = SAUDI_OFFSET_HOURS * 60 * 60 * 1000

export type SaudiPeriodBounds = {
  monthStart: Date
  nextDayStart: Date
  nextMonthStart: Date
  nextYearStart: Date
  todayStart: Date
  yearStart: Date
}

function saudiCalendarStart(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - SAUDI_OFFSET_MILLISECONDS)
}

export function getSaudiPeriodBounds(now = new Date()): SaudiPeriodBounds {
  const shifted = new Date(now.getTime() + SAUDI_OFFSET_MILLISECONDS)
  const year = shifted.getUTCFullYear()
  const month = shifted.getUTCMonth()
  const day = shifted.getUTCDate()

  return {
    todayStart: saudiCalendarStart(year, month, day),
    nextDayStart: saudiCalendarStart(year, month, day + 1),
    monthStart: saudiCalendarStart(year, month, 1),
    nextMonthStart: saudiCalendarStart(year, month + 1, 1),
    yearStart: saudiCalendarStart(year, 0, 1),
    nextYearStart: saudiCalendarStart(year + 1, 0, 1),
  }
}

export function toSaudiISOString(date: Date): string {
  const shifted = new Date(date.getTime() + SAUDI_OFFSET_MILLISECONDS)
  return `${shifted.toISOString().slice(0, 19)}+03:00`
}

export function formatSaudiDateTime(value: string | Date, locale = 'en-SA'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(value))
}

export function formatSaudiDate(value: string | Date, locale = 'en-SA'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'Asia/Riyadh',
  }).format(new Date(value))
}

export function saudiDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + SAUDI_OFFSET_HOURS * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10).replaceAll('-', '')
}
