import type { Metadata } from 'next'

import { ExpensesClient } from '@/components/expenses/ExpensesClient'
import { todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import { requirePosAccess } from '@/lib/require-pos-access'
import {
  getDueExpenseOccurrences,
  getExpenseCategories,
  getExpenses,
  getExpenseTemplates,
} from '@/services/expenses'
import { getShopSettings, marketContextFromSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Expenses' }

export default async function ExpensesPage() {
  await requirePosAccess('/expenses')
  const [{ dictionary, locale }, categories, templates, due, expenses, settings] =
    await Promise.all([
      getDictionary(),
      getExpenseCategories(true),
      getExpenseTemplates(true),
      getDueExpenseOccurrences(),
      getExpenses(),
      getShopSettings(),
    ])
  const market = marketContextFromSettings(settings).profile

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.expenses}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.expensesDescription}</p>
      </header>
      <ExpensesClient
        categories={categories}
        dictionary={dictionary}
        dueOccurrences={due}
        expenses={expenses}
        locale={locale}
        market={market}
        templates={templates}
        today={todayDateInput(market)}
      />
    </div>
  )
}
