import { toCurrency as toArabicCurrency } from 'to-words/ar-SA'
import { toCurrency as toEnglishCurrency } from 'to-words/en-SA'
import { toCurrency as toBanglaCurrency } from 'to-words/bn-IN'
import { toCurrency } from 'to-words'

import { dateInputToISOString, todayDateInput, toMarketDateInput } from '@/lib/calendar'
import { DEFAULT_MARKET, type MarketProfile } from '@/lib/market'
import { minorToDecimal } from '@/lib/money'

export const RECEIPT_VOUCHER_NUMBER_PREFIX = 'RV-'
export const RECEIPT_VOUCHER_NUMBER_DIGITS = 6

export const paymentMethods = ['cash', 'bank_transfer', 'cheque', 'other'] as const
export type PaymentMethod = (typeof paymentMethods)[number]

export function nextReceiptVoucherNumber(previous?: null | string): string {
  if (!previous) {
    return `${RECEIPT_VOUCHER_NUMBER_PREFIX}${'1'.padStart(RECEIPT_VOUCHER_NUMBER_DIGITS, '0')}`
  }

  const match = /^RV-(\d{6,})$/.exec(previous)
  if (!match) {
    throw new Error(`Invalid receipt voucher number: ${previous}`)
  }

  const sequence = Number.parseInt(match[1], 10) + 1
  return `${RECEIPT_VOUCHER_NUMBER_PREFIX}${String(sequence).padStart(RECEIPT_VOUCHER_NUMBER_DIGITS, '0')}`
}

export function amountMinorToWords(amountMinor: number, profile: MarketProfile = DEFAULT_MARKET): {
  arabic?: string
  bangla?: string
  english: string
} {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Receipt voucher amount must be a positive whole number of halalas.')
  }

  const amount = minorToDecimal(amountMinor, profile)
  if (profile.countryCode === 'BD') {
    const currencyOptions = {
      name: 'Taka',
      plural: 'Taka',
      singular: 'Taka',
      symbol: '৳',
      fractionalUnit: {
        name: 'Poisha',
        plural: 'Poisha',
        singular: 'Poisha',
        symbol: '',
      },
    }
    return {
      bangla: toBanglaCurrency(amount),
      english: toCurrency(amount, { localeCode: 'en-IN', currencyOptions }),
    }
  }
  return {
    arabic: toArabicCurrency(amount),
    english: toEnglishCurrency(amount),
  }
}

export function saudiDateToISOString(value: string): string {
  return dateInputToISOString(value, DEFAULT_MARKET)
}

export function todayInSaudiArabia(): string {
  return todayDateInput(DEFAULT_MARKET)
}

export function toSaudiDateInput(value: string | Date): string {
  return toMarketDateInput(value, DEFAULT_MARKET)
}

export const marketDateToISOString = dateInputToISOString
export const todayInMarket = todayDateInput
export const toMarketDateInputValue = toMarketDateInput
