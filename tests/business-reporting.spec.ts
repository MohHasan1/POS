import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveBusinessReportPeriod } from '@/lib/business-report-periods'
import { MARKET_PROFILES } from '@/lib/market'
import { buildBusinessReport } from '@/services/business-reporting'

describe('business reporting', () => {
  it('calculates profit without treating payroll payouts as a second expense', () => {
    const employee = {
      active: false,
      compensationType: 'monthly',
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 'employee-1',
      name: 'Worker',
    }
    const report = buildBusinessReport(
      {
        commissionOverrides: [],
        costOverrides: [],
        employees: [employee],
        expenses: [
          {
            billDate: '2026-11-10T06:00:00.000Z',
            categorySnapshot: { name: 'Rent' },
            netMinor: 1_000,
            paymentStatus: 'paid',
            recordType: 'fixed',
            status: 'confirmed',
            totalMinor: 1_150,
          },
        ],
        invoices: [
          {
            employee: employee.id,
            employeeSnapshot: { name: employee.name },
            issuedAt: '2026-11-10T06:00:00.000Z',
            items: [
              {
                commission: { amountMinor: 2_000, basisMinor: 10_000, rateBps: 2_000 },
                cost: { totalCostMinor: 4_000, unitCostMinor: 4_000 },
                descriptionEnglish: 'Haircut',
                id: 'line-1',
                netMinor: 10_000,
                product: 'product-1',
                quantityMilliunits: 1_000,
              },
            ],
            totalMinor: 11_500,
            vatMinor: 1_500,
          },
        ],
        payrollEntries: [
          {
            amountMinor: 3_000,
            employee: employee.id,
            employeeSnapshot: { name: employee.name },
            entryDate: '2026-11-10T06:00:00.000Z',
            entryType: 'monthlySalary',
            salaryMonth: '2026-11',
          },
          {
            amountMinor: 1_000,
            employee: employee.id,
            employeeSnapshot: { name: employee.name },
            entryDate: '2026-11-10T06:00:00.000Z',
            entryType: 'payout',
          },
        ],
      } as never,
      { period: 'all' },
      MARKET_PROFILES.SA,
      'ar',
      new Date('2026-11-19T06:00:00.000Z'),
    )

    assert.deepEqual(report.summary, {
      billPaidMinor: 1_150,
      billUnpaidMinor: 0,
      capitalExpenseMinor: 0,
      commissionEarnedMinor: 2_000,
      directCostMinor: 4_000,
      expenseMinor: 1_000,
      fixedExpenseMinor: 1_000,
      grossProfitMinor: 6_000,
      grossSalesMinor: 11_500,
      invoiceCount: 1,
      netSalesMinor: 10_000,
      operatingProfitMinor: 0,
      payrollPaidMinor: 1_000,
      profitMarginBps: 0,
      salaryEarnedMinor: 3_000,
      totalCompensationMinor: 5_000,
      variableExpenseMinor: 0,
      vatMinor: 1_500,
    })
    assert.equal(report.employeeMetrics[0].outstandingMinor, 4_000)
    assert.equal(report.employeeMetrics[0].contributionMinor, 1_000)
  })

  it('marks missing direct costs and reports revenue coverage', () => {
    const report = buildBusinessReport(
      {
        commissionOverrides: [],
        costOverrides: [],
        employees: [],
        expenses: [],
        payrollEntries: [],
        invoices: [
          {
            issuedAt: '2026-11-10T06:00:00.000Z',
            items: [
              {
                descriptionEnglish: 'Known',
                id: 'known',
                netMinor: 7_500,
                cost: { totalCostMinor: 2_000 },
                quantityMilliunits: 1_000,
              },
              {
                descriptionEnglish: 'Unknown',
                id: 'unknown',
                netMinor: 2_500,
                quantityMilliunits: 1_000,
              },
            ],
            totalMinor: 10_000,
            vatMinor: 0,
          },
        ],
      } as never,
      { period: 'all' },
      MARKET_PROFILES.BD,
      'bn',
    )

    assert.equal(report.warnings.missingCostLines, 1)
    assert.equal(report.warnings.costCoverageBps, 7_500)
    assert.equal(report.summary.directCostMinor, 2_000)
  })

  it('tracks capital spending without reducing operating profit', () => {
    const report = buildBusinessReport(
      {
        commissionOverrides: [],
        costOverrides: [],
        employees: [],
        expenses: [
          {
            billDate: '2026-11-10T06:00:00.000Z',
            categorySnapshot: { name: 'Shop setup' },
            netMinor: 50_000,
            paymentStatus: 'paid',
            recordType: 'capital',
            status: 'confirmed',
            totalMinor: 50_000,
          },
        ],
        invoices: [],
        payrollEntries: [],
      } as never,
      { period: 'all' },
      MARKET_PROFILES.BD,
      'bn',
    )

    assert.equal(report.summary.capitalExpenseMinor, 50_000)
    assert.equal(report.summary.expenseMinor, 0)
    assert.equal(report.summary.operatingProfitMinor, 0)
    assert.equal(report.summary.billPaidMinor, 50_000)
    assert.equal(report.expenseMetrics[0].capitalMinor, 50_000)
    assert.equal(report.trend.length, 0)
  })

  it('uses current product costs for legacy lines while manual corrections take priority', () => {
    const data = {
      commissionOverrides: [],
      costOverrides: [],
      employees: [],
      expenses: [],
      payrollEntries: [],
      products: [{ id: 'product-1', unitCostMinor: 3_000 }],
      invoices: [
        {
          issuedAt: '2026-11-10T06:00:00.000Z',
          items: [
            {
              descriptionEnglish: 'Legacy haircut',
              id: 'legacy-line',
              netMinor: 10_000,
              product: 'product-1',
              quantityMilliunits: 1_500,
            },
          ],
          totalMinor: 10_000,
          vatMinor: 0,
        },
      ],
    }
    const fallbackReport = buildBusinessReport(
      data as never,
      { period: 'all' },
      MARKET_PROFILES.BD,
      'bn',
    )

    assert.equal(fallbackReport.summary.directCostMinor, 4_500)
    assert.equal(fallbackReport.warnings.costCoverageBps, 10_000)
    assert.equal(fallbackReport.warnings.missingCostLines, 0)

    const correctedReport = buildBusinessReport(
      {
        ...data,
        costOverrides: [{ invoiceItemId: 'legacy-line', totalCostMinor: 5_000 }],
      } as never,
      { period: 'all' },
      MARKET_PROFILES.BD,
      'bn',
    )

    assert.equal(correctedReport.summary.directCostMinor, 5_000)
  })

  it('uses matched elapsed comparison periods in the market timezone', () => {
    const now = new Date('2026-11-19T12:30:00.000Z')
    const ranges = resolveBusinessReportPeriod({ period: 'month' }, MARKET_PROFILES.BD, now)
    assert.equal(ranges.selected.start, '2026-10-31T18:00:00.000Z')
    assert.equal(ranges.selected.end, now.toISOString())
    assert.equal(ranges.comparison?.start, '2026-09-30T18:00:00.000Z')
    assert.equal(
      new Date(ranges.comparison!.end!).getTime() - new Date(ranges.comparison!.start!).getTime(),
      now.getTime() - new Date(ranges.selected.start!).getTime(),
    )
  })
})
