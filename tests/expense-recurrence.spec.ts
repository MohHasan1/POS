import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { recurringOccurrenceDates } from '@/lib/expense-recurrence'
import { MARKET_PROFILES } from '@/lib/market'

describe('expense recurrence', () => {
  it('generates weekly dates without crossing the requested boundary', () => {
    assert.deepEqual(
      recurringOccurrenceDates(
        {
          frequency: 'weekly',
          startDate: '2026-11-01',
          weeklyDay: 2,
        },
        MARKET_PROFILES.BD,
        '2026-11-19',
      ),
      ['2026-11-03', '2026-11-10', '2026-11-17'],
    )
  })

  it('bounds monthly bills to the last calendar day', () => {
    assert.deepEqual(
      recurringOccurrenceDates(
        {
          frequency: 'monthly',
          monthlyDay: 31,
          startDate: '2026-01-31',
        },
        MARKET_PROFILES.SA,
        '2026-04-30',
      ),
      ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
    )
  })

  it('bounds leap-day yearly bills and honors an end date', () => {
    assert.deepEqual(
      recurringOccurrenceDates(
        {
          endDate: '2028-12-31',
          frequency: 'yearly',
          startDate: '2026-02-28',
          yearlyDay: 29,
          yearlyMonth: 2,
        },
        MARKET_PROFILES.BD,
        '2030-12-31',
      ),
      ['2026-02-28', '2027-02-28', '2028-02-29'],
    )
  })
})
