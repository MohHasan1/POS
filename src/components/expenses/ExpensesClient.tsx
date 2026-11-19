'use client'

import { CalendarClock, Pencil, Plus, Tags, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'

import {
  confirmExpenseOccurrenceAction,
  createExpenseCategoryAction,
  createManualExpenseAction,
  createExpenseTemplateAction,
  setExpenseCategoryActiveAction,
  skipExpenseOccurrenceAction,
  updateExpenseAction,
  updateExpenseTemplateAction,
  voidExpenseAction,
} from '@/actions/expenses'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatMarketDate, toMarketDateInput } from '@/lib/calendar'
import type {
  DueExpenseOccurrence,
  ExpenseFrequency,
  ExpensePaymentStatus,
  ManualExpenseRecordType,
} from '@/lib/expense-types'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale, type MarketProfile } from '@/lib/market'
import { decimalToMinor, formatMoney, minorToDecimal } from '@/lib/money'
import type { Expense, ExpenseCategory, ExpenseTemplate } from '@/payload-types'

const ALL_VALUES = '__all__'
const PAGE_SIZE = 15

type RecordMode =
  | { kind: 'create' }
  | { expense: Expense; kind: 'edit' }
  | { kind: 'occurrence'; occurrence: DueExpenseOccurrence }
  | null

function relationId(value: { id: string } | null | string | undefined) {
  return typeof value === 'string' ? value : value?.id
}

function templateDate(value: string | null | undefined, market: MarketProfile) {
  return value ? toMarketDateInput(value, market) : ''
}

