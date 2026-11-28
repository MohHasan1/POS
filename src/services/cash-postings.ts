import type { CollectionAfterChangeHook, Payload, PayloadRequest } from 'payload'

import { toMarketDateInput } from '@/lib/calendar'
import { cashAccountForPayment, cashDeltas, type CashAccount } from '@/lib/cash'
import { getDocumentMarket, type MarketProfile } from '@/lib/market'
import type { CashLedger, EmployeePayrollEntry, Expense, Invoice, MoneyAccount, MoneyPayment } from '@/payload-types'

export type CashRequest = Pick<PayloadRequest, 'payload' | 'transactionID'>

export async function getCashOpening(payload: Payload, req?: CashRequest) {
  return payload.findByID({ collection: 'cash-ledger', id: 'opening', depth: 0, disableErrors: true, req })
}

export function cashPaymentTime(
  paymentDate: string,
  market: MarketProfile,
  now: Date,
  previousDate?: string,
) {
  const day = toMarketDateInput(paymentDate, market)
  const today = toMarketDateInput(now.toISOString(), market)
  if (previousDate && toMarketDateInput(previousDate, market) === day) return previousDate
  return day === today ? now.toISOString() : paymentDate
}

type Posting =
  Pick<CashLedger, 'effectiveAt' | 'kind' | 'note' | 'countryCode' | 'currencyCode' | 'cashMinor' | 'bankMinor'>

async function getActiveCashPosting(req: CashRequest, source: string) {
  const { docs } = await req.payload.find({
    collection: 'cash-ledger', depth: 0, limit: 1, req, where: { activeSource: { equals: source } },
  })
  return docs[0]
}

function requireTransaction(req: CashRequest) {
  if (req.transactionID == null) {
    throw new Error('Cash tracking requires a database transaction.')
  }
}

async function replaceCashPosting(req: CashRequest, source: string, previous: CashLedger | undefined, next?: Posting) {
  if (!previous && !next) return
  if (
    previous && next && previous.effectiveAt === next.effectiveAt &&
    previous.cashMinor === next.cashMinor && previous.bankMinor === next.bankMinor
  ) return

  requireTransaction(req)
  if (previous) {
    await req.payload.update({
      collection: 'cash-ledger', id: previous.id, data: { activeSource: null }, req, depth: 0,
    })
    await req.payload.create({
      collection: 'cash-ledger', req, depth: 0,
      data: {
        cashMinor: -previous.cashMinor,
        bankMinor: -previous.bankMinor,
        kind: 'correction',
        note: previous.note,
        effectiveAt: previous.effectiveAt,
        countryCode: previous.countryCode,
        currencyCode: previous.currencyCode,
        source,
      },
    })
  }
  if (next) {
    await req.payload.create({ collection: 'cash-ledger', data: { ...next, source, activeSource: source }, req, depth: 0 })
  }
}

type AutomaticPosting = {
  account?: CashAccount
  amount: number
  date: string
  market: MarketProfile
  note: string
  exactTime?: boolean
}

async function syncCashPosting(
  req: CashRequest,
  kind: 'sale' | 'payment' | 'expense' | 'payroll',
  sourceId: string,
  input: AutomaticPosting,
) {
  const source = `${kind}:${sourceId}`
  const current = await getActiveCashPosting(req, source)
  const { market, account } = input
  const effectiveAt = input.exactTime ? input.date
    : cashPaymentTime(input.date, market, new Date(), current?.effectiveAt)
  const next = account && input.amount ? {
    ...cashDeltas(account, input.amount),
    kind,
    note: input.note.slice(0, 500),
    effectiveAt,
    countryCode: market.countryCode,
    currencyCode: market.currencyCode,
  } : undefined
  await replaceCashPosting(req, source, current, next)
}

export function postInvoiceReceipt(
  req: CashRequest, invoice: Invoice, account: CashAccount, effectiveAt: string, amount = invoice.totalMinor,
) {
  return syncCashPosting(req, 'sale', invoice.id, {
    account, amount, date: effectiveAt, exactTime: true,
    market: getDocumentMarket(invoice), note: invoice.invoiceNumber,
  })
}

