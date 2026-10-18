const SAUDI_OFFSET_HOURS = 3

export function toSaudiISOString(date: Date): string {
  const shifted = new Date(date.getTime() + SAUDI_OFFSET_HOURS * 60 * 60 * 1000)
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
