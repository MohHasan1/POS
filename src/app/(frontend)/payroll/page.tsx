import type { Metadata } from 'next'

import { PayrollClient } from '@/components/payroll/PayrollClient'
import { todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import type { PayrollPeriodFilter, PayrollPeriodMode } from '@/lib/payroll-types'
import { getEmployees } from '@/services/employees'
import { getPayrollDashboard } from '@/services/payroll'
import { getShopSettings, marketContextFromSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Payroll' }

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; mode?: string; value?: string }>
}) {
  const [{ dictionary, locale }, employees, settings, params] = await Promise.all([
    getDictionary(),
    getEmployees(true),
    getShopSettings(),
    searchParams,
  ])
  const market = marketContextFromSettings(settings).profile
  const modes: PayrollPeriodMode[] = ['day', 'month', 'year', 'all']
  const mode = modes.includes(params.mode as PayrollPeriodMode)
    ? params.mode as PayrollPeriodMode
    : 'month'
  const today = todayDateInput(market)
  const defaultValue = mode === 'day' ? today : mode === 'month' ? today.slice(0, 7) : today.slice(0, 4)
  const filter: PayrollPeriodFilter = {
    employeeId: employees.some(({ id }) => id === params.employee) ? params.employee : undefined,
    mode,
    value: mode === 'all' ? undefined : params.value || defaultValue,
  }
  const dashboard = await getPayrollDashboard(filter)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.payroll}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.payrollDescription}</p>
      </header>
      <PayrollClient
        key={`${filter.mode}:${filter.value || ''}:${filter.employeeId || ''}`}
        dashboard={dashboard}
        dictionary={dictionary}
        employees={employees}
        locale={locale}
      />
    </div>
  )
}