export const postCashInvoice: CollectionAfterChangeHook<Invoice> = async ({ doc, operation, req, context }) => {
  if (operation !== 'create' || (doc.entrySource ?? 'live') !== 'live' || doc.totalMinor === 0 ||
      context.cashInvoiceUnpaid === true) return doc
  if (!doc.cashAccount) {
    if (await getCashOpening(req.payload, req)) throw new Error('Select Cash or Bank to record this sale.')
    return doc
  }
  if (!doc.bankPending) await postInvoiceReceipt(req, doc, doc.cashAccount, doc.createdAt)
  return doc
}

export const syncCashInvoiceTracking: CollectionAfterChangeHook<MoneyAccount> = async ({ doc, previousDoc, operation, req }) => {
  const invoiceId = typeof doc.invoice === 'string' ? doc.invoice : doc.invoice?.id
  if (!invoiceId || (operation === 'update' && doc.status === previousDoc.status)) return doc
  const source = `sale:${invoiceId}`
  const current = await getActiveCashPosting(req, source)
  if (doc.status === 'confirmed') {
    // A live sale can be moved to Money to Receive after the invoice was saved.
    // Remove its original paid amount so collecting it later books only once.
    await replaceCashPosting(req, source, current)
  } else if (!current) {
    const { docs: [sale] } = await req.payload.find({
      collection: 'cash-ledger', depth: 0, limit: 1, req,
      sort: '-createdAt',
      where: { source: { equals: source }, kind: { equals: 'sale' } },
    })
    if (sale) {
      await replaceCashPosting(req, source, undefined, {
        kind: 'sale',
        effectiveAt: sale.effectiveAt, cashMinor: sale.cashMinor, bankMinor: sale.bankMinor,
        countryCode: sale.countryCode, currencyCode: sale.currencyCode, note: sale.note,
      })
    }
  }
  return doc
}

export const postCashPayment: CollectionAfterChangeHook<MoneyPayment> = async ({ doc, req }) => {
  if (doc.status === 'voided') {
    const expense = await req.payload.count({
      collection: 'expenses', req, where: { cashPayment: { equals: doc.id } },
    })
    if (expense.totalDocs) throw new Error('Unlink this payment from its expense before voiding it.')
  }
  await syncCashPosting(req, 'payment', doc.id, {
    account: doc.status === 'confirmed' ? cashAccountForPayment(doc.paymentMethod) : undefined,
    amount: doc.direction === 'owedToUs' ? doc.amountMinor : -doc.amountMinor,
    date: doc.paymentDate, market: getDocumentMarket(doc), note: doc.personSnapshot.name,
  })
  return doc
}

export const postCashExpense: CollectionAfterChangeHook<Expense> = async ({ doc, req }) => {
  const link = typeof doc.cashPayment === 'string' ? doc.cashPayment : doc.cashPayment?.id
  if (link) {
    if (doc.status !== 'confirmed' || doc.paymentStatus !== 'paid') {
      throw new Error('Only a paid expense can be linked to a Money payment.')
    }
    const source = await getActiveCashPosting(req, `payment:${link}`)
    const account = cashAccountForPayment(doc.paymentMethod)
    const expected = account ? cashDeltas(account, -doc.totalMinor) : null
    if (!source || !expected || source.cashMinor !== expected.cashMinor ||
        source.bankMinor !== expected.bankMinor || source.countryCode !== doc.countryCode ||
        toMarketDateInput(source.effectiveAt, getDocumentMarket(doc)) !==
        toMarketDateInput(doc.paidAt || doc.billDate, getDocumentMarket(doc))) {
      throw new Error('Choose a Money payment with the same date, amount, and payment method.')
    }
  }
  await syncCashPosting(req, 'expense', doc.id, {
    account: !link && doc.status === 'confirmed' && doc.paymentStatus === 'paid'
      ? cashAccountForPayment(doc.paymentMethod) : undefined,
    amount: -doc.totalMinor,
    date: doc.paidAt || doc.billDate,
    market: getDocumentMarket(doc),
    note: doc.name,
  })
  return doc
}

export const postCashPayroll: CollectionAfterChangeHook<EmployeePayrollEntry> = async ({ doc, req }) => {
  if (doc.entryType !== 'payout') return doc
  await syncCashPosting(req, 'payroll', doc.id, {
    account: cashAccountForPayment(doc.paymentMethod), amount: -doc.amountMinor,
    date: doc.entryDate, market: getDocumentMarket(doc), note: doc.employeeSnapshot.name,
  })
  return doc
}
