import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { dateInputToISOString, todayDateInput } from '@/lib/calendar'
import type {
  CompensationType,
  PayrollActivity,
  PayrollDashboard,
  PayrollEmployeeSummary,
  PayrollMetrics,
  PayrollPaymentMethod,
  PayrollPeriodFilter,
} from '@/lib/payroll-types'
import type {
  Employee,
  EmployeeCommissionOverride,
  EmployeeCommissionRate,
  EmployeePayrollEntry,
  Invoice,
  InvoiceCostOverride,
  Product,
} from '@/payload-types'

import { getEmployee, updateEmployeeCompensation } from './employees'
import { getShopSettings, marketContextFromSettings } from './settings'

export type CommissionRateInput = { productId: string; rateBps: number }

export type PayrollEntryInput = {
  amountMinor: number
  employeeId: string
  entryDate: string
  idempotencyKey: string
  note?: string
  paymentMethod?: PayrollPaymentMethod
  reference?: string
  salaryMonth?: string
}

function relationshipId(value: { id: string } | null | string | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.id
}

async function allInvoices(): Promise<Invoice[]> {
  const payload = await getPayload({ config })
  const values: Invoice[] = []
  let page = 1
  let totalPages = 1
  do {
    const result = await payload.find({
      collection: 'invoices',
      depth: 0,
      limit: 500,
      page,
      sort: '-issuedAt',
    })
    values.push(...result.docs)
    totalPages = result.totalPages
    page += 1
  } while (page <= totalPages)
  return values
}

async function allPayrollEntries(): Promise<EmployeePayrollEntry[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'employee-payroll-entries',
    depth: 0,
    pagination: false,
    sort: '-entryDate,-createdAt',
  })
  return result.docs
}

async function allCommissionOverrides(): Promise<EmployeeCommissionOverride[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'employee-commission-overrides',
    depth: 0,
    pagination: false,
  })
  return result.docs
}

export async function getActiveCommissionRateMap(employeeId: string): Promise<Map<string, number>> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'employee-commission-rates',
    depth: 0,
    pagination: false,
    where: {
      and: [{ employee: { equals: employeeId } }, { active: { equals: true } }],
    },
  })
  return new Map(
    result.docs.flatMap((rate) => {
      const productId = relationshipId(rate.product)
      return productId ? [[productId, rate.rateBps] as const] : []
    }),
  )
}

export async function getCommissionRates(employeeId: string): Promise<EmployeeCommissionRate[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'employee-commission-rates',
    depth: 0,
    pagination: false,
    where: { employee: { equals: employeeId } },
  })
  return result.docs
}

