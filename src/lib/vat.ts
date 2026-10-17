export type VatCategory = 'standard' | 'zero' | 'exempt'

export const VAT_RATES_BPS: Record<VatCategory, number> = {
  standard: 1500,
  zero: 0,
  exempt: 0,
}

export type CalculableLine = {
  priceIncludesVat: boolean
  quantityMilliunits: number
  unitPriceMinor: number
  vatCategory: VatCategory
}

export type CalculatedLine = CalculableLine & {
  netMinor: number
  totalMinor: number
  vatMinor: number
  vatRateBps: number
}

export function calculateLine(line: CalculableLine): CalculatedLine {
  if (!Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor < 0) {
    throw new Error('Unit price must be a non-negative integer in minor units.')
  }
  if (!Number.isSafeInteger(line.quantityMilliunits) || line.quantityMilliunits < 1) {
    throw new Error('Quantity must be a positive integer in thousandths.')
  }

  const vatRateBps = VAT_RATES_BPS[line.vatCategory]
  const enteredMinor = Math.round((line.unitPriceMinor * line.quantityMilliunits) / 1000)

  if (line.priceIncludesVat && vatRateBps > 0) {
    const netMinor = Math.round((enteredMinor * 10_000) / (10_000 + vatRateBps))
    return {
      ...line,
      vatRateBps,
      netMinor,
      vatMinor: enteredMinor - netMinor,
      totalMinor: enteredMinor,
    }
  }

  const vatMinor = Math.round((enteredMinor * vatRateBps) / 10_000)
  return {
    ...line,
    vatRateBps,
    netMinor: enteredMinor,
    vatMinor,
    totalMinor: enteredMinor + vatMinor,
  }
}

export function calculateInvoiceTotals(lines: CalculatedLine[]) {
  return lines.reduce(
    (totals, line) => ({
      subtotalMinor: totals.subtotalMinor + line.netMinor,
      vatMinor: totals.vatMinor + line.vatMinor,
      totalMinor: totals.totalMinor + line.totalMinor,
    }),
    { subtotalMinor: 0, vatMinor: 0, totalMinor: 0 },
  )
}
