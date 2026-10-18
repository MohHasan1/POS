import { toCurrency as toArabicCurrency } from 'to-words/ar-SA'
import { toCurrency as toEnglishCurrency } from 'to-words/en-SA'

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

export function amountMinorToWords(amountMinor: number): {
  arabic: string
  english: string
} {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Receipt voucher amount must be a positive whole number of halalas.')
  }

  const amount = minorToDecimal(amountMinor)
  return {
    arabic: toArabicCurrency(amount),
    english: toEnglishCurrency(amount),
  }
}

export function saudiDateToISOString(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new Error('Date must use YYYY-MM-DD format.')
  }

  const result = new Date(`${value}T00:00:00+03:00`)
  if (Number.isNaN(result.getTime())) {
    throw new Error('Invalid date.')
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
  }).formatToParts(result)
  const normalized = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  if (`${normalized.year}-${normalized.month}-${normalized.day}` !== value) {
    throw new Error('Invalid date.')
  }

  return result.toISOString()
}

export function todayInSaudiArabia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function toSaudiDateInput(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
  }).formatToParts(new Date(value))
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${date.year}-${date.month}-${date.day}`
}
