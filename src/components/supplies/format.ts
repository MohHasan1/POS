import type { Dictionary, Locale } from '@/lib/localization'
import { MARKET_PROFILES, marketLocale, type MarketProfile } from '@/lib/market'
import { formatMoney } from '@/lib/money'
import { getSupplyEstimate, type SupplyCostCurrency, type SupplyCostTotals } from '@/lib/supplies'

type Labels = Dictionary['supplyTracker']

export function supplyNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

export function supplyDayLabel(days: number, locale: Locale, labels: Labels) {
  const value = supplyNumber(days, locale)
  return (value === supplyNumber(1, locale) ? labels.oneDay : labels.days).replace('{days}', value)
}

export function supplyLifespanLabel(days: number, locale: Locale, labels: Labels) {
  return days === 0 ? labels.sameDay : supplyDayLabel(days, locale, labels)
}

export function supplyEstimateLabel(expected: number, elapsed: number, locale: Locale, labels: Labels) {
  const { status, days } = getSupplyEstimate(expected, elapsed)
  if (status === 'today') return labels.expectedToday
  const pattern = status === 'past'
    ? days === 1 ? labels.oneDayPast : labels.daysPast
    : days === 1 ? labels.oneDayLeft : labels.daysLeft
  return pattern.replace('{days}', supplyNumber(days, locale))
}

export function supplyLifespanComparison(expected: number, actual: number, locale: Locale, labels: Labels) {
  const difference = actual - expected
  if (difference === 0) return labels.asExpected
  const pattern = difference < 0 ? labels.shorterThanExpected : labels.longerThanExpected
  return pattern.replace('{duration}', supplyDayLabel(Math.abs(difference), locale, labels))
}

export function supplyDateLabel(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(date))
}

export function supplyCostMarket(currencyCode: SupplyCostCurrency | null | undefined, market: MarketProfile) {
  return Object.values(MARKET_PROFILES).find((profile) => profile.currencyCode === currencyCode) ?? market
}

export function supplyCostLabel(costMinor: number, currencyCode: SupplyCostCurrency | null | undefined, market: MarketProfile, locale: Locale) {
  const costMarket = supplyCostMarket(currencyCode, market)
  return formatMoney(costMinor, costMarket, marketLocale(costMarket, locale))
}

export function supplyCostTotalsLabel(
  costs: SupplyCostTotals,
  market: MarketProfile,
  locale: Locale,
  amount = (cost: SupplyCostTotals[number]) => cost.totalMinor,
) {
  return costs.map((cost) => supplyCostLabel(amount(cost), cost.currencyCode, market, locale)).join(' · ') || '—'
}
