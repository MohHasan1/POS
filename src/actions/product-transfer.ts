'use server'

import { revalidatePath } from 'next/cache'

import { parseProductsCsv, ProductCsvError } from '@/lib/product-csv'
import { importProducts, type ProductImportResult } from '@/services/product-transfer'

type ProductImportActionResult =
  | { ok: true; data: ProductImportResult }
  | { ok: false; error: string }

const maximumCsvBytes = 750_000

export async function importProductsAction(csv: string): Promise<ProductImportActionResult> {
  if (new TextEncoder().encode(csv).byteLength > maximumCsvBytes) {
    return { ok: false, error: 'The CSV file must be 750 KB or smaller.' }
  }

  try {
    const rows = parseProductsCsv(csv)
    const result = await importProducts(rows)
    revalidatePath('/products')
    revalidatePath('/checkout')
    return { ok: true, data: result }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ProductCsvError ? error.message : 'Products could not be imported.',
    }
  }
}
