import config from '@payload-config'
import { getPayload, type PayloadRequest } from 'payload'

import { dateInputToISOString, getPeriodBounds, todayDateInput, toMarketDateInput } from '@/lib/calendar'
import { getDocumentMarket } from '@/lib/market'
import type {
  MoneyAccountInput,
  MoneyAccountUpdateInput,
  MoneyAccountView,
  MoneyDashboard,
  MoneyDirection,
  MoneyInvoiceOption,
  InvoicePaymentSummary,
  MoneyPaymentInput,
  MoneyPersonBalance,
} from '@/lib/money-types'
import type { Invoice, MoneyAccount, MoneyPayment, MoneyPerson, Product } from '@/payload-types'

import { createIssuedReceiptVoucher, voidReceiptVoucher } from './receipt-vouchers'
import { areShopSettingsComplete, getShopSettings, marketContextFromSettings } from './settings'

function relationshipId(value: { id: string } | null | string | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.id
}

function optional(value: string | null | undefined) {
  return value?.trim() || undefined
}

async function activePerson(id: string, req?: Partial<PayloadRequest>): Promise<MoneyPerson> {
  const payload = await getPayload({ config })
  const person = await payload.findByID({ collection: 'money-people', id, req })
  if (!person.active) throw new Error('Choose an active person.')
  return person
}

async function currentMarket() {
  const settings = await getShopSettings()
  if (!areShopSettingsComplete(settings)) {
    throw new Error('Complete business setup before recording money owed.')
  }
  return marketContextFromSettings(settings).profile
}

export async function getMoneyPeople(includeInactive = true): Promise<MoneyPerson[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'money-people',
    pagination: false,
    sort: 'name',
    where: includeInactive ? undefined : { active: { equals: true } },
  })
  return result.docs
}

export async function createMoneyPerson(input: {
  address?: string
  email?: string
  name: string
  note?: string
  phone?: string
}): Promise<MoneyPerson> {
  const payload = await getPayload({ config })
  return payload.create({
    collection: 'money-people',
    data: {
      active: true,
      address: optional(input.address),
      email: optional(input.email),
      name: input.name.trim(),
      note: optional(input.note),
      phone: optional(input.phone),
    },
  })
}

export async function updateMoneyPerson(
  id: string,
  input: {
    active: boolean
    address?: string
    email?: string
    name: string
    note?: string
    phone?: string
  },
): Promise<MoneyPerson> {
  const payload = await getPayload({ config })
  return payload.update({
    collection: 'money-people',
    id,
    data: {
      active: input.active,
      address: optional(input.address) ?? null,
      email: optional(input.email) ?? null,
      name: input.name.trim(),
      note: optional(input.note) ?? null,
      phone: optional(input.phone) ?? null,
    },
  })
}

function allowedKind(direction: MoneyDirection, kind: MoneyAccount['kind']) {
  return direction === 'owedToUs'
    ? kind === 'unpaidInvoice' || kind === 'moneyLent' || kind === 'other'
    : kind === 'supplierCredit' || kind === 'borrowedMoney' || kind === 'other'
}

function productRowsTotal(products: { quantityMilliunits: number; unitPriceMinor?: number | null }[]) {
  const total = products.reduce((sum, { quantityMilliunits, unitPriceMinor }) => {
    const price = unitPriceMinor ?? 0
    if (!Number.isSafeInteger(quantityMilliunits) || quantityMilliunits < 1 || !Number.isSafeInteger(price) || price < 0) {
      throw new Error('Enter a valid product quantity and price.')
    }
    return sum + Math.round((quantityMilliunits * price) / 1000)
  }, 0)
  if (!Number.isSafeInteger(total) || total > 99_999_999_999) {
    throw new Error('The product total is too large.')
  }
  return total
}

