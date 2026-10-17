export const SAR_MINOR_UNITS = 100

export function formatSAR(minor: number, locale = 'en-SA'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(minor / SAR_MINOR_UNITS)
}

export function minorToDecimal(minor: number): string {
  return (minor / SAR_MINOR_UNITS).toFixed(2)
}

export function decimalToMinor(value: string): number | null {
  const normalized = value.trim()
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized)
  if (!match) return null

  const whole = Number(match[1])
  const fraction = (match[2] || '').padEnd(2, '0')
  const minor = whole * SAR_MINOR_UNITS + Number(fraction)

  return Number.isSafeInteger(minor) ? minor : null
}

export function formatQuantity(quantityMilliunits: number): string {
  return (quantityMilliunits / 1000).toLocaleString('en-SA', {
    maximumFractionDigits: 3,
  })
}
