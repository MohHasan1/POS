import { serializeProductsCsv } from '@/lib/product-csv'
import { readPosAccess } from '@/lib/require-pos-access'
import { getProducts } from '@/services/products'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await readPosAccess()).unlocked) {
    return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
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