async function resolveProducts(
  input: MoneyAccountInput['products'],
  req?: Partial<PayloadRequest>,
  existingSnapshots = new Map<string, string>(),
) {
  const rows = input || []
  if (new Set(rows.map(({ productId }) => productId)).size !== rows.length) {
    throw new Error('Choose each product only once.')
  }
  const payload = await getPayload({ config })
  return Promise.all(
    rows.map(async ({ productId, quantityMilliunits, unitPriceMinor }) => {
      const product = await payload.findByID({ collection: 'products', id: productId, req })
      if (!product.active && !existingSnapshots.has(product.id)) {
        throw new Error('Inactive products cannot be added to a new record.')
      }
      return {
        product: product.id,
        productSnapshot: { name: existingSnapshots.get(product.id) || product.nameEnglish },
        quantityMilliunits,
        unitPriceMinor: unitPriceMinor ?? product.unitCostMinor ?? 0,
      }
    }),
  )
}

async function existingAccountByKey(key: string, req?: Partial<PayloadRequest>) {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'money-accounts',
    limit: 1,
    req,
    where: { idempotencyKey: { equals: key } },
  })
  return result.docs[0] || null
}

async function allocateRecordNumber(direction: MoneyDirection, req?: Partial<PayloadRequest>) {
  const payload = await getPayload({ config })
  const prefix = direction === 'owedToUs' ? 'MOU-' : 'MWO-'
  const result = await payload.find({
    collection: 'money-accounts',
    limit: 1,
    req,
    sort: '-recordNumber',
    where: { recordNumber: { like: prefix } },
  })
  const previous = result.docs[0]?.recordNumber
  const value = previous?.startsWith(prefix) ? Number(previous.slice(prefix.length)) + 1 : 1
  return `${prefix}${String(value).padStart(6, '0')}`
}

function validateDates(recordDate: string, dueDate: string | undefined, profile: Awaited<ReturnType<typeof currentMarket>>) {
  const recordISO = dateInputToISOString(recordDate, profile)
  if (recordDate > todayDateInput(profile)) throw new Error('The record date cannot be in the future.')
  const dueISO = dueDate ? dateInputToISOString(dueDate, profile) : undefined
  if (dueDate && dueDate < recordDate) throw new Error('The due date cannot be before the record date.')
  return { dueISO, recordISO }
}

async function createAccountData(input: MoneyAccountInput, req?: Partial<PayloadRequest>) {
  if (!allowedKind(input.direction, input.kind)) throw new Error('Choose a valid record type.')
  const profile = await currentMarket()
  const person = await activePerson(input.personId, req)
  let invoiceId: string | undefined
  let originalAmountMinor = input.originalAmountMinor
  let recordDate = input.recordDate

  const payload = await getPayload({ config })
  if (input.invoiceId) {
    if (input.direction !== 'owedToUs' || input.kind !== 'unpaidInvoice') {
      throw new Error('Only an unpaid-invoice record can link an invoice.')
    }
    const invoice = await payload.findByID({ collection: 'invoices', id: input.invoiceId, req })
    const duplicate = await payload.find({
      collection: 'money-accounts',
      limit: 1,
      req,
      where: { invoice: { equals: invoice.id } },
    })
    if (duplicate.totalDocs) throw new Error('This invoice is already being tracked.')
    invoiceId = invoice.id
    originalAmountMinor = invoice.totalMinor
    recordDate = toMarketDateInput(invoice.issuedAt, profile)
  }
  const products =
    input.direction === 'weOwe' && input.kind === 'supplierCredit'
      ? await resolveProducts(input.products, req)
      : []
  if (products.length) originalAmountMinor = productRowsTotal(products)
  if (!Number.isSafeInteger(originalAmountMinor) || originalAmountMinor! < 1) {
    throw new Error('Enter an amount greater than zero.')
  }
  const { dueISO, recordISO } = validateDates(recordDate, input.dueDate, profile)

  return {
    countryCode: profile.countryCode,
    currencyCode: profile.currencyCode,
    currencyMinorUnitDigits: profile.minorUnitDigits,
    direction: input.direction,
    dueDate: dueISO,
    idempotencyKey: input.idempotencyKey,
    invoice: invoiceId,
    kind: input.kind,
    note: optional(input.note),
    originalAmountMinor: originalAmountMinor!,
    person: person.id,
    personSnapshot: { name: person.name, phone: optional(person.phone) },
    products,
    recordDate: recordISO,
    reference: optional(input.reference),
    status: 'confirmed' as const,
    timeZone: profile.timeZone,
  }
}

