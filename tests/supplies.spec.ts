import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { supplyDayLabel, supplyEstimateLabel, supplyLifespanComparison } from '@/components/supplies/format'
import { todayDateInput } from '@/lib/calendar'
import { getMarketProfile } from '@/lib/market'
import { getSupplyUsageTrends, matchesSupplyFilter, summarizeSupplyOverview, summarizeSupplyUsage, supplyElapsedDays } from '@/lib/supplies'
import bn from '@/messages/bn.json'
import en from '@/messages/en.json'
import {
  getSupplyCatalog,
  getSupplyDetails,
  saveSupply,
  setSupplyArchived,
  startSupplyUsage,
  updateSupplyUsage,
} from '@/services/supplies'

const BD = getMarketProfile('BD')
const SA = getMarketProfile('SA')
const now = new Date('2026-11-26T19:00:00Z')

describe('Supplies', () => {
  const supplyIds: string[] = []

  async function createSupply(name: string, expectedLifespanDays: number | null = null) {
    const supply = await saveSupply({ name, expectedLifespanDays })
    supplyIds.push(supply.id)
    return supply
  }

  after(async () => {
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'supply-usages', where: { supply: { in: supplyIds } } })
    await payload.delete({ collection: 'supplies', where: { id: { in: supplyIds } } })
  })

  it('validates the catalog and filters active and archived supplies by name', async () => {
    await assert.rejects(saveSupply({ name: '  ', expectedLifespanDays: null }), { message: 'invalidSettings' })
    for (const expectedLifespanDays of [0, -1, 3.5]) {
      await assert.rejects(saveSupply({ name: 'Cream', expectedLifespanDays }), { message: 'invalidSettings' })
    }
    const cream = await createSupply('  Shaving cream  ', 12)
    const blades = await createSupply('Blades')
    await setSupplyArchived(blades.id, true)

    const { entries } = await getSupplyCatalog(todayDateInput(BD, now))
    const empty = entries.find(({ supply }) => supply.id === cream.id)
    assert.deepEqual(empty?.summary, { inUse: 0, finished: 0, lastLifespan: null, averageLifespan: null })
    assert.deepEqual(empty?.costs, [])
    assert.equal(empty?.supply.name, 'Shaving cream')
    assert.equal(empty?.supply.expectedLifespanDays, 12)
    assert.deepEqual(entries.filter(({ supply }) => matchesSupplyFilter(supply, ' CREAM ', false))
      .map(({ supply }) => supply.id), [cream.id])
    assert.deepEqual(entries.filter(({ supply }) => matchesSupplyFilter(supply, 'blades', true))
      .map(({ supply }) => supply.id), [blades.id])
    assert.equal(entries.some(({ supply }) => matchesSupplyFilter(supply, 'does not exist', false)), false)
    assert.equal(await getSupplyDetails('missing'), null)
  })

  it('tracks multiple open units, retries, finishing, corrections, and archiving', async () => {
    const cream = await createSupply('Face cream', 4)
    const blades = await createSupply('Razor blades')
    const id = randomUUID()
    const starts = await Promise.all([
      startSupplyUsage(cream.id, id, { startedOn: '2026-11-20', label: 'Station 1' }, BD, now),
      startSupplyUsage(cream.id, id, { startedOn: '2026-11-20', label: 'Station 1' }, BD, now),
      startSupplyUsage(cream.id, randomUUID(), { startedOn: '2026-11-25', label: 'Station 2' }, BD, now),
    ])
    assert.equal(starts[0].id, starts[1].id)
    const second = starts[2].id
    const details = await getSupplyDetails(cream.id)
    assert.equal(details?.usages.length, 2)
    assert.equal(details?.summary.inUse, 2)
    await assert.rejects(setSupplyArchived(cream.id, true), { message: 'stillInUse' })
    await assert.rejects(
      startSupplyUsage(blades.id, id, { startedOn: '2026-11-20', label: null }, BD, now),
      { message: 'duplicateStart' },
    )
    await assert.rejects(updateSupplyUsage(blades.id, id, { operation: 'finish', finishedOn: '2026-11-25' }, BD, now), { message: 'notFound' })
    await assert.rejects(updateSupplyUsage(cream.id, id, { operation: 'finish', finishedOn: '2026-11-19' }, BD, now), { message: 'invalidDates' })
    await updateSupplyUsage(cream.id, id, { operation: 'finish', finishedOn: '2026-11-23' }, BD, now)
    await updateSupplyUsage(cream.id, id, { operation: 'finish', finishedOn: '2026-11-23' }, BD, now)
    await assert.rejects(updateSupplyUsage(cream.id, id, { operation: 'finish', finishedOn: '2026-11-24' }, BD, now), { message: 'alreadyFinished' })
    await updateSupplyUsage(cream.id, second, { operation: 'finish', finishedOn: '2026-11-25' }, BD, now)
    const expected = { inUse: 0, finished: 2, lastLifespan: 0, averageLifespan: 1.5 }
    assert.deepEqual((await getSupplyDetails(cream.id))?.summary, expected)
    const catalog = await getSupplyCatalog(todayDateInput(BD, now))
    assert.deepEqual(catalog.entries.find(({ supply }) => supply.id === cream.id)?.summary, expected)

    await setSupplyArchived(cream.id, true)
    await assert.rejects(startSupplyUsage(cream.id, randomUUID(), { startedOn: '2026-11-27', label: null }, BD, now), { message: 'archived' })
    const correction = { operation: 'correct', startedOn: '2026-11-21', finishedOn: null, label: 'Back station' } as const
    await assert.rejects(updateSupplyUsage(cream.id, id, correction, BD, now), { message: 'archived' })
    assert.deepEqual((await getSupplyDetails(cream.id))?.summary, expected)
    await setSupplyArchived(cream.id, false)
    await updateSupplyUsage(cream.id, id, correction, BD, now)
    const corrected = await getSupplyDetails(cream.id)
    assert.equal(corrected?.usages.find((usage) => usage.id === id)?.label, 'Back station')
    assert.equal(corrected?.summary.inUse, 1)

    await saveSupply({ name: 'Cream 2', expectedLifespanDays: 7 }, cream.id)
    assert.equal((await getSupplyDetails(cream.id))?.supply.expectedLifespanDays, 7)
    await saveSupply({ name: 'Cream 2', expectedLifespanDays: null }, cream.id)
    assert.equal((await getSupplyDetails(cream.id))?.supply.expectedLifespanDays, null)
    assert.deepEqual((await getSupplyDetails(cream.id))?.summary, corrected?.summary)
  })

  it('stores card details and keeps each estimate independent of the supply default', async () => {
    const supply = await createSupply('Blades with card details', 10)
    const base = { label: '  Blue pack ', startedOn: '2026-11-20' }
    const first = await startSupplyUsage(supply.id, randomUUID(), {
      ...base, vendor: '  Local vendor ', notes: '  Opened for station 2 ',
    }, BD, now)
    assert.equal(first.label, 'Blue pack')
    assert.equal(first.vendor, 'Local vendor')
    assert.equal(first.notes, 'Opened for station 2')
    assert.equal(first.expectedLifespanDays, 10)

    await saveSupply({ name: supply.name, expectedLifespanDays: 12 }, supply.id)
    const newer = await startSupplyUsage(supply.id, randomUUID(), base, BD, now)
    assert.equal(newer.expectedLifespanDays, 12)
    const override = await startSupplyUsage(supply.id, randomUUID(), { ...base, expectedLifespanDays: 6 }, BD, now)
    assert.equal(override.expectedLifespanDays, 6)
    const blank = await startSupplyUsage(supply.id, randomUUID(), { ...base, expectedLifespanDays: null }, BD, now)
    assert.equal(blank.expectedLifespanDays, null)
    await assert.rejects(
      startSupplyUsage(supply.id, randomUUID(), { ...base, expectedLifespanDays: 1.5 }, BD, now),
      { message: 'invalidEstimate' },
    )
    await assert.rejects(
      startSupplyUsage(supply.id, randomUUID(), { ...base, vendor: 'v'.repeat(161) }, BD, now),
      { message: 'invalidVendor' },
    )
    await assert.rejects(
      startSupplyUsage(supply.id, randomUUID(), { ...base, notes: 'n'.repeat(501) }, BD, now),
      { message: 'invalidNotes' },
    )

    const finished = await updateSupplyUsage(supply.id, first.id, { operation: 'finish', finishedOn: '2026-11-27' }, BD, now)
    assert.equal(finished.expectedLifespanDays, 10)
    assert.equal(finished.vendor, 'Local vendor')
    const correction = { ...base, operation: 'correct', finishedOn: '2026-11-27' } as const
    const corrected = await updateSupplyUsage(supply.id, first.id, { ...correction, expectedLifespanDays: 8 }, BD, now)
    assert.equal(corrected.expectedLifespanDays, 8)
    assert.equal(corrected.vendor, 'Local vendor')
    assert.equal(corrected.notes, 'Opened for station 2')
    const cleared = await updateSupplyUsage(supply.id, first.id, {
      ...correction, vendor: null, notes: null, expectedLifespanDays: null,
    }, BD, now)
    assert.equal(cleared.expectedLifespanDays, null)
    assert.equal(cleared.vendor, null)
    assert.equal(cleared.notes, null)
  })

  it('inherits and overrides costs without changing the price or currency of earlier cards', async () => {
    const supply = await createSupply('Priced blades')
    const settings = { name: supply.name, expectedLifespanDays: null }
    const usage = { startedOn: '2026-11-20', label: null }
    await saveSupply({ ...settings, defaultUnitCostMinor: 1_500 }, supply.id)
    const first = await startSupplyUsage(supply.id, randomUUID(), usage, BD, now)
    assert.equal(first.unitCostMinor, 1_500)
    assert.equal(first.costCurrencyCode, 'BDT')
    await saveSupply({ ...settings, defaultUnitCostMinor: 2_000 }, supply.id)
    const free = await startSupplyUsage(supply.id, randomUUID(), { ...usage, unitCostMinor: 0 }, BD, now)
    assert.equal(free.unitCostMinor, 0)
    const blank = await startSupplyUsage(supply.id, randomUUID(), { ...usage, unitCostMinor: null }, BD, now)
    assert.equal(blank.unitCostMinor, null)
    assert.equal(blank.costCurrencyCode, null)
    await assert.rejects(saveSupply({ ...settings, defaultUnitCostMinor: -1 }, supply.id), { message: 'invalidCost' })
    await assert.rejects(
      startSupplyUsage(supply.id, randomUUID(), { ...usage, unitCostMinor: 1.5 }, BD, now),
      { message: 'invalidCost' },
    )

    const before = await getSupplyDetails(supply.id)
    assert.equal(before?.usages.find(({ id }) => id === first.id)?.unitCostMinor, 1_500)
    assert.deepEqual(before?.costs, [
      { currencyCode: 'BDT', totalMinor: 1_500, lowestMinor: 0, highestMinor: 1_500, units: 2 },
    ])
    const catalog = await getSupplyCatalog(todayDateInput(BD, now))
    assert.deepEqual(catalog.entries.find((entry) => entry.supply.id === supply.id)?.costs, before?.costs)
    const finished = await updateSupplyUsage(supply.id, first.id, { operation: 'finish', finishedOn: '2026-11-22' }, BD, now)
    assert.equal(finished.unitCostMinor, 1_500)
    const corrected = await updateSupplyUsage(supply.id, first.id, {
      ...usage, operation: 'correct', finishedOn: '2026-11-22', unitCostMinor: 1_600,
    }, SA, now)
    assert.equal(corrected.costCurrencyCode, 'BDT')
    assert.deepEqual((await getSupplyDetails(supply.id))?.costs, [
      { currencyCode: 'BDT', totalMinor: 1_600, lowestMinor: 0, highestMinor: 1_600, units: 2 },
    ])
  })

  it('uses the business calendar in Dhaka and Riyadh and rejects invalid date inputs', async () => {
    const supply = await createSupply('Calendar test')
    const start = (startedOn: string, profile: typeof BD) =>
      startSupplyUsage(supply.id, randomUUID(), { startedOn, label: null }, profile, now)
    assert.equal((await start('2026-11-27', BD)).startedOn, '2026-11-27')
    await assert.rejects(start('2026-11-27', SA), { message: 'invalidDates' })
    assert.equal((await start('2026-11-26', SA)).startedOn, '2026-11-26')
    await assert.rejects(start('2026-02-30', BD), { message: 'invalidDates' })
    await assert.rejects(start('2026-11-28', BD), { message: 'invalidDates' })
    assert.equal(supplyElapsedDays('2026-12-30', '2027-01-02'), 3)
    assert.equal(supplyElapsedDays('2028-02-28', '2028-03-01'), 2)
  })

  it('renders elapsed days and expected estimates in English and Bangla', () => {
    const labels = en.supplyTracker
    assert.equal(supplyEstimateLabel(5, 4, 'en', labels), '1 day left')
    assert.equal(supplyEstimateLabel(5, 5, 'en', labels), 'Expected today')
    assert.equal(supplyEstimateLabel(5, 7, 'en', labels), '2 days past estimate')
    assert.equal(supplyEstimateLabel(5, 4, 'bn', bn.supplyTracker), '১ দিন বাকি')
    assert.equal(supplyDayLabel(15 / 7, 'en', labels), '2.1 days')
    const history = summarizeSupplyUsage([
      { startedOn: '2026-01-01', finishedOn: '2026-01-04' },
      { startedOn: '2026-02-01', finishedOn: '2026-02-01' },
      { startedOn: '2026-02-02' },
    ])
    assert.deepEqual(history, { inUse: 1, finished: 2, lastLifespan: 0, averageLifespan: 1.5 })
    assert.equal(supplyLifespanComparison(10, 7, 'en', labels), '3 days shorter than expected')
    assert.equal(supplyLifespanComparison(10, 10, 'en', labels), 'Lasted as expected')
    assert.equal(supplyLifespanComparison(10, 11, 'en', labels), '1 day longer than expected')
    assert.equal(supplyLifespanComparison(10, 7, 'bn', bn.supplyTracker), 'আনুমানিক মেয়াদের চেয়ে ৩ দিন কম')
  })

  it('charts the newest ten finishes and counts all finishes in six calendar months', () => {
    const units = Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      label: `Pack ${index}`,
      startedOn: '2026-12-01',
      finishedOn: `2026-12-${String(index + 1).padStart(2, '0')}`,
      expectedLifespanDays: index === 11 ? null : 10,
    }))
    const boundary = new Date('2026-12-31T18:30:00Z')
    const trends = getSupplyUsageTrends([
      { id: 'old', startedOn: '2026-06-30', finishedOn: '2026-07-01' },
      { id: 'open', startedOn: '2026-11-30', finishedOn: null },
      ...units,
    ], todayDateInput(BD, boundary))
    assert.deepEqual(trends.recent.map(({ id }) => id), units.slice(2).map(({ id }) => id))
    assert.deepEqual(trends.recent.at(-1), {
      id: '11', label: 'Pack 11', finishedOn: '2026-12-12', actual: 11, expected: null,
    })
    assert.deepEqual(trends.monthly.map(({ month }) => month), [
      '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01',
    ])
    assert.deepEqual(trends.monthly.map(({ finished }) => finished), [0, 0, 0, 0, 12, 0])
    assert.equal(getSupplyUsageTrends(units, todayDateInput(SA, boundary)).monthly.at(-1)?.month, '2026-12')
    assert.equal(getSupplyUsageTrends(units.slice(0, 1), '2026-12-01').recent[0].actual, 0)
  })

  it('summarizes shop-wide usage with archived history and saved estimates', () => {
    const today = '2026-11-27'
    const overview = summarizeSupplyOverview([
      {
        supply: { id: 'cream', name: 'Cream', archived: false },
        usages: [
          { startedOn: '2026-11-19', expectedLifespanDays: 7, unitCostMinor: 3_500, costCurrencyCode: 'BDT' },
          { startedOn: '2026-11-20', expectedLifespanDays: 7, unitCostMinor: 0, costCurrencyCode: 'BDT' },
          { startedOn: '2026-10-01' },
          { startedOn: '2026-11-01', finishedOn: '2026-11-27' },
          { startedOn: '2026-10-01', finishedOn: '2026-10-31', unitCostMinor: 2_500, costCurrencyCode: 'BDT' },
          { startedOn: '2026-11-01', finishedOn: '2026-11-28' },
        ],
      },
      {
        supply: { id: 'blades', name: 'Blades', archived: true },
        usages: [{ startedOn: '2026-11-01', finishedOn: '2026-11-10', unitCostMinor: 1_000, costCurrencyCode: 'SAR' }],
      },
      {
        supply: { id: 'aftershave', name: 'Aftershave', archived: false },
        usages: [],
      },
    ], today)
    assert.equal(overview.activeSupplies, 2)
    assert.equal(overview.inUse, 3)
    assert.equal(overview.pastEstimate, 1)
    assert.equal(overview.finishedThisMonth, 2)
    assert.equal(overview.openedThisMonth, 5)
    assert.deepEqual(overview.costsThisMonth, [
      { currencyCode: 'BDT', totalMinor: 3_500, lowestMinor: 0, highestMinor: 3_500, units: 2 },
      { currencyCode: 'SAR', totalMinor: 1_000, lowestMinor: 1_000, highestMinor: 1_000, units: 1 },
    ])
    assert.deepEqual(overview.monthly.map(({ finished }) => finished), [0, 0, 0, 0, 1, 2])
    assert.deepEqual(overview.topSupplies.map(({ name, finished }) => [name, finished]), [
      ['Blades', 1], ['Cream', 1],
    ])
    assert.deepEqual(summarizeSupplyOverview([], today).topSupplies, [])
  })

  it('keeps direct Payload collection access private', async () => {
    const payload = await getPayload({ config })
    for (const collection of ['supplies', 'supply-usages'] as const) {
      await assert.rejects(payload.find({ collection, overrideAccess: false }), { status: 403 })
    }
  })
})
