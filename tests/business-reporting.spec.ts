import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
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
      averageInvoiceMinor: 11_500,
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
      salesContributionMinor: 4_000,
      totalCompensationMinor: 5_000,
      variableExpenseMinor: 0,
      vatMinor: 1_500,
    })
    assert.equal(report.employeeMetrics[0].outstandingMinor, 4_000)
    assert.equal(report.employeeMetrics[0].contributionMinor, 1_000)
    assert.equal(report.employeeMetrics[0].salesContributionMinor, 4_000)
  })

  it('keeps daily sales contribution separate from salary and operating expenses', () => {
    const report = buildBusinessReport(
      {
        commissionOverrides: [],
        costOverrides: [],
        employees: [],
        expenses: [
          {
            billDate: '2026-11-19T08:00:00.000Z',
            categorySnapshot: { name: 'Utilities' },
            netMinor: 1_000,
            paymentStatus: 'paid',
            recordType: 'variable',
            status: 'confirmed',
            totalMinor: 1_000,
          },
        ],
        invoices: [
          {
            issuedAt: '2026-11-19T06:00:00.000Z',
            items: [
              {
                commission: { amountMinor: 1_000 },
                cost: { totalCostMinor: 2_000 },
                descriptionEnglish: 'Service',
                id: 'daily-line',
                netMinor: 10_000,
                quantityMilliunits: 1_000,
              },
            ],
            totalMinor: 10_000,
            vatMinor: 0,
          },
        ],
        payrollEntries: [
          {
            amountMinor: 5_000,
            employee: 'employee-1',
            employeeSnapshot: { name: 'Worker' },
            entryDate: '2026-11-19T08:00:00.000Z',
            entryType: 'monthlySalary',
            salaryMonth: '2026-11',
          },
        ],
      } as never,
      { period: 'today' },
      MARKET_PROFILES.BD,
      'bn',
      new Date('2026-11-19T12:00:00.000Z'),
    )

    assert.equal(report.summary.salesContributionMinor, 7_000)
    assert.equal(report.summary.operatingProfitMinor, 1_000)
    assert.equal(report.trend.length, 1)
    assert.equal(report.trend[0].salesContributionMinor, 7_000)
    assert.match(report.trend[0].key, /T\d{2}$/)
  })

  it('filters employee and product details without changing business totals or trend', () => {
    const report = buildBusinessReport(
      {
        commissionOverrides: [],
        costOverrides: [],
        employees: [
          { id: 'employee-1', name: 'One' },
          { id: 'employee-2', name: 'Two' },
        ],
        expenses: [],
        invoices: [
          {
            employee: 'employee-1',
            employeeSnapshot: { name: 'One' },
            id: 'invoice-1',
            invoiceNumber: 'INV-1',
            issuedAt: '2026-11-19T06:00:00.000Z',
            items: [
              {
                cost: { totalCostMinor: 1_000 },
                descriptionEnglish: 'Haircut',
                id: 'employee-1-line',
                netMinor: 4_000,
                product: 'product-1',
                quantityMilliunits: 1_000,
              },
            ],
            totalMinor: 4_000,
            vatMinor: 0,
          },
          {
            employee: 'employee-2',
            employeeSnapshot: { name: 'Two' },
            id: 'invoice-2',
            invoiceNumber: 'INV-2',
            issuedAt: '2026-11-19T07:00:00.000Z',
            items: [
              {
                cost: { totalCostMinor: 2_000 },
                descriptionEnglish: 'Facial',
                id: 'employee-2-line',
                netMinor: 6_000,
                product: 'product-2',
                quantityMilliunits: 1_000,
              },
            ],
            totalMinor: 6_000,
            vatMinor: 0,
          },
        ],
        payrollEntries: [],
      } as never,
      { employeeId: 'employee-1', period: 'today' },
      MARKET_PROFILES.BD,
      'bn',
      new Date('2026-11-19T12:00:00.000Z'),
    )

    assert.equal(report.summary.grossSalesMinor, 10_000)
    assert.equal(
      report.trend.reduce((total, point) => total + point.grossSalesMinor, 0),
      10_000,
    )
    assert.deepEqual(
      report.employeeMetrics.map(({ employeeId }) => employeeId),
      ['employee-1'],
    )
    assert.deepEqual(
      report.productMetrics.map(({ productId }) => productId),
      ['product-1'],
    )
    assert.deepEqual(
      report.sales.map(({ invoiceNumber }) => invoiceNumber),
      ['INV-1', 'INV-2'],
    )
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

    const custom = resolveBusinessReportPeriod(
      { endDate: '2026-11-01', period: 'custom', startDate: '2026-11-01' },
      MARKET_PROFILES.BD,
      now,
    )
    assert.equal(custom.selected.start, '2026-10-31T18:00:00.000Z')
    assert.equal(custom.selected.end, '2026-11-01T18:00:00.000Z')
  })

  it('uses period-aware trend buckets including adaptive all-time history', () => {
    const data = {
      commissionOverrides: [],
      costOverrides: [],
      employees: [],
      expenses: [],
      invoices: [
        {
          issuedAt: '2023-01-10T06:00:00.000Z',
          items: [],
          totalMinor: 1_000,
          vatMinor: 0,
        },
        {
          issuedAt: '2026-11-10T06:00:00.000Z',
          items: [],
          totalMinor: 2_000,
          vatMinor: 0,
        },
      ],
      payrollEntries: [],
    }
    const now = new Date('2026-11-19T12:00:00.000Z')
    const month = buildBusinessReport(
      data as never,
      { period: 'month' },
      MARKET_PROFILES.BD,
      'bn',
      now,
    )
    const year = buildBusinessReport(
      data as never,
      { period: 'year' },
      MARKET_PROFILES.BD,
      'bn',
      now,
    )
    const all = buildBusinessReport(data as never, { period: 'all' }, MARKET_PROFILES.BD, 'bn', now)

    assert.equal(month.trend[0].key, '2026-11-10')
    assert.equal(year.trend[0].key, '2026-11')
    assert.deepEqual(
      all.trend.map(({ key }) => key),
      ['2023', '2026'],
    )
  })

  it('provides a landscape print layout for PDF export', () => {
    const css = readFileSync(path.resolve(process.cwd(), 'src/app/(frontend)/styles.css'), 'utf8')

    assert.match(css, /@page report\s*{[^}]*size:\s*A4 landscape;/s)
    assert.match(css, /\.report-print,\s*\.report-print \*/)
    assert.match(css, /\.report-summary-grid\s*{[^}]*grid-template-columns:/s)
    assert.match(css, /\.report-screen\s*{[^}]*display:\s*none !important;/s)
    assert.match(css, /\.professional-report-row\s*{[^}]*break-inside:\s*avoid;/s)
  })
})
