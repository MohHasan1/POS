import { toMarketDateInput } from './calendar'
import type { ExpenseFrequency } from './expense-types'
import type { MarketProfile } from './market'

export type RecurringTemplate = {
  endDate?: null | string
  frequency: ExpenseFrequency
  monthlyDay?: null | number
  startDate: string
  weeklyDay?: null | number
  yearlyDay?: null | number
  yearlyMonth?: null | number
}

function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function dateInput(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function boundedDate(year: number, monthIndex: number, day: number): string {
  return dateInput(
    new Date(Date.UTC(year, monthIndex, Math.min(day, lastDayOfMonth(year, monthIndex)))),
  )
}

export function expenseOccurrenceKey(templateId: string, dueDate: string): string {
  return `${templateId}:${dueDate}`
}

export function recurringOccurrenceDates(
  template: RecurringTemplate,
  profile: MarketProfile,
  throughDate: string,
): string[] {
  const start = toMarketDateInput(template.startDate, profile)
  const end = template.endDate ? toMarketDateInput(template.endDate, profile) : throughDate
  const effectiveEnd = end < throughDate ? end : throughDate
  if (start > effectiveEnd) return []
  const values: string[] = []

  if (template.frequency === 'weekly') {
    const weekday = template.weeklyDay ?? dateFromInput(start).getUTCDay()
    const cursor = dateFromInput(start)
    while (dateInput(cursor) <= effectiveEnd) {
      const candidate = dateInput(cursor)
      if (cursor.getUTCDay() === weekday) values.push(candidate)
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return values
  }

  if (template.frequency === 'monthly') {
    const startDate = dateFromInput(start)
    const targetDay = template.monthlyDay ?? startDate.getUTCDate()
    let year = startDate.getUTCFullYear()
    let monthIndex = startDate.getUTCMonth()
    while (true) {
      const candidate = boundedDate(year, monthIndex, targetDay)
      if (candidate > effectiveEnd) break
      if (candidate >= start) values.push(candidate)
      monthIndex += 1
      if (monthIndex > 11) {
        monthIndex = 0
        year += 1
      }
    }
    return values
  }

  const startDate = dateFromInput(start)
  const targetMonth = (template.yearlyMonth ?? startDate.getUTCMonth() + 1) - 1
  const targetDay = template.yearlyDay ?? startDate.getUTCDate()
  for (let year = startDate.getUTCFullYear(); ; year += 1) {
    const candidate = boundedDate(year, targetMonth, targetDay)
    if (candidate > effectiveEnd) break
    if (candidate >= start) values.push(candidate)
  }
  return values
}
