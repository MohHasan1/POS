import type { Metadata } from 'next'

import { ServiceBoardClient } from '@/components/service-board/ServiceBoardClient'
import { dateInputToISOString, todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import { employeeRelationshipId, getEmployees } from '@/services/employees'
import { getProducts } from '@/services/products'
import { getServiceBoardView } from '@/services/service-board'
import {
  areShopSettingsComplete,
  getShopSettings,
  marketContextFromSettings,
} from '@/services/settings'
import { getSalesThroughDate } from '@/services/sales-reporting'

export const metadata: Metadata = { title: 'Service Board' }

export default async function ServiceBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const [{ dictionary, locale }, employees, products, settings, { date }] = await Promise.all([
    getDictionary(),
    getEmployees(),
    getProducts(),
    getShopSettings(),
    searchParams,
  ])
  const market = marketContextFromSettings(settings)
  const today = todayDateInput(market.profile)
  let selectedDate = today
  if (date) {
    try {
      dateInputToISOString(date, market.profile)
      selectedDate = date
    } catch {
      selectedDate = today
    }
  }
  const selectedDateStart = new Date(dateInputToISOString(selectedDate, market.profile))
  const [view, salesThroughDate] = await Promise.all([
    getServiceBoardView(selectedDateStart),
    getSalesThroughDate(selectedDateStart),
  ])
  const configuredDefaultEmployeeId = employeeRelationshipId(settings.defaultEmployee)
  const defaultEmployeeId = employees.some(({ id }) => id === configuredDefaultEmployeeId)
    ? configuredDefaultEmployeeId
    : undefined

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.serviceBoard}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.serviceBoardDescription}</p>
      </header>
      <ServiceBoardClient
        allProducts={products}
        autoTranslateProducts={market.autoTranslateProducts}
        defaultEmployeeId={defaultEmployeeId}
        defaultPriceIncludesVat={settings.defaultPriceIncludesVat ?? false}
        dictionary={dictionary}
        employees={employees}
        locale={locale}
        selectedDate={selectedDate}
        settingsReady={areShopSettingsComplete(settings)}
        todayDate={today}
        view={view}
        salesThroughDate={salesThroughDate}
      />
    </div>
  )
}
