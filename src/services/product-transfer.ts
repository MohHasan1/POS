import config from '@payload-config'
import { getPayload } from 'payload'

import type { ProductCsvRow } from '@/lib/product-csv'

export type ProductImportResult = {
  created: number
  updated: number
}

export async function importProducts(rows: readonly ProductCsvRow[]): Promise<ProductImportResult> {
  const payload = await getPayload({ config })
  const existingProducts = await payload.find({
    collection: 'products',
    pagination: false,
  })
  const productsBySku = new Map(
    existingProducts.docs
      .filter((product) => product.sku)
      .map((product) => [product.sku!, product]),
  )
  const transactionID = await payload.db.beginTransaction()
  const req = transactionID === null ? undefined : { payload, transactionID }
  let created = 0
  let updated = 0

  try {
    for (const row of rows) {
      const existingProduct = row.sku ? productsBySku.get(row.sku) : undefined

      if (existingProduct) {
        await payload.update({
          collection: 'products',
          id: existingProduct.id,
          data: row,
          req,
        })
        updated += 1
      } else {
        await payload.create({
          collection: 'products',
          data: row,
          req,
        })
        created += 1
      }
    }

    if (transactionID !== null) await payload.db.commitTransaction(transactionID)
    return { created, updated }
  } catch (error) {
    if (transactionID !== null) {
      await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    }
    throw error
  }
}
