'use client'

import { Banknote, Pencil, Percent, WalletCards } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'

import {
  correctCommissionAction,
  recordMonthlySalaryAction,
  recordPayoutAction,
  updatePayrollEntryAction,
} from '@/actions/payroll'
import { CompensationPlanBadge } from '@/components/employees/CompensationPlanBadge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatMarketDate, toMarketDateInput, todayDateInput } from '@/lib/calendar'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale } from '@/lib/market'
import { decimalToMinor, formatMoney, minorToDecimal } from '@/lib/money'
import type {
  PayrollActivity,
  PayrollDashboard,
  PayrollPaymentMethod,
  PayrollPeriodMode,
} from '@/lib/payroll-types'
import type { Employee } from '@/payload-types'

export type PayrollDialogKind = 'commission' | 'edit' | 'monthly' | 'payout' | null

const planLabels = {
  commission: 'compensation_commission',
  monthly: 'compensation_monthly',
  unconfigured: 'compensation_unconfigured',
} as const

export function PayrollClient({
  dashboard,
  dictionary,
  employees,
  locale,
}: {
  dashboard: PayrollDashboard
  dictionary: Dictionary
  employees: Employee[]
  locale: Locale
}) {
  const router = useRouter()
  const dateLocale = marketLocale(dashboard.market, locale)
  const today = todayDateInput(dashboard.market)
  const [dialog, setDialog] = useState<PayrollDialogKind>(null)
  const [selectedActivity, setSelectedActivity] = useState<PayrollActivity | null>(null)
  const [preferredEmployeeId, setPreferredEmployeeId] = useState<string>()
  const [preferredSalaryMonth, setPreferredSalaryMonth] = useState<string>()
  const [filterMode, setFilterMode] = useState<PayrollPeriodMode>(dashboard.filter.mode)
  const [filterValue, setFilterValue] = useState(dashboard.filter.value || '')
  const [filterEmployee, setFilterEmployee] = useState(dashboard.filter.employeeId || '')
  const money = (amount: number) => formatMoney(amount, dashboard.market, dateLocale)
  const activityParams = new URLSearchParams({ mode: dashboard.filter.mode })
  if (dashboard.filter.value) activityParams.set('value', dashboard.filter.value)
  if (dashboard.filter.employeeId) activityParams.set('employee', dashboard.filter.employeeId)
  const allActivityHref = `/payroll/activity?${activityParams}`

  const metricCards = [
    [dictionary.fixedSalaryEarned, dashboard.metrics.fixedEarnedMinor],
    [dictionary.commissionEarned, dashboard.metrics.commissionEarnedMinor],
    [dictionary.totalEarned, dashboard.metrics.totalEarnedMinor],
    [dictionary.totalPaid, dashboard.metrics.paidMinor],
    [dictionary.currentBalance, dashboard.metrics.currentBalanceMinor],
  ] as const

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams({ mode: filterMode })
    if (filterMode !== 'all' && filterValue) params.set('value', filterValue)
    if (filterEmployee) params.set('employee', filterEmployee)
    router.push(`/payroll?${params}`)
  }

  function resetFilters() {
    setFilterMode('month')
    setFilterValue(today.slice(0, 7))
    setFilterEmployee('')
    router.push('/payroll')
  }

  function openActivity(activity: PayrollActivity) {
    setPreferredEmployeeId(undefined)
    setPreferredSalaryMonth(undefined)
    setSelectedActivity(activity)
    setDialog(activity.kind === 'commission' ? 'commission' : 'edit')
  }

  function openMonthlySalary(employeeId?: string, salaryMonth?: string) {
    setPreferredEmployeeId(employeeId)
    setPreferredSalaryMonth(salaryMonth)
    setSelectedActivity(null)
    setDialog('monthly')
  }

  function openPayout(employeeId?: string) {
    setPreferredEmployeeId(employeeId)
    setPreferredSalaryMonth(undefined)
    setSelectedActivity(null)
    setDialog('payout')
  }

  return (
    <>
      <section className="rounded-lg border bg-background p-3">
        <form className="flex flex-col gap-3 lg:flex-row lg:items-end" onSubmit={applyFilter}>
          <div className="space-y-1.5">
            <Label htmlFor="payroll-period">{dictionary.payrollPeriod}</Label>
            <select
              id="payroll-period"
              className="h-9 min-w-36 rounded-md border bg-background px-3 text-sm"
              value={filterMode}
              onChange={(event) => {
                const mode = event.target.value as PayrollPeriodMode
                setFilterMode(mode)
                setFilterValue(mode === 'day' ? today : mode === 'month' ? today.slice(0, 7) : mode === 'year' ? today.slice(0, 4) : '')
              }}
            >
              <option value="day">{dictionary.payrollDay}</option>
              <option value="month">{dictionary.payrollMonth}</option>
              <option value="year">{dictionary.payrollYear}</option>
              <option value="all">{dictionary.payrollAllTime}</option>
            </select>
          </div>
          {filterMode !== 'all' && (
            <div className="space-y-1.5">
              <Label htmlFor="payroll-period-value">{dictionary.date}</Label>
              <Input
                id="payroll-period-value"
                type={filterMode === 'year' ? 'number' : filterMode}
                min={filterMode === 'year' ? '2000' : undefined}
                max={filterMode === 'year' ? today.slice(0, 4) : filterMode === 'month' ? today.slice(0, 7) : today}
                required
                value={filterValue}
                onChange={(event) => setFilterValue(event.target.value)}
              />
            </div>
          )}
          <div className="min-w-56 space-y-1.5">
            <Label htmlFor="payroll-employee-filter">{dictionary.employee}</Label>
            <select
              id="payroll-employee-filter"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={filterEmployee}
              onChange={(event) => setFilterEmployee(event.target.value)}
            >
              <option value="">{dictionary.allEmployees}</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </div>
          <Button type="submit" variant="secondary">{dictionary.applyFilter}</Button>
          <Button type="button" variant="ghost" onClick={resetFilters}>{dictionary.resetFilters}</Button>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <Button type="button" variant="success" onClick={() => openMonthlySalary()}>
              <WalletCards /> {dictionary.confirmMonthlySalary}
            </Button>
            <Button type="button" variant="secondary" onClick={() => openPayout()}>
              <Banknote /> {dictionary.recordPayout}
            </Button>
          </div>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map(([label, value], index) => (
          <article key={label} className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={`mt-2 text-xl font-semibold tabular-nums ${index === 4 && value < 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              {money(value)}
            </p>
            {index === 4 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {value < 0 ? dictionary.employeeAdvance : dictionary.amountOwed}
              </p>
            )}
          </article>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <section className="overflow-hidden rounded-lg border bg-background">
          <div className="border-b px-4 py-3"><h2 className="font-medium">{dictionary.employeeBalances}</h2></div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{dictionary.employee}</TableHead>
                <TableHead>{dictionary.compensationPlan}</TableHead>
                <TableHead className="text-right">{dictionary.salesGenerated}</TableHead>
                <TableHead className="text-right">{dictionary.totalEarned}</TableHead>
                <TableHead className="text-right">{dictionary.totalPaid}</TableHead>
                <TableHead className="text-right">{dictionary.currentBalance}</TableHead>
                <TableHead className="text-right">{dictionary.actions}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {dashboard.employeeSummaries.map((summary) => (
                  <TableRow key={summary.employeeId}>
                    <TableCell className="font-medium">{summary.employeeName}</TableCell>
                    <TableCell>
                      <CompensationPlanBadge
                        label={dictionary[planLabels[summary.compensationType]]}
                        type={summary.compensationType}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(summary.salesGeneratedMinor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(summary.totalEarnedMinor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(summary.paidMinor)}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${summary.currentBalanceMinor < 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                      {money(summary.currentBalanceMinor)}
                    </TableCell>
                    <TableCell className="flex justify-end gap-2 whitespace-nowrap">
                      {summary.compensationType === 'unconfigured' && (
                        <Button
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => router.push(`/employees?compensation=${summary.employeeId}`)}
                        >
                          <WalletCards /> {dictionary.setupPay}
                        </Button>
                      )}
                      {summary.compensationType === 'monthly' && !summary.salaryConfirmedForActionMonth && (
                        <Button
                          size="sm"
                          type="button"
                          variant="success"
                          onClick={() => openMonthlySalary(summary.employeeId, dashboard.salaryActionMonth)}
                        >
                          <WalletCards /> {dictionary.confirmSalary}
                        </Button>
                      )}
                      {summary.compensationType !== 'unconfigured' && (
                        <Button size="sm" type="button" variant="secondary" onClick={() => openPayout(summary.employeeId)}>
                          <Banknote /> {dictionary.payEmployee}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="rounded-lg border bg-background">
          <div className="border-b px-4 py-3"><h2 className="font-medium">{dictionary.commissionByService}</h2></div>
          {dashboard.commissionBreakdown.length ? (
            <div className="divide-y">
              {dashboard.commissionBreakdown.map((item) => (
                <div key={item.serviceName} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="truncate">{item.serviceName}</span>
                  <span className="font-medium tabular-nums">{money(item.amountMinor)}</span>
                </div>
              ))}
            </div>
          ) : <p className="p-6 text-center text-sm text-muted-foreground">{dictionary.noCommissionActivity}</p>}
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border bg-background">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="font-medium">{dictionary.recentPayrollActivity}</h2>
          <Link className="text-sm font-medium text-primary hover:underline" href={allActivityHref}>
            {dictionary.viewAllPayrollActivity}
          </Link>
        </div>
        {dashboard.activities.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{dictionary.date}</TableHead>
                <TableHead>{dictionary.employee}</TableHead>
                <TableHead>{dictionary.type}</TableHead>
                <TableHead>{dictionary.invoiceNumber}</TableHead>
                <TableHead className="text-right">{dictionary.amount}</TableHead>
                <TableHead className="text-right">{dictionary.actions}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {dashboard.activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>{formatMarketDate(activity.date, dashboard.market, dateLocale)}</TableCell>
                    <TableCell className="font-medium">{activity.employeeName}</TableCell>
                    <TableCell>
                      <span>{dictionary[`payroll_${activity.kind}`]}</span>
                      {activity.serviceName && <span className="block text-xs text-muted-foreground">{activity.serviceName}</span>}
                    </TableCell>
                    <TableCell>
                      {activity.invoiceId ? <Link className="text-sm underline underline-offset-2" href={`/invoices/${activity.invoiceId}`}>{activity.invoiceNumber}</Link> : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {money(activity.correctedAmountMinor ?? activity.amountMinor)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openActivity(activity)}>
                        {activity.kind === 'commission' ? <Percent /> : <Pencil />}
                        {activity.kind === 'commission' ? dictionary.correctCommission : dictionary.edit}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <p className="p-8 text-center text-sm text-muted-foreground">{dictionary.noPayrollActivity}</p>}
      </section>

      <PayrollDialog
        key={`${dialog || 'closed'}:${selectedActivity?.id || preferredEmployeeId || 'new'}:${preferredSalaryMonth || 'current'}`}
        activity={selectedActivity}
        dashboard={dashboard}
        dictionary={dictionary}
        employees={employees}
        kind={dialog}
        preferredEmployeeId={preferredEmployeeId}
        preferredSalaryMonth={preferredSalaryMonth}
        onClose={() => {
          setDialog(null)
          setSelectedActivity(null)
          setPreferredEmployeeId(undefined)
          setPreferredSalaryMonth(undefined)
        }}
      />
    </>
  )
}

export function PayrollDialog({
  activity,
  dashboard,
  dictionary,
  employees,
  kind,
  onClose,
  preferredEmployeeId,
  preferredSalaryMonth,
}: {
  activity: PayrollActivity | null
  dashboard: PayrollDashboard
  dictionary: Dictionary
  employees: Employee[]
  kind: PayrollDialogKind
  onClose: () => void
  preferredEmployeeId?: string
  preferredSalaryMonth?: string
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const today = todayDateInput(dashboard.market)
  const candidates = useMemo(() => {
    if (kind === 'monthly') return employees.filter(({ active, compensationType }) => active && compensationType === 'monthly')
    return employees
  }, [employees, kind])
  const initialEmployee = activity?.employeeId || preferredEmployeeId || candidates[0]?.id || ''
  const [employeeId, setEmployeeId] = useState(initialEmployee)
  const selectedEmployee = candidates.find(({ id }) => id === employeeId) || employees.find(({ id }) => id === employeeId)
  const [amount, setAmount] = useState(
    activity ? minorToDecimal(activity.correctedAmountMinor ?? activity.amountMinor, dashboard.market) :
      kind === 'monthly' && selectedEmployee?.monthlySalaryMinor
        ? minorToDecimal(selectedEmployee.monthlySalaryMinor, dashboard.market)
        : '',
  )
  const [entryDate, setEntryDate] = useState(activity ? toMarketDateInput(activity.date, dashboard.market) : today)
  const [salaryMonth, setSalaryMonth] = useState(
    activity?.salaryMonth || preferredSalaryMonth || today.slice(0, 7),
  )
  const [paymentMethod, setPaymentMethod] = useState<PayrollPaymentMethod>(activity?.paymentMethod || 'cash')
  const [reference, setReference] = useState(activity?.reference || '')
  const [note, setNote] = useState(activity?.note || '')
  const [payoutAmount, setPayoutAmount] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountMinor = decimalToMinor(amount, dashboard.market)
    if (amountMinor === null || amountMinor < (kind === 'commission' ? 0 : 1) || !employeeId) {
      setError(dictionary.payrollAmountError)
      return
    }
    setError('')
    startTransition(async () => {
      let result
      if (kind === 'commission' && activity?.invoiceId && activity.invoiceItemId) {
        result = await correctCommissionAction({
          correctedAmountMinor: amountMinor,
          invoiceId: activity.invoiceId,
          invoiceItemId: activity.invoiceItemId,
          note,
        })
      } else if (kind === 'edit' && activity) {
        result = await updatePayrollEntryAction(activity.id, {
          amountMinor,
          employeeId,
          entryDate,
          note,
          paymentMethod,
          reference,
          salaryMonth: activity.kind === 'monthlySalary' ? salaryMonth : undefined,
        })
      } else if (kind === 'monthly') {
        const payoutMinor = payoutAmount.trim() ? decimalToMinor(payoutAmount, dashboard.market) : null
        if (payoutAmount.trim() && (!payoutMinor || payoutMinor < 1)) {
          setError(dictionary.payrollAmountError)
          return
        }
        result = await recordMonthlySalaryAction({
          amountMinor,
          employeeId,
          idempotencyKey: crypto.randomUUID(),
          note,
          salaryMonth,
          payout: payoutMinor ? {
            amountMinor: payoutMinor,
            entryDate,
            idempotencyKey: crypto.randomUUID(),
            note,
            paymentMethod,
            reference,
          } : undefined,
        })
      } else {
        result = await recordPayoutAction({
          amountMinor,
          employeeId,
          entryDate,
          idempotencyKey: crypto.randomUUID(),
          note,
          paymentMethod,
          reference,
        })
      }
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const title = kind === 'monthly' ? dictionary.confirmMonthlySalary
      : kind === 'payout' ? dictionary.recordPayout
        : kind === 'commission' ? dictionary.correctCommission
          : dictionary.editPayrollEntry

  return (
    <Dialog open={Boolean(kind)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{activity?.employeeName || dictionary.payrollDescription}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {kind !== 'commission' && (
            <div className="space-y-1.5">
              <Label htmlFor="payroll-dialog-employee">{dictionary.employee}</Label>
              <select
                id="payroll-dialog-employee"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                disabled={kind === 'edit'}
                required
                value={employeeId}
                onChange={(event) => {
                  const next = event.target.value
                  setEmployeeId(next)
                  if (kind === 'monthly') {
                    const employee = employees.find(({ id }) => id === next)
                    setAmount(employee?.monthlySalaryMinor ? minorToDecimal(employee.monthlySalaryMinor, dashboard.market) : '')
                  }
                }}
              >
                <option value="" disabled>{dictionary.noEmployee}</option>
                {candidates.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </div>
          )}

          {kind === 'monthly' || (kind === 'edit' && activity?.kind === 'monthlySalary') ? (
            <div className="space-y-1.5">
              <Label htmlFor="payroll-salary-month">{dictionary.salaryMonth}</Label>
              <Input id="payroll-salary-month" type="month" max={today.slice(0, 7)} required value={salaryMonth} onChange={(event) => setSalaryMonth(event.target.value)} />
            </div>
          ) : kind !== 'commission' && (
            <div className="space-y-1.5">
              <Label htmlFor="payroll-entry-date">{kind === 'payout' || activity?.kind === 'payout' ? dictionary.payoutDate : dictionary.salaryDate}</Label>
              <Input id="payroll-entry-date" type="date" max={today} required value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="payroll-amount">
              {kind === 'commission' ? dictionary.correctedCommission : kind === 'payout' || activity?.kind === 'payout' ? dictionary.payoutAmount : dictionary.salaryAmount}
            </Label>
            <Input id="payroll-amount" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />
            {kind === 'commission' && activity && (
              <p className="text-xs text-muted-foreground">{dictionary.originalCommission}: {formatMoney(activity.amountMinor, dashboard.market)}</p>
            )}
          </div>

          {kind === 'monthly' && (
            <div className="space-y-1.5">
              <Label htmlFor="payroll-paid-now">{dictionary.paidNowOptional}</Label>
              <Input id="payroll-paid-now" inputMode="decimal" value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} />
            </div>
          )}

          {(kind === 'payout' ||
            (kind === 'edit' && activity?.kind !== 'monthlySalary') ||
            (kind === 'monthly' && payoutAmount.trim())) && (
            <PaymentFields
              dictionary={dictionary}
              method={paymentMethod}
              note={note}
              onMethod={setPaymentMethod}
              onNote={setNote}
              onReference={setReference}
              reference={reference}
            />
          )}
          {((kind === 'monthly' && !payoutAmount.trim()) ||
            (kind === 'edit' && activity?.kind === 'monthlySalary')) && (
            <div className="space-y-1.5">
              <Label htmlFor="monthly-salary-note">{dictionary.payrollNote}</Label>
              <Textarea
                id="monthly-salary-note"
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          )}
          {kind === 'commission' && (
            <div className="space-y-1.5">
              <Label htmlFor="commission-note">{dictionary.payrollNote}</Label>
              <Textarea id="commission-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          )}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="cancel" disabled={pending} onClick={onClose}>{dictionary.cancel}</Button>
            <Button type="submit" variant="success" disabled={pending || !candidates.length && kind !== 'commission'}>
              {pending ? dictionary.saving : kind === 'commission' ? dictionary.saveCorrection : dictionary.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PaymentFields({
  dictionary,
  method,
  note,
  onMethod,
  onNote,
  onReference,
  reference,
}: {
  dictionary: Dictionary
  method: PayrollPaymentMethod
  note: string
  onMethod: (value: PayrollPaymentMethod) => void
  onNote: (value: string) => void
  onReference: (value: string) => void
  reference: string
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="payroll-payment-method">{dictionary.payrollPaymentMethod}</Label>
        <select id="payroll-payment-method" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={method} onChange={(event) => onMethod(event.target.value as PayrollPaymentMethod)}>
          <option value="cash">{dictionary.payrollCash}</option>
          <option value="bank">{dictionary.payrollBank}</option>
          <option value="other">{dictionary.payrollOther}</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payroll-reference">{dictionary.payrollReference}</Label>
        <Input id="payroll-reference" maxLength={120} value={reference} onChange={(event) => onReference(event.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="payroll-note">{dictionary.payrollNote}</Label>
        <Textarea id="payroll-note" maxLength={500} value={note} onChange={(event) => onNote(event.target.value)} />
      </div>
    </div>
  )
}
