import config from '@payload-config'
import { getPayload } from 'payload'

import type { ProductSummary } from '@/lib/pos-types'
import type { ServiceBoardCard, ServiceBoardView } from '@/lib/service-board-types'
import { getPeriodBounds } from '@/lib/calendar'
import { DEFAULT_MARKET, normalizedTranslations, type MarketProfile, type SecondaryLanguage } from '@/lib/market'
import type { Invoice, Product, ServiceBoardSetting } from '@/payload-types'
import { getShopSettings, marketContextFromSettings } from './settings'

function relationshipId(value: string | Product | null | undefined): string | undefined {
  if (!value) return undefined
  return typeof value === 'string' ? value : value.id
}

function isProduct(value: string | Product | null | undefined): value is Product {
  return Boolean(value) && typeof value !== 'string'
}

function toProductSummary(product: Product): ProductSummary {
  return {
    active: product.active,
    id: product.id,
    nameArabic: product.nameArabic,
    nameBangla: product.nameBangla,
    nameEnglish: product.nameEnglish,
    translations: normalizedTranslations(product.translations, {
      ar: product.nameArabic,
      bn: product.nameBangla,
    }),
    priceIncludesVat: product.priceIncludesVat,
    priceMinor: product.priceMinor,
    sku: product.sku,
    vatCategory: product.vatCategory,
  }
}

export async function getServiceBoardSettings(): Promise<ServiceBoardSetting> {
  const payload = await getPayload({ config })
  return payload.findGlobal({ slug: 'service-board-settings', depth: 1 })
}

export async function getServiceBoardColumnProducts(): Promise<ProductSummary[]> {
  const settings = await getServiceBoardSettings()
  const seen = new Set<string>()

  return (settings.columns || []).flatMap(({ product }) => {
    if (!isProduct(product) || !product.active || seen.has(product.id)) return []
    seen.add(product.id)
    return [toProductSummary(product)]
  })
}

async function getColumnIds(): Promise<string[]> {
  const settings = await getServiceBoardSettings()
  const seen = new Set<string>()

  return (settings.columns || []).flatMap(({ product }) => {
    const id = relationshipId(product)
    if (!id || seen.has(id)) return []
    seen.add(id)
    return [id]
  })
}

async function saveColumnIds(productIds: string[]): Promise<void> {
  const payload = await getPayload({ config })
  await payload.updateGlobal({
    slug: 'service-board-settings',
    data: { columns: productIds.map((product) => ({ product })) },
  })
}

export async function addServiceBoardColumn(productId: string): Promise<void> {
  const payload = await getPayload({ config })
  const product = await payload.findByID({ collection: 'products', id: productId })
  if (!product.active) throw new Error('Only active products can be added to Service Board.')

  const ids = await getColumnIds()
  if (ids.includes(productId)) return
  await saveColumnIds([...ids, productId])
}

export async function removeServiceBoardColumn(productId: string): Promise<void> {
  const ids = await getColumnIds()
  await saveColumnIds(ids.filter((id) => id !== productId))
}

export async function moveServiceBoardColumn(
  productId: string,
  direction: 'left' | 'right',
): Promise<void> {
  const ids = await getColumnIds()
  const index = ids.indexOf(productId)
  if (index === -1) throw new Error('Service Board column was not found.')

  const nextIndex = direction === 'left' ? index - 1 : index + 1
  if (nextIndex < 0 || nextIndex >= ids.length) return

  const next = [...ids]
  ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
  await saveColumnIds(next)
}

function findMatchingProduct(
  item: Invoice['items'][number],
  products: ProductSummary[],
  productsById: Map<string, ProductSummary>,
): ProductSummary | undefined {
  const productId = relationshipId(item.product)
  if (productId) return productsById.get(productId)

  return products.find(
    (product) =>
      product.nameEnglish === item.descriptionEnglish &&
      (!product.nameArabic || product.nameArabic === item.descriptionArabic),
  )
}

export function buildServiceBoardView(
  products: ProductSummary[],
  invoices: Invoice[],
  market: MarketProfile = DEFAULT_MARKET,
  secondaryLanguage: SecondaryLanguage = market.defaultSecondaryLanguage,
): ServiceBoardView {
  const productsById = new Map(products.map((product) => [product.id, product]))
  const cardsByProduct = new Map<string, ServiceBoardCard[]>(
    products.map((product) => [product.id, []]),
  )
  const popularity = new Map<string, { quantityMilliunits: number; revenueMinor: number }>()
  const visits = new Set<string>()
  let visibleServiceRevenueMinor = 0

  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const product = findMatchingProduct(item, products, productsById)
      if (!product) continue

      cardsByProduct.get(product.id)!.push({
        customerName: invoice.serviceBoardDetails?.customerName || invoice.buyer?.name || undefined,
        customerPhone: invoice.serviceBoardDetails?.customerPhone || undefined,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        issuedAt: invoice.issuedAt,
        note: invoice.serviceBoardDetails?.note || undefined,
        productId: product.id,
        quantityMilliunits: item.quantityMilliunits,
        totalMinor: item.totalMinor,
        unitPriceMinor: item.unitPriceMinor,
      })
      visits.add(invoice.id)
      visibleServiceRevenueMinor += item.totalMinor
      const current = popularity.get(product.id) || {
        quantityMilliunits: 0,
        revenueMinor: 0,
      }
      current.quantityMilliunits += item.quantityMilliunits
      current.revenueMinor += item.totalMinor
      popularity.set(product.id, current)
    }
  }

  const popularProduct = [...products]
    .filter((product) => popularity.has(product.id))
    .sort((a, b) => {
      const aMetric = popularity.get(a.id)!
      const bMetric = popularity.get(b.id)!
      return (
        bMetric.quantityMilliunits - aMetric.quantityMilliunits ||
        bMetric.revenueMinor - aMetric.revenueMinor ||
        a.nameEnglish.localeCompare(b.nameEnglish)
      )
    })[0]

  return {
    columns: products.map((product) => {
      const metric = popularity.get(product.id)
      return {
        cards: cardsByProduct.get(product.id)!,
        product,
        summary: {
          todayQuantityMilliunits: metric?.quantityMilliunits || 0,
          todayRevenueMinor: metric?.revenueMinor || 0,
        },
      }
    }),
    market,
    secondaryLanguage,
    summary: {
      allSalesTodayMinor: invoices.reduce((total, invoice) => total + invoice.totalMinor, 0),
      distinctVisits: visits.size,
      mostPopularService: popularProduct
        ? {
            nameArabic: popularProduct.nameArabic || undefined,
            nameBangla: popularProduct.nameBangla || undefined,
            nameEnglish: popularProduct.nameEnglish,
            productId: popularProduct.id,
            quantityMilliunits: popularity.get(popularProduct.id)!.quantityMilliunits,
          }
        : undefined,
      visibleServiceRevenueMinor,
    },
  }
}

export async function getServiceBoardView(now = new Date()): Promise<ServiceBoardView> {
  const payload = await getPayload({ config })
  const settings = await getShopSettings()
  const market = marketContextFromSettings(settings)
  const { nextDayStart, todayStart } = getPeriodBounds(market.profile, now)
  const [products, result] = await Promise.all([
    getServiceBoardColumnProducts(),
    payload.find({
      collection: 'invoices',
      depth: 0,
      pagination: false,
      sort: '-issuedAt',
      where: {
        and: [
          { issuedAt: { greater_than_equal: todayStart.toISOString() } },
          { issuedAt: { less_than: nextDayStart.toISOString() } },
        ],
      },
    }),
  ])

  return buildServiceBoardView(products, result.docs, market.profile, market.secondaryLanguage)
}