function uniqueError(error: unknown) {
  return /duplicate|unique|constraint/i.test(error instanceof Error ? error.message : String(error))
}

export async function createMoneyAccount(
  input: MoneyAccountInput,
  req?: Partial<PayloadRequest>,
): Promise<MoneyAccount> {
  const duplicate = await existingAccountByKey(input.idempotencyKey, req)
  if (duplicate) return duplicate
  const payload = await getPayload({ config })
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await payload.create({
        collection: 'money-accounts',
        data: {
          ...(await createAccountData(input, req)),
          recordNumber: await allocateRecordNumber(input.direction, req),
        },
        req,
      })
    } catch (error) {
      const existing = await existingAccountByKey(input.idempotencyKey, req)
      if (existing) return existing
      if (!uniqueError(error) || attempt === 4) throw error
    }
  }
  throw new Error('Unable to create a unique record number.')
}

async function confirmedPayments(accountId: string, req?: Partial<PayloadRequest>) {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'money-payments',
    pagination: false,
    req,
    where: {
      and: [{ account: { equals: accountId } }, { status: { equals: 'confirmed' } }],
    },
  })
  return result.docs
}

export async function updateMoneyAccount(
  id: string,
  input: MoneyAccountUpdateInput,
): Promise<MoneyAccount> {
  const payload = await getPayload({ config })
  const current = await payload.findByID({ collection: 'money-accounts', id })
  if (current.status !== 'confirmed') throw new Error('A voided record cannot be edited.')
  const currentPersonId = relationshipId(current.person)
  const person = input.personId === currentPersonId ? null : await activePerson(input.personId)
  const profile = getDocumentMarket(current)
  const { dueISO, recordISO } = validateDates(input.recordDate, input.dueDate, profile)
  const payments = await confirmedPayments(id)
  if (payments.some(({ paymentDate }) => new Date(paymentDate) < new Date(recordISO))) {
    throw new Error('The record date cannot be after an existing payment.')
  }
  const paidMinor = payments.reduce((sum, payment) => sum + payment.amountMinor, 0)
  if (!allowedKind(current.direction, input.kind)) throw new Error('Choose a valid record type.')
  const products =
    current.direction === 'weOwe' && input.kind === 'supplierCredit'
      ? await resolveProducts(
          input.products,
          undefined,
          new Map(
            (current.products || []).flatMap((row) => {
              const id = relationshipId(row.product)
              return id ? [[id, row.productSnapshot.name] as const] : []
            }),
          ),
        )
      : []
  const originalAmountMinor = current.invoice
    ? current.originalAmountMinor
    : products.length
      ? productRowsTotal(products)
      : input.originalAmountMinor
  if (!Number.isSafeInteger(originalAmountMinor) || originalAmountMinor! < paidMinor || originalAmountMinor! < 1) {
    throw new Error('The amount cannot be less than money already paid.')
  }
  return payload.update({
    collection: 'money-accounts',
    id,
    data: {
      dueDate: dueISO,
      kind: current.invoice ? 'unpaidInvoice' : input.kind,
      note: optional(input.note),
      originalAmountMinor: originalAmountMinor!,
      person: person?.id || currentPersonId,
      personSnapshot: person
        ? { name: person.name, phone: optional(person.phone) }
        : current.personSnapshot,
      products,
      recordDate: recordISO,
      reference: optional(input.reference),
    },
  })
}

