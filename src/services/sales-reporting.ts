import config from '@payload-config'
import { getPayload } from 'payload'

import type { SalesDashboard, SalesPeriodMetric, TopServiceMetric } from '@/lib/service-board-types'
import { getSaudiPeriodBounds } from '@/lib/saudi-time'
import type { Invoice } from '@/payload-types'

function periodMetric(invoices: Invoice[]): SalesPeriodMetric {
  const totalMinor = invoices.reduce((total, invoice) => total + invoice.totalMinor, 0)
  return {
    averageMinor: invoices.length === 0 ? 0 : Math.round(totalMinor / invoices.length),
    invoiceCount: invoices.length,
    totalMinor,
  }
}

function inRange(invoice: Invoice, start: Date, end: Date): boolean {
  const issuedAt = new Date(invoice.issuedAt).getTime()
  return issuedAt >= start.getTime() && issuedAt < end.getTime()
}

export function buildSalesDashboard(invoices: Invoice[], now = new Date()): SalesDashboard {
  const bounds = getSaudiPeriodBounds(now)
  const today = invoices.filter((invoice) =>
    inRange(invoice, bounds.todayStart, bounds.nextDayStart),
  )
  const month = invoices.filter((invoice) =>
    inRange(invoice, bounds.monthStart, bounds.nextMonthStart),
  )
  const year = invoices.filter((invoice) =>
    inRange(invoice, bounds.yearStart, bounds.nextYearStart),
  )
  const topServices = new Map<string, TopServiceMetric>()

  for (const invoice of month) {
    for (const item of invoice.items) {
      const key = `${item.descriptionEnglish}\u0000${item.descriptionArabic}`
      const current = topServices.get(key) || {
        nameArabic: item.descriptionArabic,
        nameBangla: item.descriptionBangla || undefined,
        nameEnglish: item.descriptionEnglish,
        quantityMilliunits: 0,
        revenueMinor: 0,
      }
      current.quantityMilliunits += item.quantityMilliunits
      current.revenueMinor += item.totalMinor
      topServices.set(key, current)
    }
  }

  return {
    allTime: periodMetric(invoices),
    month: periodMetric(month),
    today: periodMetric(today),
    topServices: [...topServices.values()]
      .sort(
        (a, b) =>
          b.quantityMilliunits - a.quantityMilliunits ||
          b.revenueMinor - a.revenueMinor ||
          a.nameEnglish.localeCompare(b.nameEnglish),
      )
      .slice(0, 5),
    year: periodMetric(year),
  }
}

async function getAllInvoices(): Promise<Invoice[]> {
  const payload = await getPayload({ config })
  const invoices: Invoice[] = []
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
    invoices.push(...result.docs)
    totalPages = result.totalPages
    page += 1
  } while (page <= totalPages)

  return invoices
}

export async function getSalesDashboard(now = new Date()): Promise<SalesDashboard> {
  return buildSalesDashboard(await getAllInvoices(), now)
}