function ExpenseRecordDialog({
  categories,
  dictionary,
  market,
  mode,
  onClose,
  today,
}: {
  categories: ExpenseCategory[]
  dictionary: Dictionary
  market: MarketProfile
  mode: RecordMode
  onClose: () => void
  today: string
}) {
  const router = useRouter()
  const existing = mode?.kind === 'edit' ? mode.expense : undefined
  const occurrence = mode?.kind === 'occurrence' ? mode.occurrence : undefined
  const [name, setName] = useState(existing?.name || occurrence?.name || '')
  const [categoryId, setCategoryId] = useState(
    relationId(existing?.category) ||
      occurrence?.categoryId ||
      categories.find(({ active }) => active)?.id ||
      '',
  )
  const [vendor, setVendor] = useState(existing?.vendor || occurrence?.vendor || '')
  const [billDate, setBillDate] = useState(
    existing ? toMarketDateInput(existing.billDate, market) : occurrence?.dueDate || today,
  )
  const [total, setTotal] = useState(
    minorToDecimal(existing?.totalMinor ?? occurrence?.totalMinor ?? 0, market),
  )
  const [vat, setVat] = useState(
    minorToDecimal(existing?.vatMinor ?? occurrence?.vatMinor ?? 0, market),
  )
  const [paymentStatus, setPaymentStatus] = useState<ExpensePaymentStatus>(
    existing?.paymentStatus || 'unpaid',
  )
  const [recordType, setRecordType] = useState<ManualExpenseRecordType>(
    existing?.recordType === 'capital' ? 'capital' : 'variable',
  )
  const [paidAt, setPaidAt] = useState(
    existing?.paidAt ? toMarketDateInput(existing.paidAt, market) : billDate,
  )
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'cash' | 'other'>(
    existing?.paymentMethod || 'cash',
  )
  const [reference, setReference] = useState(existing?.reference || '')
  const [note, setNote] = useState(existing?.note || occurrence?.note || '')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const selectedCategoryName = categories.find((category) => category.id === categoryId)?.name || ''

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const totalMinor = decimalToMinor(total, market)
    const vatMinor = market.taxMode === 'none' ? 0 : decimalToMinor(vat, market)
    if (totalMinor === null || totalMinor < 1 || vatMinor === null || vatMinor > totalMinor) {
      setError(dictionary.expenseAmountError)
      return
    }
    setError('')
    const common = {
      idempotencyKey: crypto.randomUUID(),
      note: note || undefined,
      paidAt: paymentStatus === 'paid' ? paidAt : undefined,
      paymentMethod: paymentStatus === 'paid' ? paymentMethod : undefined,
      paymentStatus,
      reference: reference || undefined,
      totalMinor,
      vatMinor,
      vendor: vendor || undefined,
    }
    startTransition(async () => {
      const result =
        mode?.kind === 'edit'
          ? await updateExpenseAction(mode.expense.id, {
              ...common,
              billDate,
              categoryId,
              name,
              recordType: mode.expense.recordType === 'fixed' ? undefined : recordType,
            })
          : mode?.kind === 'occurrence'
            ? await confirmExpenseOccurrenceAction({
                dueDate: mode.occurrence.dueDate,
                record: common,
                templateId: mode.occurrence.templateId,
              })
            : await createManualExpenseAction({
                ...common,
                billDate,
                categoryId,
                name,
                recordType,
              })
      if (!result.ok) setError(result.error)
      else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={Boolean(mode)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode?.kind === 'edit'
              ? dictionary.editExpense
              : mode?.kind === 'occurrence'
                ? dictionary.confirmBill
                : dictionary.addExpense}
          </DialogTitle>
          <DialogDescription>{dictionary.expenseFormDescription}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="expense-name">{dictionary.expenseName} *</Label>
            <Input
              id="expense-name"
              required
              maxLength={160}
              disabled={mode?.kind === 'occurrence'}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-category">{dictionary.category} *</Label>
            <Select
              disabled={mode?.kind === 'occurrence'}
              value={categoryId}
              onValueChange={(value) => setCategoryId(value || '')}
            >
              <SelectTrigger id="expense-category" className="w-full">
                <SelectValue>{selectedCategoryName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter(({ active, id }) => active || id === categoryId)
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-vendor">{dictionary.vendor}</Label>
            <Input
              id="expense-vendor"
              maxLength={160}
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
            />
          </div>
          {(mode?.kind === 'create' ||
            (mode?.kind === 'edit' && mode.expense.recordType !== 'fixed')) && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="expense-record-type">{dictionary.type} *</Label>
              <Select
                value={recordType}
                onValueChange={(value) => setRecordType(value as ManualExpenseRecordType)}
              >
                <SelectTrigger id="expense-record-type" className="w-full">
                  <SelectValue>
                    {recordType === 'capital'
                      ? dictionary.capitalExpenses
                      : dictionary.variableExpenses}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="variable">{dictionary.variableExpenses}</SelectItem>
                  <SelectItem value="capital">{dictionary.capitalExpenses}</SelectItem>
                </SelectContent>
              </Select>
              {recordType === 'capital' && (
                <p className="text-xs text-muted-foreground">
                  {dictionary.capitalExpenseDescription}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="expense-date">{dictionary.billDate} *</Label>
            <Input
              id="expense-date"
              type="date"
              required
              disabled={mode?.kind === 'occurrence'}
              value={billDate}
              onChange={(event) => {
                setBillDate(event.target.value)
                if (paymentStatus === 'paid') setPaidAt(event.target.value)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-total">{dictionary.billTotal} *</Label>
            <Input
              id="expense-total"
              inputMode="decimal"
              required
              value={total}
              onChange={(event) => setTotal(event.target.value)}
            />
          </div>
          {market.taxMode === 'saudiVat' && (
            <div className="space-y-1.5">
              <Label htmlFor="expense-vat">{dictionary.vatAmount}</Label>
              <Input
                id="expense-vat"
                inputMode="decimal"
                value={vat}
                onChange={(event) => setVat(event.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="expense-payment-status">{dictionary.paymentStatus}</Label>
            <Select
              value={paymentStatus}
              onValueChange={(value) => setPaymentStatus(value as ExpensePaymentStatus)}
            >
              <SelectTrigger id="expense-payment-status" className="w-full">
                <SelectValue>
                  {paymentStatus === 'paid' ? dictionary.paid : dictionary.unpaid}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">{dictionary.unpaid}</SelectItem>
                <SelectItem value="paid">{dictionary.paid}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentStatus === 'paid' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="expense-paid-at">{dictionary.paymentDate}</Label>
                <Input
                  id="expense-paid-at"
                  type="date"
                  required
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expense-payment-method">{dictionary.paymentMethod}</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}
                >
                  <SelectTrigger id="expense-payment-method" className="w-full">
                    <SelectValue>
                      {paymentMethod === 'bank'
                        ? dictionary.payrollBank
                        : paymentMethod === 'other'
                          ? dictionary.payrollOther
                          : dictionary.payrollCash}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{dictionary.payrollCash}</SelectItem>
                    <SelectItem value="bank">{dictionary.payrollBank}</SelectItem>
                    <SelectItem value="other">{dictionary.payrollOther}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="expense-reference">{dictionary.reference}</Label>
            <Input
              id="expense-reference"
              maxLength={120}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="expense-note">{dictionary.note}</Label>
            <Textarea
              id="expense-note"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="cancel" onClick={onClose}>
              {dictionary.cancel}
            </Button>
            <Button type="submit" variant="success" disabled={pending}>
              {pending ? dictionary.saving : dictionary.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TemplateDialog({
  categories,
  dictionary,
  market,
  onClose,
  template,
  today,
}: {
  categories: ExpenseCategory[]
  dictionary: Dictionary
  market: MarketProfile
  onClose: () => void
  template: ExpenseTemplate | null | undefined
  today: string
}) {
  const router = useRouter()
  const [name, setName] = useState(template?.name || '')
  const [categoryId, setCategoryId] = useState(
    relationId(template?.category) || categories.find(({ active }) => active)?.id || '',
  )
  const [vendor, setVendor] = useState(template?.vendor || '')
  const [amount, setAmount] = useState(minorToDecimal(template?.defaultTotalMinor || 0, market))
  const [vat, setVat] = useState(minorToDecimal(template?.defaultVatMinor || 0, market))
  const [frequency, setFrequency] = useState<ExpenseFrequency>(template?.frequency || 'monthly')
  const [startDate, setStartDate] = useState(templateDate(template?.startDate, market) || today)
  const [endDate, setEndDate] = useState(templateDate(template?.endDate, market))
  const [weeklyDay, setWeeklyDay] = useState(String(template?.weeklyDay ?? 0))
  const [monthlyDay, setMonthlyDay] = useState(
    String(template?.monthlyDay ?? Number(today.slice(8, 10))),
  )
  const [yearlyMonth, setYearlyMonth] = useState(
    String(template?.yearlyMonth ?? Number(today.slice(5, 7))),
  )
  const [yearlyDay, setYearlyDay] = useState(
    String(template?.yearlyDay ?? Number(today.slice(8, 10))),
  )
  const [note, setNote] = useState(template?.note || '')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const selectedCategoryName = categories.find((category) => category.id === categoryId)?.name || ''

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const defaultTotalMinor = decimalToMinor(amount, market)
    const defaultVatMinor = market.taxMode === 'none' ? 0 : decimalToMinor(vat, market)
    if (
      defaultTotalMinor === null ||
      defaultTotalMinor < 1 ||
      defaultVatMinor === null ||
      defaultVatMinor > defaultTotalMinor
    ) {
      setError(dictionary.expenseAmountError)
      return
    }
    const input = {
      active: template?.active ?? true,
      categoryId,
      defaultTotalMinor,
      defaultVatMinor,
      endDate: endDate || undefined,
      frequency,
      monthlyDay: frequency === 'monthly' ? Number(monthlyDay) : undefined,
      name,
      note: note || undefined,
      startDate,
      vendor: vendor || undefined,
      weeklyDay: frequency === 'weekly' ? Number(weeklyDay) : undefined,
      yearlyDay: frequency === 'yearly' ? Number(yearlyDay) : undefined,
      yearlyMonth: frequency === 'yearly' ? Number(yearlyMonth) : undefined,
    }
    startTransition(async () => {
      const result = template
        ? await updateExpenseTemplateAction(template.id, input)
        : await createExpenseTemplateAction(input)
      if (!result.ok) setError(result.error)
      else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={template !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {template ? dictionary.editRecurringBill : dictionary.addRecurringBill}
          </DialogTitle>
          <DialogDescription>{dictionary.recurringBillDescription}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="template-name">{dictionary.expenseName} *</Label>
            <Input
              id="template-name"
              required
              maxLength={160}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-category">{dictionary.category} *</Label>
            <Select value={categoryId} onValueChange={(value) => setCategoryId(value || '')}>
              <SelectTrigger id="template-category" className="w-full">
                <SelectValue>{selectedCategoryName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter(({ active, id }) => active || id === categoryId)
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-vendor">{dictionary.vendor}</Label>
            <Input
              id="template-vendor"
              maxLength={160}
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-amount">{dictionary.defaultAmount} *</Label>
            <Input
              id="template-amount"
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          {market.taxMode === 'saudiVat' && (
            <div className="space-y-1.5">
              <Label htmlFor="template-vat">{dictionary.vatAmount}</Label>
              <Input
                id="template-vat"
                inputMode="decimal"
                value={vat}
                onChange={(event) => setVat(event.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="template-frequency">{dictionary.frequency}</Label>
            <Select
              value={frequency}
              onValueChange={(value) => setFrequency(value as ExpenseFrequency)}
            >
              <SelectTrigger id="template-frequency" className="w-full">
                <SelectValue>
                  {frequency === 'weekly'
                    ? dictionary.weekly
                    : frequency === 'yearly'
                      ? dictionary.yearly
                      : dictionary.monthly}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">{dictionary.weekly}</SelectItem>
                <SelectItem value="monthly">{dictionary.monthly}</SelectItem>
                <SelectItem value="yearly">{dictionary.yearly}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {frequency === 'weekly' && (
            <div className="space-y-1.5">
              <Label htmlFor="template-weekday">{dictionary.weekday}</Label>
              <Select value={weeklyDay} onValueChange={(value) => setWeeklyDay(value || '0')}>
                <SelectTrigger id="template-weekday" className="w-full">
                  <SelectValue>
                    {dictionary.weekdayNames[Number(weeklyDay)] || dictionary.weekdayNames[0]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {dictionary.weekdayNames.map((day, index) => (
                    <SelectItem key={day} value={String(index)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {frequency === 'monthly' && (
            <div className="space-y-1.5">
              <Label htmlFor="template-month-day">{dictionary.dayOfMonth}</Label>
              <Input
                id="template-month-day"
                type="number"
                min={1}
                max={31}
                required
                value={monthlyDay}
                onChange={(event) => setMonthlyDay(event.target.value)}
              />
            </div>
          )}
          {frequency === 'yearly' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="template-year-month">{dictionary.monthNumber}</Label>
                <Input
                  id="template-year-month"
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={yearlyMonth}
                  onChange={(event) => setYearlyMonth(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="template-year-day">{dictionary.dayOfMonth}</Label>
                <Input
                  id="template-year-day"
                  type="number"
                  min={1}
                  max={31}
                  required
                  value={yearlyDay}
                  onChange={(event) => setYearlyDay(event.target.value)}
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="template-start">{dictionary.startDate} *</Label>
            <Input
              id="template-start"
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-end">{dictionary.endDateOptional}</Label>
            <Input
              id="template-end"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="template-note">{dictionary.note}</Label>
            <Textarea
              id="template-note"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="cancel" onClick={onClose}>
              {dictionary.cancel}
            </Button>
            <Button type="submit" variant="success" disabled={pending}>
              {pending ? dictionary.saving : dictionary.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ExpensesClient({
  categories,
  dictionary,
  dueOccurrences,
  expenses,
  locale,
  market,
  templates,
  today,
}: {
  categories: ExpenseCategory[]
  dictionary: Dictionary
  dueOccurrences: DueExpenseOccurrence[]
  expenses: Expense[]
  locale: Locale
  market: MarketProfile
  templates: ExpenseTemplate[]
  today: string
}) {
  const router = useRouter()
  const dateLocale = marketLocale(market, locale)
  const [recordMode, setRecordMode] = useState<RecordMode>(null)
  const [templateDialog, setTemplateDialog] = useState<ExpenseTemplate | null | undefined>(
    undefined,
  )
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [skipOccurrence, setSkipOccurrence] = useState<DueExpenseOccurrence | null>(null)
  const [voiding, setVoiding] = useState<Expense | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [filterType, setFilterType] = useState(ALL_VALUES)
  const [filterPayment, setFilterPayment] = useState(ALL_VALUES)
  const [filterStatus, setFilterStatus] = useState(ALL_VALUES)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const money = (value: number) => formatMoney(value, market, dateLocale)

  const confirmed = expenses.filter(({ status }) => status === 'confirmed')
  const summary = {
    capital: confirmed
      .filter(({ recordType }) => recordType === 'capital')
      .reduce((sum, expense) => sum + expense.netMinor, 0),
    operating: confirmed
      .filter(({ recordType }) => recordType !== 'capital')
      .reduce((sum, expense) => sum + expense.netMinor, 0),
    paid: confirmed
      .filter(({ paymentStatus }) => paymentStatus === 'paid')
      .reduce((sum, expense) => sum + expense.totalMinor, 0),
    unpaid: confirmed
      .filter(({ paymentStatus }) => paymentStatus === 'unpaid')
      .reduce((sum, expense) => sum + expense.totalMinor, 0),
  }
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return expenses.filter(
      (expense) =>
        (filterType === ALL_VALUES || expense.recordType === filterType) &&
        (filterPayment === ALL_VALUES || expense.paymentStatus === filterPayment) &&
        (filterStatus === ALL_VALUES || expense.status === filterStatus) &&
        (!query ||
          [expense.name, expense.vendor, expense.categorySnapshot.name, expense.reference]
            .filter(Boolean)
            .some((value) => value!.toLocaleLowerCase().includes(query))),
    )
  }, [expenses, filterPayment, filterStatus, filterType, search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function act(action: () => Promise<{ error?: string; ok: boolean }>, after?: () => void) {
    setError('')
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setError(result.error || dictionary.genericError)
      else {
        after?.()
        router.refresh()
      }
    })
  }

  return (
    <>
      <section className="flex flex-wrap gap-2">
        <Button variant="success" onClick={() => setRecordMode({ kind: 'create' })}>
          <Plus />
          {dictionary.addExpense}
        </Button>
        <Button variant="secondary" onClick={() => setTemplateDialog(null)}>
          <CalendarClock />
          {dictionary.addRecurringBill}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setError('')
            setCategoryDialog(true)
          }}
        >
          <Tags />
          {dictionary.manageCategories}
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [dictionary.operatingExpenses, summary.operating],
          [dictionary.capitalExpenses, summary.capital],
          [dictionary.paidBills, summary.paid],
          [dictionary.unpaidBills, summary.unpaid],
          [dictionary.billsDue, dueOccurrences.length],
        ].map(([label, value], index) => (
          <Card key={String(label)}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                {index === 4 ? value : money(Number(value))}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{dictionary.billsAwaitingConfirmation}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dueOccurrences.map((occurrence) => (
            <div
              key={`${occurrence.templateId}:${occurrence.dueDate}`}
              className="flex flex-col gap-3 rounded-lg bg-muted/55 p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{occurrence.name}</p>
                <p className="text-xs text-muted-foreground">
                  {occurrence.categoryName} ·{' '}
                  {formatMarketDate(occurrence.dueDate, market, dateLocale)}
                  {occurrence.vendor ? ` · ${occurrence.vendor}` : ''}
                </p>
              </div>
              <p className="font-semibold tabular-nums">{money(occurrence.totalMinor)}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => setRecordMode({ kind: 'occurrence', occurrence })}
                >
                  {dictionary.confirm}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSkipOccurrence(occurrence)}>
                  {dictionary.skip}
                </Button>
              </div>
            </div>
          ))}
          {!dueOccurrences.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {dictionary.noBillsDue}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{dictionary.recurringBills}</CardTitle>
          <Badge variant="secondary">{templates.filter(({ active }) => active).length}</Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dictionary.expenseName}</TableHead>
                <TableHead>{dictionary.category}</TableHead>
                <TableHead>{dictionary.frequency}</TableHead>
                <TableHead className="text-right">{dictionary.defaultAmount}</TableHead>
                <TableHead>{dictionary.status}</TableHead>
                <TableHead className="text-right">{dictionary.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    {typeof template.category === 'string' ? '—' : template.category.name}
                  </TableCell>
                  <TableCell>{dictionary[template.frequency]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(template.defaultTotalMinor)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={template.active ? 'secondary' : 'outline'}>
                      {template.active ? dictionary.active : dictionary.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setTemplateDialog(template)}>
                        <Pencil />
                        {dictionary.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          act(() =>
                            updateExpenseTemplateAction(template.id, {
                              active: !template.active,
                              categoryId: relationId(template.category)!,
                              defaultTotalMinor: template.defaultTotalMinor,
                              defaultVatMinor: template.defaultVatMinor,
                              endDate: templateDate(template.endDate, market) || undefined,
                              frequency: template.frequency,
                              monthlyDay: template.monthlyDay || undefined,
                              name: template.name,
                              note: template.note || undefined,
                              startDate: templateDate(template.startDate, market),
                              vendor: template.vendor || undefined,
                              weeklyDay: template.weeklyDay ?? undefined,
                              yearlyDay: template.yearlyDay || undefined,
                              yearlyMonth: template.yearlyMonth || undefined,
                            }),
                          )
                        }
                      >
                        {template.active ? dictionary.deactivate : dictionary.activate}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dictionary.expenseHistory}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-0">
          <div className="grid gap-2 px-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              type="search"
              placeholder={dictionary.searchExpenses}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
            <Select
              value={filterType}
              onValueChange={(value) => {
                setFilterType(value || ALL_VALUES)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {filterType === 'fixed'
                    ? dictionary.fixedExpenses
                    : filterType === 'variable'
                      ? dictionary.variableExpenses
                      : filterType === 'capital'
                        ? dictionary.capitalExpenses
                        : dictionary.allExpenseTypes}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUES}>{dictionary.allExpenseTypes}</SelectItem>
                <SelectItem value="fixed">{dictionary.fixedExpenses}</SelectItem>
                <SelectItem value="variable">{dictionary.variableExpenses}</SelectItem>
                <SelectItem value="capital">{dictionary.capitalExpenses}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterPayment}
              onValueChange={(value) => {
                setFilterPayment(value || ALL_VALUES)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {filterPayment === 'paid'
                    ? dictionary.paid
                    : filterPayment === 'unpaid'
                      ? dictionary.unpaid
                      : dictionary.allPaymentStatuses}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUES}>{dictionary.allPaymentStatuses}</SelectItem>
                <SelectItem value="paid">{dictionary.paid}</SelectItem>
                <SelectItem value="unpaid">{dictionary.unpaid}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterStatus}
              onValueChange={(value) => {
                setFilterStatus(value || ALL_VALUES)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {filterStatus === 'confirmed'
                    ? dictionary.confirmed
                    : filterStatus === 'voided'
                      ? dictionary.voided
                      : filterStatus === 'skipped'
                        ? dictionary.skipped
                        : dictionary.allStatuses}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUES}>{dictionary.allStatuses}</SelectItem>
                <SelectItem value="confirmed">{dictionary.confirmed}</SelectItem>
                <SelectItem value="voided">{dictionary.voided}</SelectItem>
                <SelectItem value="skipped">{dictionary.skipped}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dictionary.billDate}</TableHead>
                  <TableHead>{dictionary.expenseName}</TableHead>
                  <TableHead>{dictionary.category}</TableHead>
                  <TableHead>{dictionary.type}</TableHead>
                  <TableHead className="text-right">{dictionary.netAmount}</TableHead>
                  <TableHead>{dictionary.paymentStatus}</TableHead>
                  <TableHead>{dictionary.status}</TableHead>
                  <TableHead className="text-right">{dictionary.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatMarketDate(expense.billDate, market, dateLocale)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{expense.name}</span>
                      {expense.vendor && (
                        <span className="block text-xs text-muted-foreground">
                          {expense.vendor}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{expense.categorySnapshot.name}</TableCell>
                    <TableCell>
                      {expense.recordType === 'fixed'
                        ? dictionary.fixedExpenses
                        : expense.recordType === 'capital'
                          ? dictionary.capitalExpenses
                          : dictionary.variableExpenses}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(expense.netMinor)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={expense.paymentStatus === 'paid' ? 'secondary' : 'outline'}>
                        {expense.paymentStatus === 'paid' ? dictionary.paid : dictionary.unpaid}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={expense.status === 'confirmed' ? 'secondary' : 'outline'}>
                        {dictionary[expense.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {expense.status === 'confirmed' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setRecordMode({ expense, kind: 'edit' })}
                            >
                              <Pencil />
                              {dictionary.edit}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setVoiding(expense)
                                setVoidReason('')
                              }}
                            >
                              <XCircle />
                              {dictionary.void}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!visible.length && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {dictionary.noExpenses}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-4 pb-4">
            <span className="text-sm text-muted-foreground">
              {dictionary.pageOf
                .replace('{page}', String(page))
                .replace('{total}', String(totalPages))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              {dictionary.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              {dictionary.next}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ExpenseRecordDialog
        key={
          recordMode?.kind === 'edit'
            ? `record-edit-${recordMode.expense.id}`
            : recordMode?.kind === 'occurrence'
              ? `record-occurrence-${recordMode.occurrence.templateId}:${recordMode.occurrence.dueDate}`
              : `record-${recordMode?.kind || 'closed'}`
        }
        categories={categories}
        dictionary={dictionary}
        market={market}
        mode={recordMode}
        onClose={() => setRecordMode(null)}
        today={today}
      />
      <TemplateDialog
        key={
          templateDialog === null ? 'template-new' : `template-${templateDialog?.id || 'closed'}`
        }
        categories={categories}
        dictionary={dictionary}
        market={market}
        onClose={() => setTemplateDialog(undefined)}
        template={templateDialog}
        today={today}
      />

      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dictionary.manageCategories}</DialogTitle>
            <DialogDescription>{dictionary.categoriesDescription}</DialogDescription>
          </DialogHeader>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              act(
                () => createExpenseCategoryAction({ name: categoryName }),
                () => setCategoryName(''),
              )
            }}
          >
            <Input
              required
              maxLength={100}
              placeholder={dictionary.newCategory}
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
            />
            <Button type="submit" variant="success" disabled={pending}>
              {dictionary.create}
            </Button>
          </form>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>
                      <Badge variant={category.active ? 'secondary' : 'outline'}>
                        {category.active ? dictionary.active : dictionary.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          act(() => setExpenseCategoryActiveAction(category.id, !category.active))
                        }
                      >
                        {category.active ? dictionary.deactivate : dictionary.activate}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCategoryDialog(false)}>
              {dictionary.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(skipOccurrence)}
        onOpenChange={(open) => !open && setSkipOccurrence(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dictionary.skipBill}</DialogTitle>
            <DialogDescription>{dictionary.skipBillWarning}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="cancel" onClick={() => setSkipOccurrence(null)}>
              {dictionary.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                skipOccurrence &&
                act(
                  () =>
                    skipExpenseOccurrenceAction({
                      dueDate: skipOccurrence.dueDate,
                      idempotencyKey: crypto.randomUUID(),
                      templateId: skipOccurrence.templateId,
                    }),
                  () => setSkipOccurrence(null),
                )
              }
            >
              {dictionary.skip}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(voiding)} onOpenChange={(open) => !open && setVoiding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dictionary.voidExpense}</DialogTitle>
            <DialogDescription>{dictionary.voidExpenseWarning}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">{dictionary.reason} *</Label>
            <Textarea
              id="void-reason"
              required
              maxLength={500}
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="cancel" onClick={() => setVoiding(null)}>
              {dictionary.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !voidReason.trim()}
              onClick={() =>
                voiding &&
                act(
                  () => voidExpenseAction(voiding.id, voidReason),
                  () => setVoiding(null),
                )
              }
            >
              {dictionary.void}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
