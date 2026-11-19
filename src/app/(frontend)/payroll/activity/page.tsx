import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { PayrollActivityTable } from '@/components/payroll/PayrollActivityTable'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { todayDateInput } from '@/lib/calendar'
import { getDictionary } from '@/lib/localization'
import type { PayrollActivity, PayrollPeriodFilter, PayrollPeriodMode } from '@/lib/payroll-types'
import { cn } from '@/lib/utils'
import { getEmployees } from '@/services/employees'
import { getPayrollDashboard } from '@/services/payroll'
import { getShopSettings, marketContextFromSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Payroll Activity' }

const PAGE_SIZE = 30
const ALL_EMPLOYEES = '__all_employees__'
const periodModes: PayrollPeriodMode[] = ['day', 'month', 'year', 'all']
const activityKinds: Array<PayrollActivity['kind']> = ['monthlySalary', 'commission', 'payout']

export default async function PayrollActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    employee?: string
    kind?: string
    mode?: string
    page?: string
    value?: string
  }>
}) {
  const [{ dictionary, locale }, employees, settings, params] = await Promise.all([
    getDictionary(),
    getEmployees(true),
    getShopSettings(),
    searchParams,
  ])
  const market = marketContextFromSettings(settings).profile
  const mode = periodModes.includes(params.mode as PayrollPeriodMode)
    ? params.mode as PayrollPeriodMode
    : 'month'
  const today = todayDateInput(market)
  const defaultValue = mode === 'day'
    ? today
    : mode === 'month'
      ? today.slice(0, 7)
      : today.slice(0, 4)
  const filter: PayrollPeriodFilter = {
    employeeId: employees.some(({ id }) => id === params.employee) ? params.employee : undefined,
    mode,
    value: mode === 'all' ? undefined : params.value || defaultValue,
  }
  const dashboard = await getPayrollDashboard(filter, null)
  const activityKind = activityKinds.includes(params.kind as PayrollActivity['kind'])
    ? params.kind as PayrollActivity['kind']
    : 'all'
  const filteredActivities = activityKind === 'all'
    ? dashboard.activities
    : dashboard.activities.filter(({ kind }) => kind === activityKind)
  const requestedPage = Number.parseInt(params.page || '1', 10)
  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE))
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), totalPages)
  const activities = filteredActivities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function pageHref(nextPage: number) {
    const values = new URLSearchParams({ mode, page: String(nextPage) })
    if (filter.value) values.set('value', filter.value)
    if (filter.employeeId) values.set('employee', filter.employeeId)
    if (activityKind !== 'all') values.set('kind', activityKind)
    return `/payroll/activity?${values}`
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.payrollActivity}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dictionary.payrollActivityDescription}</p>
        </div>
        <Link className={buttonVariants({ variant: 'ghost' })} href="/payroll">
          <ArrowLeft /> {dictionary.backToPayroll}
        </Link>
      </header>

      <section className="rounded-lg border bg-background p-3">
        <form action="/payroll/activity" className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="activity-period">{dictionary.payrollPeriod}</Label>
            <Select
              name="mode"
              defaultValue={mode}
            >
              <SelectTrigger id="activity-period" className="h-9 min-w-36 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="day">{dictionary.payrollDay}</SelectItem>
                <SelectItem value="month">{dictionary.payrollMonth}</SelectItem>
                <SelectItem value="year">{dictionary.payrollYear}</SelectItem>
                <SelectItem value="all">{dictionary.payrollAllTime}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode !== 'all' && (
            <div className="space-y-1.5">
              <Label htmlFor="activity-period-value">{dictionary.date}</Label>
              <Input
                id="activity-period-value"
                name="value"
                type={mode === 'year' ? 'number' : mode}
                min={mode === 'year' ? '2000' : undefined}
                max={mode === 'year' ? today.slice(0, 4) : mode === 'month' ? today.slice(0, 7) : today}
                defaultValue={filter.value}
                required
              />
            </div>
          )}
          <div className="min-w-52 space-y-1.5">
            <Label htmlFor="activity-employee">{dictionary.employee}</Label>
            <Select
              name="employee"
              defaultValue={filter.employeeId || ALL_EMPLOYEES}
            >
              <SelectTrigger id="activity-employee" className="h-9 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value={ALL_EMPLOYEES}>{dictionary.allEmployees}</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-48 space-y-1.5">
            <Label htmlFor="activity-kind">{dictionary.activityType}</Label>
            <Select
              name="kind"
              defaultValue={activityKind}
            >
              <SelectTrigger id="activity-kind" className="h-9 w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">{dictionary.allActivityTypes}</SelectItem>
                {activityKinds.map((kind) => (
                  <SelectItem key={kind} value={kind}>{dictionary[`payroll_${kind}`]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="secondary">{dictionary.applyFilter}</Button>
          <Link className={buttonVariants({ variant: 'ghost' })} href="/payroll/activity">
            {dictionary.resetFilters}
          </Link>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border bg-background">
        <PayrollActivityTable
          activities={activities}
          dashboard={dashboard}
          dictionary={dictionary}
          employees={employees}
          locale={locale}
        />
        {filteredActivities.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {dictionary.pageOf
                .replace('{page}', String(page))
                .replace('{total}', String(totalPages))}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))} href={pageHref(page - 1)}>
                  {dictionary.previous}
                </Link>
              ) : (
                <Button disabled size="sm" variant="outline">{dictionary.previous}</Button>
              )}
              {page < totalPages ? (
                <Link className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))} href={pageHref(page + 1)}>
                  {dictionary.next}
                </Link>
              ) : (
                <Button disabled size="sm" variant="outline">{dictionary.next}</Button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
