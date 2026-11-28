import config from '@payload-config'
import { getPayload, type Payload, type Where } from 'payload'

import { dateInputToISOString, todayDateInput, toMarketDateInput } from '@/lib/calendar'
import type { CashAccount } from '@/lib/cash'
import type { MarketProfile } from '@/lib/market'

import { cashPaymentTime, postInvoiceReceipt, type CashRequest } from './cash-postings'
import { cashTransaction } from './cash-report'
import { marketContextFromSettings } from './settings'

const sourceFor = (id: string) => `sale:${id}`

async function reviewableSales(payload: Payload, market: MarketProfile, now: Date, req?: CashRequest, ids?: string[]) {
  const today = todayDateInput(market, now)
  const currentDay = dateInputToISOString(today, market)
  const where: Where = {
    countryCode: { equals: market.countryCode },
    issuedAt: { less_than_equal: now.toISOString() },
    totalMinor: { greater_than: 0 },
    or: [
      { issuedAt: { greater_than_equal: currentDay }, cashAccount: { exists: false } },
      { cashAccount: { equals: 'bank' }, bankPending: { equals: true } },
    ],
  }
  if (ids) where.id = { in: ids }
  const { docs } = await payload.find({
    collection: 'invoices', depth: 0, pagination: false, req, sort: ['-issuedAt', 'id'],
    select: { invoiceNumber: true, totalMinor: true, issuedAt: true, bankPending: true },
    where,
  })
  const excluded = new Set<string>()
  for (let offset = 0; offset < docs.length; offset += 150) {
    const invoiceIds = docs.slice(offset, offset + 150).map(({ id }) => id)
    const [{ docs: due }, { docs: received }] = await Promise.all([
      payload.find({
        collection: 'money-accounts', req, depth: 0, pagination: false, select: { invoice: true },
        where: { invoice: { in: invoiceIds }, status: { equals: 'confirmed' } },
      }),
      payload.find({
        collection: 'cash-ledger', req, depth: 0, pagination: false, select: { activeSource: true },
        where: { activeSource: { in: invoiceIds.map(sourceFor) } },
      }),
    ])
    for (const row of due) if (typeof row.invoice === 'string') excluded.add(row.invoice)
    for (const row of received) if (row.activeSource) excluded.add(row.activeSource.slice('sale:'.length))
  }
  return docs.filter(({ id }) => !excluded.has(id))
}

export async function getCashSaleReview(market: MarketProfile) {
  const items = await reviewableSales(await getPayload({ config }), market, new Date())
  return {
    legacy: items.filter(({ bankPending }) => !bankPending),
    pending: items.filter(({ bankPending }) => bankPending),
  }
}

export type CashSaleReview = Awaited<ReturnType<typeof getCashSaleReview>>

export async function classifyCashSales(invoiceIds: string[], account: CashAccount) {
  return cashTransaction(async (req) => {
    const market = marketContextFromSettings(await req.payload.findGlobal({ slug: 'shop-settings', req, depth: 0 })).profile
    const rows = await reviewableSales(req.payload, market, new Date(), req, invoiceIds)
    const eligible = new Set(rows.filter(({ bankPending }) => !bankPending).map(({ id }) => id))
    for (const id of new Set(invoiceIds)) {
      if (!eligible.has(id)) {
        const { docs: [posting] } = await req.payload.find({
          collection: 'cash-ledger', limit: 1, depth: 0, req,
          where: { activeSource: { equals: sourceFor(id) } },
        })
        if (posting && (account === 'cash' ? posting.cashMinor > 0 : posting.bankMinor > 0)) continue
        throw new Error('A selected sale has changed. Refresh the list and try again.')
      }
      const invoice = await req.payload.findByID({ collection: 'invoices', id, req, depth: 0 })
      await postInvoiceReceipt(req, invoice, account, invoice.issuedAt)
    }
  })
}

export async function confirmBankReceipt(invoiceId: string, date: string, amountMinor: number) {
  return cashTransaction(async (req) => {
    const market = marketContextFromSettings(await req.payload.findGlobal({ slug: 'shop-settings', req, depth: 0 })).profile
    const now = new Date()
    const [row] = await reviewableSales(req.payload, market, now, req, [invoiceId])
    if (!row?.bankPending) {
      const { docs: [posting] } = await req.payload.find({
        collection: 'cash-ledger', limit: 1, depth: 0, req,
        where: { activeSource: { equals: sourceFor(invoiceId) } },
      })
      if (posting?.bankMinor === amountMinor && toMarketDateInput(posting.effectiveAt, market) === date) return
      throw new Error('This sale is no longer waiting for a bank receipt.')
    }
    if (date < toMarketDateInput(row.issuedAt, market) || date > todayDateInput(market, now) ||
        !Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > row.totalMinor) {
      throw new Error('Enter a receipt date on or after the sale and an amount up to the sale total.')
    }
    const invoice = await req.payload.findByID({ collection: 'invoices', id: invoiceId, depth: 0, req })
    await postInvoiceReceipt(req, invoice, 'bank', cashPaymentTime(dateInputToISOString(date, market), market, now), amountMinor)
  })
}