export async function saveCompensationPlan(
  employeeId: string,
  compensationType: CompensationType,
  monthlySalaryMinor: number | null,
  rates: CommissionRateInput[],
): Promise<Employee> {
  const payload = await getPayload({ config })
  const employee = await getEmployee(employeeId)
  if (!employee) throw new Error('Employee not found.')
  if (compensationType === 'monthly' && (!monthlySalaryMinor || monthlySalaryMinor < 1)) {
    throw new Error('Enter a monthly salary greater than zero.')
  }
  const uniqueRates = new Map<string, number>()
  for (const rate of rates) {
    if (!Number.isInteger(rate.rateBps) || rate.rateBps < 0 || rate.rateBps > 10_000) {
      throw new Error('Commission percentages must be between 0% and 100%.')
    }
    if (uniqueRates.has(rate.productId))
      throw new Error('A service can only have one commission rate.')
    const product = await payload.findByID({ collection: 'products', id: rate.productId, depth: 0 })
    if (!product) throw new Error('A selected service no longer exists.')
    uniqueRates.set(rate.productId, rate.rateBps)
  }

  if (compensationType === 'commission') {
    const existing = await getCommissionRates(employeeId)
    const existingByProduct = new Map(
      existing.flatMap((rate) => {
        const productId = relationshipId(rate.product)
        return productId ? [[productId, rate] as const] : []
      }),
    )
    for (const rate of existing) {
      const productId = relationshipId(rate.product)
      if (productId && !uniqueRates.has(productId) && rate.active) {
        await payload.update({
          collection: 'employee-commission-rates',
          id: rate.id,
          data: { active: false },
        })
      }
    }
    for (const [productId, rateBps] of uniqueRates) {
      const saved = existingByProduct.get(productId)
      if (saved) {
        await payload.update({
          collection: 'employee-commission-rates',
          id: saved.id,
          data: { active: true, rateBps },
        })
      } else {
        await payload.create({
          collection: 'employee-commission-rates',
          data: { active: true, employee: employeeId, product: productId, rateBps },
        })
      }
    }
  }

  return updateEmployeeCompensation(employeeId, {
    compensationType,
    monthlySalaryMinor: compensationType === 'monthly' ? monthlySalaryMinor : null,
  })
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

async function payrollSnapshot(employeeId: string) {
  const [employee, settings] = await Promise.all([getEmployee(employeeId), getShopSettings()])
  if (!employee) throw new Error('Employee not found.')
  const market = marketContextFromSettings(settings)
  if (!market.configured) throw new Error('Complete business setup before recording payroll.')
  return { employee, profile: market.profile }
}

async function existingEntry(idempotencyKey: string): Promise<EmployeePayrollEntry | null> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'employee-payroll-entries',
    limit: 1,
    where: { idempotencyKey: { equals: idempotencyKey } },
  })
  return result.docs[0] || null
}

function entryData(
  input: PayrollEntryInput,
  employee: Employee,
  profile: ReturnType<typeof marketContextFromSettings>['profile'],
) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1) {
    throw new Error('Enter an amount greater than zero.')
  }
  if (input.entryDate > todayDateInput(profile))
    throw new Error('Payroll dates cannot be in the future.')
  return {
    amountMinor: input.amountMinor,
    countryCode: profile.countryCode,
    currencyCode: profile.currencyCode,
    currencyMinorUnitDigits: profile.minorUnitDigits,
    employee: employee.id,
    employeeSnapshot: { name: employee.name },
    entryDate: dateInputToISOString(input.entryDate, profile),
    note: normalizeOptional(input.note),
    paymentMethod: input.paymentMethod,
    reference: normalizeOptional(input.reference),
    timeZone: profile.timeZone,
  }
}

