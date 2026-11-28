import { getPeriodBounds, todayDateInput } from '@/lib/calendar'
import type { CashBalances } from '@/lib/cash'
import type { MarketProfile } from '@/lib/market'
import type { CashClosing } from '@/payload-types'

import { dailyOpeningId } from './cash-opening'
import type { CashRequest } from './cash-postings'

type ClosingMovement = CashBalances & { kind: 'reconcile' | 'ownerPickup'; note?: string }

export async function saveNextDayOpening(
  req: CashRequest, market: MarketProfile, closedAt: Date, amount: number | undefined, closing: CashClosing | null,
) {
  if (amount === undefined || amount === closing?.nextDayCashMinor) return true

  const { nextDayStart } = getPeriodBounds(market, closedAt)
  const id = dailyOpeningId(market, todayDateInput(market, nextDayStart))
  const existing = await req.payload.findByID({
    collection: 'cash-ledger', id, req, depth: 0, disableErrors: true,
  })
  if (existing) {
    // A manual opening edit sets a snapshot source and takes precedence over the closing.
    if (closing?.nextDayCashMinor !== existing.cashMinor || existing.source != null || existing.bankMinor !== 0) return Boolean(closing)
    await req.payload.update({ collection: 'cash-ledger', id, req, depth: 0, data: { cashMinor: amount } })
  } else {
    await req.payload.create({
      collection: 'cash-ledger', req, depth: 0,
      data: {
        id, kind: 'opening', effectiveAt: nextDayStart.toISOString(), cashMinor: amount, bankMinor: 0,
        countryCode: market.countryCode, currencyCode: market.currencyCode,
      },
    })
  }
  return true
}

export async function saveClosingMovements(
  req: CashRequest, market: MarketProfile, dayId: string, closedAt: string, movements: ClosingMovement[], editing: boolean,
) {
  const sources = editing
    ? (await req.payload.find({
      collection: 'cash-ledger', req, depth: 0, pagination: false,
      where: { source: { in: movements.flatMap(({ kind }) => [`${kind}:close:${dayId}`, `${kind}:net:close:${dayId}`]) } },
    })).docs
    : []

  for (const movement of movements) {
    const existing = sources.find(({ kind }) => kind === movement.kind)
    const { countryCode, currencyCode } = market
    const data = { ...movement, effectiveAt: closedAt, source: `${movement.kind}:net:close:${dayId}`, countryCode, currencyCode }

    if (!movement.cashMinor && !movement.bankMinor) {
      if (existing) await req.payload.delete({ collection: 'cash-ledger', req, id: existing.id })
    } else if (existing) {
      await req.payload.update({ collection: 'cash-ledger', req, id: existing.id, depth: 0, data })
    } else {
      await req.payload.create({ collection: 'cash-ledger', req, depth: 0, data })
    }
  }
}
