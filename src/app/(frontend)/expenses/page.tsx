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
import { getExpenseCashLinks } from '@/services/cash-report'

export const metadata: Metadata = { title: 'Expenses' }

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ expense?: string }> }) {
  const query = await searchParams
  await requirePosAccess('/expenses', query)
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
  const cashLinks = await getExpenseCashLinks(market)
  const selectedExpenseId = expenses.find(({ id }) => id === query.expense)?.id

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.expenses}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.expensesDescription}</p>
      </header>
      <ExpensesClient
        key={selectedExpenseId ?? 'all'}
        categories={categories}
        cashLinks={cashLinks}
        dictionary={dictionary}
        dueOccurrences={due}
        expenses={expenses}
        locale={locale}
        market={market}
        selectedExpenseId={selectedExpenseId}
        templates={templates}
        today={todayDateInput(market)}
      />
    </div>
  )
}
