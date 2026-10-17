import { serializeProductsCsv } from '@/lib/product-csv'
import { getProducts } from '@/services/products'

export const dynamic = 'force-dynamic'

export async function GET() {
  const products = await getProducts(true)
  const csv = serializeProductsCsv(products)

  return new Response(csv, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': 'attachment; filename="products.csv"',
      'Content-Type': 'text/csv; charset=utf-8',
    },
  })
}
