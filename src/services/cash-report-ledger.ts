import type { CashBalances } from '@/lib/cash'
import type { CashLedger, Invoice } from '@/payload-types'

import type { CashRequest } from './cash-postings'

export type CashOpeningBalance = Pick<CashLedger, 'effectiveAt' | 'cashMinor' | 'bankMinor'>
export type PaymentSource = { kind: 'salesReceived'; invoiceId: string } | { kind: 'expensesPaid' | 'moneyPaidToPeople' }
type InvoiceVat = Pick<Invoice, 'totalMinor' | 'vatMinor'>

const accounts = ['cashMinor', 'bankMinor'] as const
const legacyCountKinds = new Set(['outflow', 'transfer', 'reconcile', 'ownerPickup'])

export function usesRecordedBalance(row: CashLedger) {
  return legacyCountKinds.has(row.kind) && !row.source?.includes(':net:')
}

export function groupCashMovements(rows: CashLedger[]) {
  const groups = new Map<string, { amounts: CashBalances; row: CashLedger; entries: CashLedger[] }>()
  for (const row of rows) {
    const key = row.source ? row.source + ':' + row.effectiveAt : row.id
    const group = groups.get(key) ?? { amounts: { cashMinor: 0, bankMinor: 0 }, row, entries: [] }
    group.amounts.cashMinor += row.cashMinor
    group.amounts.bankMinor += row.bankMinor
    group.entries.push(row)
    groups.set(key, group)
  }
  return [...groups.values()]
}

function vatOnReceipts(grossMinor: number, invoice: InvoiceVat) {
  if (!grossMinor || !invoice.vatMinor || invoice.totalMinor <= 0) return 0
  const gross = BigInt(Math.abs(grossMinor))
  const total = BigInt(invoice.totalMinor)
  return Math.sign(grossMinor) * Number((gross * BigInt(invoice.vatMinor) + total / 2n) / total)
}

function receiptInvoiceId(source: string | null | undefined, payments: ReadonlyMap<string, PaymentSource>) {
  if (!source) return
  if (source.startsWith('sale:')) return source.slice('sale:'.length)
  const payment = payments.get(source)
  return payment?.kind === 'salesReceived' ? payment.invoiceId : undefined
}

export async function cashLedgerExcludingSalesVat(
  payload: CashRequest['payload'],
  rows: CashLedger[],
  payments: ReadonlyMap<string, PaymentSource>,
  openingAt: (time: string) => CashOpeningBalance | null,
  req?: CashRequest,
) {
  const ids = [...new Set(rows.flatMap(({ source }) => receiptInvoiceId(source, payments) ?? []))]
  const invoices = new Map<string, InvoiceVat>()
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { docs } = await payload.find({
      collection: 'invoices', req, depth: 0, pagination: false,
      select: { totalMinor: true, vatMinor: true },
      where: { id: { in: ids.slice(offset, offset + 200) } },
    })
    for (const invoice of docs) invoices.set(invoice.id, invoice)
  }

  const paidByInvoice = new Map<string, number>()
  const result = new Map<string, CashLedger>()
  const chronological = [...rows].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt) ||
    a.createdAt.localeCompare(b.createdAt) ||
    Number(a.kind === 'ownerPickup') - Number(b.kind === 'ownerPickup') || a.id.localeCompare(b.id))
  const movements = groupCashMovements(chronological)
  const lastLegacy = chronological.reduce<string | undefined>(
    (latest, row) => usesRecordedBalance(row) ? row.effectiveAt : latest, undefined,
  )
  let start: string | undefined
  let current: CashBalances = { cashMinor: 0, bankMinor: 0 }
  let reserve: CashBalances = { cashMinor: 0, bankMinor: 0 }
  for (const { row, amounts, entries } of movements) {
    const opening = lastLegacy && row.effectiveAt <= lastLegacy ? openingAt(row.effectiveAt) : null
    if (opening && opening.effectiveAt !== start) {
      start = opening.effectiveAt
      current = { cashMinor: opening.cashMinor, bankMinor: opening.bankMinor }
      reserve = { cashMinor: 0, bankMinor: 0 }
    }
    const invoiceId = receiptInvoiceId(row.source, payments)
    const invoice = invoiceId ? invoices.get(invoiceId) : undefined
    if (invoiceId && invoice) {
      let paid = paidByInvoice.get(invoiceId) ?? 0
      const net = { cashMinor: 0, bankMinor: 0 }
      // Cumulative allocation lets partial receipts and reversals reconcile to the invoice VAT.
      for (const entry of entries) {
        const adjusted = { ...entry }
        for (const account of accounts) {
          const next = paid + entry[account]
          adjusted[account] -= vatOnReceipts(next, invoice) - vatOnReceipts(paid, invoice)
          paid = next
          net[account] += adjusted[account]
        }
        result.set(entry.id, adjusted)
      }
      paidByInvoice.set(invoiceId, paid)
      if (opening) {
        for (const account of accounts) {
          current[account] += net[account]
          reserve[account] = Math.max(0, reserve[account] + amounts[account] - net[account])
        }
      }
      continue
    }

    if (!opening) continue
    let adjusted = amounts
    // Older counts and withdrawals used physical balances. Remove any sales VAT they took out.
    if (usesRecordedBalance(row)) {
      adjusted = { ...amounts }
      for (const account of accounts) {
        const used = Math.min(reserve[account], Math.max(0, -amounts[account] - Math.max(0, current[account])))
        adjusted[account] += used
        reserve[account] -= used
        if (row.kind === 'transfer' && used) {
          const to = account === 'cashMinor' ? 'bankMinor' : 'cashMinor'
          adjusted[to] -= used
          reserve[to] += used
        }
      }
      result.set(row.id, { ...row, ...adjusted })
    }
    for (const account of accounts) current[account] += adjusted[account]
  }

  return rows.map((row) => result.get(row.id) ?? row)
}
