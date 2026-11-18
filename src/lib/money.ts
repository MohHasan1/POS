import { DEFAULT_MARKET, type MarketProfile } from './market'

export const SAR_MINOR_UNITS = 100

export function minorUnitFactor(profile: Pick<MarketProfile, 'minorUnitDigits'>): number {
  return 10 ** profile.minorUnitDigits
}

export function formatMoney(
  minor: number,
  profile: Pick<MarketProfile, 'currencyCode' | 'currencySymbol' | 'minorUnitDigits'>,
  locale = 'en',
  document = false,
): string {
  const amount = minor / minorUnitFactor(profile)
  if (profile.currencyCode === 'BDT' && !document) {
    return `${profile.currencySymbol}${new Intl.NumberFormat(locale, {
      minimumFractionDigits: profile.minorUnitDigits,
      maximumFractionDigits: profile.minorUnitDigits,
    }).format(amount)}`
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: profile.currencyCode,
    minimumFractionDigits: profile.minorUnitDigits,
    maximumFractionDigits: profile.minorUnitDigits,
  }).format(amount)
}

export function formatSAR(minor: number, locale = 'en-SA'): string {
  return formatMoney(minor, DEFAULT_MARKET, locale)
}

export function minorToDecimal(
  minor: number,
  profile: Pick<MarketProfile, 'minorUnitDigits'> = DEFAULT_MARKET,
): string {
  return (minor / minorUnitFactor(profile)).toFixed(profile.minorUnitDigits)
}

export function decimalToMinor(
  value: string,
  profile: Pick<MarketProfile, 'minorUnitDigits'> = DEFAULT_MARKET,
): number | null {
  const normalized = value.trim()
  const match = new RegExp(`^(\\d+)(?:\\.(\\d{1,${profile.minorUnitDigits}}))?$`).exec(normalized)
  if (!match) return null

  const whole = Number(match[1])
  const fraction = (match[2] || '').padEnd(profile.minorUnitDigits, '0')
  const minor = whole * minorUnitFactor(profile) + Number(fraction)

  return Number.isSafeInteger(minor) ? minor : null
}

export function formatQuantity(quantityMilliunits: number, locale = 'en-SA'): string {
  return (quantityMilliunits / 1000).toLocaleString(locale, {
    maximumFractionDigits: 3,
  })
}