function monthEndInput(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) throw new Error('Choose a valid salary month.')
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) throw new Error('Choose a valid salary month.')
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`
}

export async function createMonthlySalary(
  input: Omit<PayrollEntryInput, 'entryDate'> & {
    payout?: Omit<PayrollEntryInput, 'employeeId' | 'salaryMonth'>
  },
): Promise<{ payout?: EmployeePayrollEntry; salary: EmployeePayrollEntry }> {
  const duplicate = await existingEntry(input.idempotencyKey)
  if (duplicate) return { salary: duplicate }
  const payload = await getPayload({ config })
  const { employee, profile } = await payrollSnapshot(input.employeeId)
  if (employee.compensationType !== 'monthly') throw new Error('Choose a monthly-salary employee.')
  const salaryMonth = input.salaryMonth || ''
  const monthEnd = monthEndInput(salaryMonth)
  const entryDate = monthEnd > todayDateInput(profile) ? todayDateInput(profile) : monthEnd
  if (salaryMonth > todayDateInput(profile).slice(0, 7)) {
    throw new Error('Salary months cannot be in the future.')
  }
  const data = entryData({ ...input, entryDate }, employee, profile)
  const sameMonth = await payload.find({
    collection: 'employee-payroll-entries',
    limit: 1,
    where: {
      and: [
        { employee: { equals: employee.id } },
        { entryType: { equals: 'monthlySalary' } },
        { salaryMonth: { equals: salaryMonth } },
      ],
    },
  })
  if (sameMonth.totalDocs)
    throw new Error('This employee already has a salary entry for that month.')

  const transactionID = await payload.db.beginTransaction()
  const req = transactionID === null ? undefined : { payload, transactionID }
  try {
    const salary = await payload.create({
      collection: 'employee-payroll-entries',
      data: {
        ...data,
        entryType: 'monthlySalary',
        idempotencyKey: input.idempotencyKey,
        paymentMethod: null,
        salaryMonth,
      },
      req,
    })
    const payout = input.payout?.amountMinor
      ? await payload.create({
          collection: 'employee-payroll-entries',
          data: {
            ...entryData(
              { ...input.payout, employeeId: employee.id, salaryMonth: undefined },
              employee,
              profile,
            ),
            entryType: 'payout',
            idempotencyKey: input.payout.idempotencyKey,
            paymentMethod: input.payout.paymentMethod || 'cash',
            salaryMonth: null,
          },
          req,
        })
      : undefined
    if (transactionID !== null) await payload.db.commitTransaction(transactionID)
    return { payout, salary }
  } catch (error) {
    if (transactionID !== null)
      await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    throw error
  }
}

export async function createPayrollPayout(input: PayrollEntryInput): Promise<EmployeePayrollEntry> {
  const duplicate = await existingEntry(input.idempotencyKey)
  if (duplicate) return duplicate
  const payload = await getPayload({ config })
  const { employee, profile } = await payrollSnapshot(input.employeeId)
  return payload.create({
    collection: 'employee-payroll-entries',
    data: {
      ...entryData(input, employee, profile),
      entryType: 'payout',
      idempotencyKey: input.idempotencyKey,
      paymentMethod: input.paymentMethod || 'cash',
      salaryMonth: null,
    },
  })
}

export async function updatePayrollEntry(
  id: string,
  input: Omit<PayrollEntryInput, 'idempotencyKey'>,
): Promise<EmployeePayrollEntry> {
  const payload = await getPayload({ config })
  const current = await payload.findByID({ collection: 'employee-payroll-entries', id, depth: 0 })
  const { employee, profile } = await payrollSnapshot(input.employeeId)
  if (relationshipId(current.employee) !== employee.id)
    throw new Error('The employee cannot be changed.')
  const monthEnd =
    current.entryType === 'monthlySalary' ? monthEndInput(input.salaryMonth || '') : undefined
  if (
    current.entryType === 'monthlySalary' &&
    (input.salaryMonth || '') > todayDateInput(profile).slice(0, 7)
  ) {
    throw new Error('Salary months cannot be in the future.')
  }
  const entryDate =
    current.entryType === 'monthlySalary'
      ? monthEnd! > todayDateInput(profile)
        ? todayDateInput(profile)
        : monthEnd!
      : input.entryDate
  const data = entryData(
    { ...input, entryDate, idempotencyKey: current.idempotencyKey },
    employee,
    profile,
  )
  const clauses: Where[] = [
    { employee: { equals: employee.id } },
    { entryType: { equals: current.entryType } },
    { id: { not_equals: id } },
  ]
  if (current.entryType === 'monthlySalary')
    clauses.push({ salaryMonth: { equals: input.salaryMonth } })
  if (current.entryType !== 'payout') {
    const conflict = await payload.find({
      collection: 'employee-payroll-entries',
      limit: 1,
      where: { and: clauses },
    })
    if (conflict.totalDocs) throw new Error('Another salary entry already exists for that period.')
  }
  return payload.update({
    collection: 'employee-payroll-entries',
    id,
    data: {
      amountMinor: data.amountMinor,
      entryDate: data.entryDate,
      note: data.note,
      paymentMethod: current.entryType === 'monthlySalary' ? null : input.paymentMethod || 'cash',
      reference: data.reference,
      salaryMonth: current.entryType === 'monthlySalary' ? input.salaryMonth : null,
    },
  })
}

export async function upsertCommissionOverride(input: {
  correctedAmountMinor: number
  invoiceId: string
  invoiceItemId: string
  note?: string
}): Promise<EmployeeCommissionOverride> {
  if (!Number.isSafeInteger(input.correctedAmountMinor) || input.correctedAmountMinor < 0) {
    throw new Error('Enter a valid corrected commission amount.')
  }
  const payload = await getPayload({ config })
  const invoice = await payload.findByID({ collection: 'invoices', id: input.invoiceId, depth: 0 })
  const item = invoice.items.find(({ id }) => id === input.invoiceItemId)
  const employeeId = relationshipId(invoice.employee)
  if (!item?.commission || !employeeId || !invoice.employeeSnapshot?.name) {
    throw new Error('This invoice line has no commission to correct.')
  }
  const existing = await payload.find({
    collection: 'employee-commission-overrides',
    limit: 1,
    where: { invoiceItemId: { equals: input.invoiceItemId } },
  })
  const data = {
    correctedAmountMinor: input.correctedAmountMinor,
    employee: employeeId,
    employeeSnapshot: { name: invoice.employeeSnapshot.name },
    invoice: invoice.id,
    invoiceItemId: input.invoiceItemId,
    note: normalizeOptional(input.note),
  }
  return existing.docs[0]
    ? payload.update({
        collection: 'employee-commission-overrides',
        id: existing.docs[0].id,
        data,
      })
    : payload.create({ collection: 'employee-commission-overrides', data })
}

function periodRange(
  filter: PayrollPeriodFilter,
  profile: ReturnType<typeof marketContextFromSettings>['profile'],
): { end?: number; start?: number } {
  if (filter.mode === 'all') return {}
  const fallback = todayDateInput(profile)
  let startInput: string
  let endInput: string
  if (filter.mode === 'day') {
    startInput = /^\d{4}-\d{2}-\d{2}$/.test(filter.value || '') ? filter.value! : fallback
    const date = new Date(`${startInput}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + 1)
    endInput = date.toISOString().slice(0, 10)
  } else if (filter.mode === 'month') {
    const month = /^\d{4}-\d{2}$/.test(filter.value || '') ? filter.value! : fallback.slice(0, 7)
    startInput = `${month}-01`
    const date = new Date(`${startInput}T00:00:00Z`)
    date.setUTCMonth(date.getUTCMonth() + 1)
    endInput = date.toISOString().slice(0, 10)
  } else {
    const year = /^\d{4}$/.test(filter.value || '') ? filter.value! : fallback.slice(0, 4)
    startInput = `${year}-01-01`
    endInput = `${Number(year) + 1}-01-01`
  }
  return {
    end: new Date(dateInputToISOString(endInput, profile)).getTime(),
    start: new Date(dateInputToISOString(startInput, profile)).getTime(),
  }
}