export async function voidMoneyAccount(id: string, reason: string): Promise<MoneyAccount> {
  const payload = await getPayload({ config })
  const account = await payload.findByID({ collection: 'money-accounts', id })
  if (account.status !== 'confirmed') throw new Error('This record is already voided.')
  if ((await confirmedPayments(id)).length) {
    throw new Error('Void the record payments before voiding this record.')
  }
  return payload.update({
    collection: 'money-accounts',
    id,
    data: { status: 'voided', voidedAt: new Date().toISOString(), voidReason: reason.trim() },
  })
}

async function existingPayment(key: string, req?: Partial<PayloadRequest>) {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'money-payments',
    limit: 1,
    req,
    where: { idempotencyKey: { equals: key } },
  })
  return result.docs[0] || null
}

function paymentDetails(input: MoneyPaymentInput, profile: ReturnType<typeof getDocumentMarket>) {
  if (input.paymentMethod === 'cash') return undefined
  if (input.paymentMethod === 'bank_transfer') {
    return {
      bankName: input.bankName,
      transactionReference: input.transactionReference,
      transferDate: dateInputToISOString(input.transferDate!, profile),
    }
  }
  if (input.paymentMethod === 'cheque') {
    return {
      bankName: input.bankName,
      chequeDate: dateInputToISOString(input.chequeDate!, profile),
      chequeNumber: input.chequeNumber,
    }
  }
  return { otherDescription: input.otherDescription, otherReference: optional(input.otherReference) }
}

function voucherInput(input: MoneyPaymentInput, account: MoneyAccount) {
  const base = {
    amountMinor: input.amountMinor,
    idempotencyKey: input.idempotencyKey,
    notes: optional(input.note),
    purpose: `Payment for ${account.recordNumber}`,
    receivedFrom: account.personSnapshot.name,
    voucherDate: input.paymentDate,
  }
  if (input.paymentMethod === 'cash') return { ...base, paymentMethod: 'cash' as const }
  if (input.paymentMethod === 'bank_transfer') {
    return {
      ...base,
      bankName: input.bankName!,
      paymentMethod: 'bank_transfer' as const,
      transactionReference: input.transactionReference!,
      transferDate: input.transferDate!,
    }
  }
  if (input.paymentMethod === 'cheque') {
    return {
      ...base,
      bankName: input.bankName!,
      chequeDate: input.chequeDate!,
      chequeNumber: input.chequeNumber!,
      paymentMethod: 'cheque' as const,
    }
  }
  return {
    ...base,
    otherDescription: input.otherDescription!,
    otherReference: optional(input.otherReference),
    paymentMethod: 'other' as const,
  }
}

export async function createMoneyPaymentInTransaction(
  input: MoneyPaymentInput,
  req: Partial<PayloadRequest>,
): Promise<MoneyPayment> {
  const duplicate = await existingPayment(input.idempotencyKey, req)
  if (duplicate) return duplicate
  const payload = await getPayload({ config })
  const account = await payload.findByID({ collection: 'money-accounts', id: input.accountId, req })
  if (account.status !== 'confirmed') throw new Error('Payments cannot be added to a voided record.')
  const profile = getDocumentMarket(account)
  dateInputToISOString(input.paymentDate, profile)
  if (input.paymentDate < todayDateInput(profile, new Date(account.recordDate))) {
    throw new Error('The payment date cannot be before the record date.')
  }
  if (input.paymentDate > todayDateInput(profile)) throw new Error('The payment date cannot be in the future.')
  const payments = await confirmedPayments(account.id, req)
  const remaining = account.originalAmountMinor - payments.reduce((sum, payment) => sum + payment.amountMinor, 0)
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1 || input.amountMinor > remaining) {
    throw new Error('Payment cannot be greater than the remaining amount.')
  }
  if (input.createReceiptVoucher && account.direction !== 'owedToUs') {
    throw new Error('Receipt vouchers are only available for money received.')
  }
  const voucher = input.createReceiptVoucher
    ? await createIssuedReceiptVoucher(voucherInput(input, account), req)
    : undefined
  return payload.create({
    collection: 'money-payments',
    data: {
      account: account.id,
      amountMinor: input.amountMinor,
      countryCode: account.countryCode,
      currencyCode: account.currencyCode,
      currencyMinorUnitDigits: account.currencyMinorUnitDigits,
      direction: account.direction,
      idempotencyKey: input.idempotencyKey,
      note: optional(input.note),
      paymentDate: dateInputToISOString(input.paymentDate, profile),
      paymentDetails: paymentDetails(input, profile),
      paymentMethod: input.paymentMethod,
      personSnapshot: { name: account.personSnapshot.name },
      receiptVoucher: voucher?.id,
      reference: optional(input.reference),
      status: 'confirmed',
      timeZone: account.timeZone,
    },
    req,
  })
}

