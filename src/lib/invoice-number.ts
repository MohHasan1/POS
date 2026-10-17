import { saudiDateKey } from './saudi-time'

export function nextInvoiceNumber(date: Date, previous?: string): string {
  const prefix = `INV-${saudiDateKey(date)}-`
  const previousSequence = previous?.startsWith(prefix)
    ? Number(previous.slice(prefix.length))
    : 0
  return `${prefix}${String(previousSequence + 1).padStart(4, '0')}`
}