function inRange(date: string, range: { end?: number; start?: number }): boolean {
  const value = new Date(date).getTime()
  return (
    (range.start === undefined || value >= range.start) &&
    (range.end === undefined || value < range.end)
  )
}

function emptyMetrics(): PayrollMetrics {
  return {
    businessResultMinor: 0,
    commissionEarnedMinor: 0,
    currentBalanceMinor: 0,
    directCostMinor: 0,
    fixedEarnedMinor: 0,
    paidMinor: 0,
    periodBalanceMinor: 0,
    salesGeneratedMinor: 0,
    totalEarnedMinor: 0,
  }
}

export function buildPayrollDashboard(input: {
  activityLimit?: number | null
  costOverrides?: InvoiceCostOverride[]
  employees: Employee[]
  entries: EmployeePayrollEntry[]
  filter: PayrollPeriodFilter
  invoices: Invoice[]
  market: ReturnType<typeof marketContextFromSettings>['profile']
  overrides: EmployeeCommissionOverride[]
  products?: Product[]
}): PayrollDashboard {
  const {
    activityLimit = 50,
    costOverrides = [],
    employees,
    entries,
    filter,
    invoices,
    market,
    overrides,
    products = [],
  } = input
  const range = periodRange(filter, market)
  const currentMonth = todayDateInput(market).slice(0, 7)
  const salaryActionMonth =
    filter.mode === 'month' && /^\d{4}-\d{2}$/.test(filter.value || '')
      ? filter.value!
      : currentMonth
  const overrideByItem = new Map(overrides.map((override) => [override.invoiceItemId, override]))
  const costOverrideByItem = new Map(
    costOverrides.map((override) => [override.invoiceItemId, override.totalCostMinor]),
  )
  const productById = new Map(products.map((product) => [product.id, product]))
  const summaryByEmployee = new Map<string, PayrollEmployeeSummary>()
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
  const activities: PayrollActivity[] = []
  const breakdown = new Map<string, number>()

  for (const employee of employees) {
    if (filter.employeeId && employee.id !== filter.employeeId) continue
    summaryByEmployee.set(employee.id, {
      ...emptyMetrics(),
      compensationType: employee.compensationType,
      employeeId: employee.id,
      employeeName: employee.name,
      salaryConfirmedForActionMonth: false,
    })
  }

  const ensureSummary = (employeeId: string, employeeName: string) => {
    const existing = summaryByEmployee.get(employeeId)
    if (existing) return existing
    const employee = employeeById.get(employeeId)
    const created: PayrollEmployeeSummary = {
      ...emptyMetrics(),
      compensationType: employee?.compensationType || 'unconfigured',
      employeeId,
      employeeName,
      salaryConfirmedForActionMonth: false,
    }
    summaryByEmployee.set(employeeId, created)
    return created
  }

  for (const entry of entries) {
    const employeeId = relationshipId(entry.employee)
    if (!employeeId || (filter.employeeId && employeeId !== filter.employeeId)) continue
    const summary = ensureSummary(employeeId, entry.employeeSnapshot.name)
    if (entry.entryType === 'monthlySalary' && entry.salaryMonth === salaryActionMonth) {
      summary.salaryConfirmedForActionMonth = true
    }
    const isPeriod = inRange(entry.entryDate, range)
    const earned = entry.entryType === 'monthlySalary' ? entry.amountMinor : 0
    const paid = entry.entryType === 'payout' ? entry.amountMinor : 0
    summary.currentBalanceMinor += earned - paid
    if (!isPeriod) continue
    summary.fixedEarnedMinor += earned
    summary.paidMinor += paid
    activities.push({
      amountMinor: entry.amountMinor,
      date: entry.entryDate,
      employeeId,
      employeeName: entry.employeeSnapshot.name,
      id: entry.id,
      kind: entry.entryType,
      note: entry.note || undefined,
      paymentMethod: entry.paymentMethod || undefined,
      reference: entry.reference || undefined,
      salaryMonth: entry.salaryMonth || undefined,
    })
  }

  for (const invoice of invoices) {
    const employeeId = relationshipId(invoice.employee)
    if (!employeeId || (filter.employeeId && employeeId !== filter.employeeId)) continue
    const employeeName = invoice.employeeSnapshot?.name || employeeById.get(employeeId)?.name
    if (!employeeName) continue
    const summary = ensureSummary(employeeId, employeeName)
    const invoiceIsInPeriod = inRange(invoice.issuedAt, range)
    for (const item of invoice.items) {
      if (invoiceIsInPeriod) {
        summary.salesGeneratedMinor += item.netMinor
        const productId = relationshipId(item.product)
        const currentUnitCostMinor = productId
          ? productById.get(productId)?.unitCostMinor
          : undefined
        const currentTotalCostMinor =
          currentUnitCostMinor === undefined || currentUnitCostMinor === null
            ? 0
            : Math.round((currentUnitCostMinor * item.quantityMilliunits) / 1_000)
        summary.directCostMinor +=
          (item.id ? costOverrideByItem.get(item.id) : undefined) ??
          item.cost?.totalCostMinor ??
          currentTotalCostMinor
      }
      const original = item.commission?.amountMinor
      if (original === undefined || original === null) continue
      const override = item.id ? overrideByItem.get(item.id) : undefined
      const amount = override?.correctedAmountMinor ?? original
      summary.currentBalanceMinor += amount
      if (!invoiceIsInPeriod) continue
      summary.commissionEarnedMinor += amount
      breakdown.set(item.descriptionEnglish, (breakdown.get(item.descriptionEnglish) || 0) + amount)
      activities.push({
        amountMinor: original,
        correctedAmountMinor: override?.correctedAmountMinor,
        date: invoice.issuedAt,
        employeeId,
        employeeName,
        id: `commission:${invoice.id}:${item.id || item.descriptionEnglish}`,
        invoiceId: invoice.id,
        invoiceItemId: item.id || undefined,
        invoiceNumber: invoice.invoiceNumber,
        kind: 'commission',
        note: override?.note || undefined,
        serviceName: item.descriptionEnglish,
      })
    }
  }

  for (const summary of summaryByEmployee.values()) {
    summary.totalEarnedMinor = summary.fixedEarnedMinor + summary.commissionEarnedMinor
    summary.periodBalanceMinor = summary.totalEarnedMinor - summary.paidMinor
    summary.businessResultMinor =
      summary.salesGeneratedMinor - summary.directCostMinor - summary.totalEarnedMinor
  }
  const metrics = [...summaryByEmployee.values()].reduce<PayrollMetrics>(
    (total, summary) => ({
      businessResultMinor: total.businessResultMinor + summary.businessResultMinor,
      commissionEarnedMinor: total.commissionEarnedMinor + summary.commissionEarnedMinor,
      currentBalanceMinor: total.currentBalanceMinor + summary.currentBalanceMinor,
      directCostMinor: total.directCostMinor + summary.directCostMinor,
      fixedEarnedMinor: total.fixedEarnedMinor + summary.fixedEarnedMinor,
      paidMinor: total.paidMinor + summary.paidMinor,
      periodBalanceMinor: total.periodBalanceMinor + summary.periodBalanceMinor,
      salesGeneratedMinor: total.salesGeneratedMinor + summary.salesGeneratedMinor,
      totalEarnedMinor: total.totalEarnedMinor + summary.totalEarnedMinor,
    }),
    emptyMetrics(),
  )

  const sortedActivities = activities.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  return {
    activities:
      activityLimit === null ? sortedActivities : sortedActivities.slice(0, activityLimit),
    commissionBreakdown: [...breakdown]
      .map(([serviceName, amountMinor]) => ({ amountMinor, serviceName }))
      .sort((a, b) => b.amountMinor - a.amountMinor || a.serviceName.localeCompare(b.serviceName)),
    employeeSummaries: [...summaryByEmployee.values()].sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName),
    ),
    filter,
    market,
    metrics,
    salaryActionMonth,
  }
}

export async function getPayrollDashboard(
  filter: PayrollPeriodFilter,
  activityLimit: number | null = 30,
): Promise<PayrollDashboard> {
  const payload = await getPayload({ config })
  const [employeesResult, entries, invoices, overrides, costOverrides, products, settings] =
    await Promise.all([
      payload.find({ collection: 'employees', pagination: false, sort: 'name' }),
      allPayrollEntries(),
      allInvoices(),
      allCommissionOverrides(),
      payload.find({ collection: 'invoice-cost-overrides', depth: 0, pagination: false }),
      payload.find({ collection: 'products', depth: 0, pagination: false }),
      getShopSettings(),
    ])
  return buildPayrollDashboard({
    activityLimit,
    costOverrides: costOverrides.docs,
    employees: employeesResult.docs,
    entries,
    filter,
    invoices,
    market: marketContextFromSettings(settings).profile,
    overrides,
    products: products.docs,
  })
}