export async function createMoneyPayment(input: MoneyPaymentInput): Promise<MoneyPayment> {
  const duplicate = await existingPayment(input.idempotencyKey)
  if (duplicate) return duplicate
  const payload = await getPayload({ config })
  const transactionID = await payload.db.beginTransaction()
  const req = transactionID === null ? { payload } : { payload, transactionID }
  try {
    const payment = await createMoneyPaymentInTransaction(input, req)
    if (transactionID !== null) await payload.db.commitTransaction(transactionID)
    return payment
  } catch (error) {
    if (transactionID !== null) await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    const existing = await existingPayment(input.idempotencyKey)
    if (existing) return existing
    throw error
  }
}

export async function voidMoneyPayment(id: string, reason: string): Promise<MoneyPayment> {
  const payload = await getPayload({ config })
  const transactionID = await payload.db.beginTransaction()
  const req = transactionID === null ? undefined : { payload, transactionID }
  try {
    const payment = await payload.findByID({ collection: 'money-payments', id, req })
    if (payment.status !== 'confirmed') throw new Error('This payment is already voided.')
    const voucherId = relationshipId(payment.receiptVoucher)
    if (voucherId) await voidReceiptVoucher(voucherId, reason, req, true)
    const updated = await payload.update({
      collection: 'money-payments',
      id,
      data: { status: 'voided', voidedAt: new Date().toISOString(), voidReason: reason.trim() },
      req,
    })
    if (transactionID !== null) await payload.db.commitTransaction(transactionID)
    return updated
  } catch (error) {
    if (transactionID !== null) await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    throw error
  }
}

function buildViews(
  accounts: MoneyAccount[],
  payments: MoneyPayment[],
  now = new Date(),
): MoneyAccountView[] {
  const grouped = new Map<string, MoneyPayment[]>()
  for (const payment of payments) {
    const accountId = relationshipId(payment.account)
    if (!accountId) continue
    grouped.set(accountId, [...(grouped.get(accountId) || []), payment])
  }
  return accounts.map((account) => {
    const accountPayments = (grouped.get(account.id) || []).sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
    )
    const paidMinor = accountPayments
      .filter(({ status }) => status === 'confirmed')
      .reduce((sum, payment) => sum + payment.amountMinor, 0)
    const remainingMinor = Math.max(0, account.originalAmountMinor - paidMinor)
    const profile = getDocumentMarket(account)
    const overdue =
      remainingMinor > 0 && account.dueDate
        ? new Date(account.dueDate) < getPeriodBounds(profile, now).todayStart
        : false
    return {
      account,
      derivedStatus:
        account.status === 'voided'
          ? 'voided'
          : remainingMinor === 0
            ? 'paid'
            : overdue
              ? 'overdue'
              : 'open',
      paidMinor,
      payments: accountPayments,
      remainingMinor,
    }
  })
}

