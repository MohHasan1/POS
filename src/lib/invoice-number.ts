import { marketDateKey } from './calendar'
import { DEFAULT_MARKET, type MarketProfile } from './market'

export function nextInvoiceNumber(
  date: Date,
  previous?: string,
  profile: MarketProfile = DEFAULT_MARKET,
): string {
  const prefix = `INV-${marketDateKey(date, profile)}-`
  const previousSequence = previous?.startsWith(prefix)
    ? Number(previous.slice(prefix.length))
    : 0
  return `${prefix}${String(previousSequence + 1).padStart(4, '0')}`
}