export async function getMoneyDashboard(direction: MoneyDirection): Promise<MoneyDashboard> {
  const payload = await getPayload({ config })
  const [accountResult, paymentResult, people, profile] = await Promise.all([
    payload.find({
      collection: 'money-accounts',
      depth: 2,
      pagination: false,
      sort: '-recordDate,-createdAt',
      where: { direction: { equals: direction } },
    }),
    payload.find({
      collection: 'money-payments',
      depth: 2,
      pagination: false,
      sort: '-paymentDate,-createdAt',
      where: { direction: { equals: direction } },
    }),
    getMoneyPeople(true),
    currentMarket(),
  ])
  const accounts = buildViews(accountResult.docs, paymentResult.docs)
  const confirmed = accounts.filter(({ account }) => account.status === 'confirmed')
  const personMap = new Map<string, MoneyPersonBalance>()
  for (const view of confirmed) {
    const person = typeof view.account.person === 'string'
      ? people.find(({ id }) => id === view.account.person)
      : view.account.person
    if (!person) continue
    const current = personMap.get(person.id) || { openRecords: 0, person, remainingMinor: 0 }
    current.remainingMinor += view.remainingMinor
    if (view.remainingMinor > 0) current.openRecords += 1
    personMap.set(person.id, current)
  }
  return {
    accounts,
    market: profile,
    people,
    personBalances: [...personMap.values()]
      .filter(({ remainingMinor }) => remainingMinor > 0)
      .sort((a, b) => b.remainingMinor - a.remainingMinor || a.person.name.localeCompare(b.person.name)),
    summary: {
      openRecords: confirmed.filter(({ remainingMinor }) => remainingMinor > 0).length,
      overdueMinor: confirmed
        .filter(({ derivedStatus }) => derivedStatus === 'overdue')
        .reduce((sum, view) => sum + view.remainingMinor, 0),
      paidMinor: confirmed.reduce((sum, view) => sum + view.paidMinor, 0),
      remainingMinor: confirmed.reduce((sum, view) => sum + view.remainingMinor, 0),
    },
  }
}

export async function getAvailableMoneyInvoices(): Promise<MoneyInvoiceOption[]> {
  const payload = await getPayload({ config })
  const [invoices, accounts] = await Promise.all([
    payload.find({ collection: 'invoices', pagination: false, sort: '-issuedAt' }),
    payload.find({
      collection: 'money-accounts',
      pagination: false,
      where: { invoice: { exists: true } },
    }),
  ])
  const used = new Set(accounts.docs.map(({ invoice }) => relationshipId(invoice)).filter(Boolean))
  return invoices.docs
    .filter(({ id }) => !used.has(id))
    .map((invoice) => ({
      customerName: invoice.serviceBoardDetails?.customerName || invoice.buyer?.name || undefined,
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      totalMinor: invoice.totalMinor,
    }))
}

export async function getInvoiceMoneyAccount(invoiceId: string): Promise<MoneyAccountView | null> {
  const payload = await getPayload({ config })
  const accounts = await payload.find({
    collection: 'money-accounts',
    depth: 2,
    limit: 1,
    where: { invoice: { equals: invoiceId } },
  })
  const account = accounts.docs[0]
  if (!account) return null
  const payments = await payload.find({
    collection: 'money-payments',
    depth: 2,
    pagination: false,
    where: { account: { equals: account.id } },
  })
  return buildViews([account], payments.docs)[0] || null
}

export async function getInvoicePaymentSummaries(
  invoices: Pick<Invoice, 'id' | 'totalMinor'>[],
): Promise<Map<string, InvoicePaymentSummary>> {
  const summaries = new Map<string, InvoicePaymentSummary>(
    invoices.map((invoice) => [invoice.id, {
      paidMinor: invoice.totalMinor,
      remainingMinor: 0,
      status: 'paid' as const,
    }]),
  )
  if (!invoices.length) return summaries
  const payload = await getPayload({ config })
  const accounts = await payload.find({
    collection: 'money-accounts',
    depth: 0,
    pagination: false,
    where: {
      and: [
        { invoice: { in: invoices.map(({ id }) => id) } },
        { status: { equals: 'confirmed' } },
      ],
    },
  })
  if (!accounts.docs.length) return summaries
  const payments = await payload.find({
    collection: 'money-payments',
    depth: 0,
    pagination: false,
    where: {
      and: [
        { account: { in: accounts.docs.map(({ id }) => id) } },
        { status: { equals: 'confirmed' } },
      ],
    },
  })
  const paidByAccount = new Map<string, number>()
  for (const payment of payments.docs) {
    const accountId = relationshipId(payment.account)
    if (accountId) paidByAccount.set(accountId, (paidByAccount.get(accountId) || 0) + payment.amountMinor)
  }
  for (const account of accounts.docs) {
    const invoiceId = relationshipId(account.invoice)
    if (!invoiceId) continue
    const paidMinor = Math.min(account.originalAmountMinor, paidByAccount.get(account.id) || 0)
    const remainingMinor = Math.max(0, account.originalAmountMinor - paidMinor)
    summaries.set(invoiceId, {
      paidMinor,
      personName: account.personSnapshot.name,
      remainingMinor,
      status: remainingMinor === 0 ? 'paid' : paidMinor > 0 ? 'partial' : 'unpaid',
    })
  }
  return summaries
}

type MoneyLedgerRange = { start?: string; end?: string }

export async function getMoneyLedgerSummary(
  direction: MoneyDirection,
  range: MoneyLedgerRange,
  now = new Date(),
) {
  const payload = await getPayload({ config })
  const [accounts, payments] = await Promise.all([
    payload.find({
      collection: 'money-accounts',
      depth: 0,
      pagination: false,
      where: { direction: { equals: direction } },
    }),
    payload.find({
      collection: 'money-payments',
      depth: 0,
      pagination: false,
      where: { direction: { equals: direction } },
    }),
  ])
  return summarizeMoneyLedger(accounts.docs, payments.docs, direction, range, now)
}

export function summarizeMoneyLedger(
  accounts: MoneyAccount[],
  payments: MoneyPayment[],
  direction: MoneyDirection,
  range: MoneyLedgerRange,
  now: Date,
) {
  const start = range.start ? Date.parse(range.start) : -Infinity
  const end = Math.min(range.end ? Date.parse(range.end) : Infinity, now.getTime())
  const confirmedAccounts = accounts.filter(
    (account) =>
      account.status === 'confirmed' &&
      account.direction === direction &&
      Date.parse(account.recordDate) < end,
  )
  const remainingByAccount = new Map(
    confirmedAccounts.map(({ id, originalAmountMinor }) => [id, originalAmountMinor]),
  )
  let paidMinor = 0
  for (const payment of payments) {
    if (payment.status !== 'confirmed' || payment.direction !== direction) continue
    const paidAt = Date.parse(payment.paymentDate)
    if (paidAt >= end) continue
    const accountId = relationshipId(payment.account)
    if (!accountId) continue
    const remaining = remainingByAccount.get(accountId)
    if (remaining === undefined) continue
    remainingByAccount.set(accountId, remaining - payment.amountMinor)
    if (paidAt >= start) paidMinor += payment.amountMinor
  }
  let remainingMinor = 0
  let invoiceRemainingMinor = 0
  for (const account of confirmedAccounts) {
    const remaining = Math.max(0, remainingByAccount.get(account.id) ?? 0)
    remainingMinor += remaining
    if (account.invoice) invoiceRemainingMinor += remaining
  }
  return { paidMinor, remainingMinor, invoiceRemainingMinor }
}

export function moneyProductId(product: string | Product) {
  return relationshipId(product)
}
