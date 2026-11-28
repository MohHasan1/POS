import { type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

import { allocateProductSku } from '../lib/product-sku'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const { rows } = await db.run(sql`SELECT id, sku FROM products;`)
  const used = new Set(rows.map(({ sku }) => typeof sku === 'string' ? sku : ''))

  for (const { id, sku } of rows) {
    if (typeof sku === 'string' && sku.trim()) continue
    const generated = await allocateProductSku((candidate) => used.has(candidate))
    await db.run(sql`UPDATE products SET sku = ${generated} WHERE id = ${id} AND sku IS ${sku};`)
    used.add(generated)
  }
}

export async function down(): Promise<void> {
  // Keep assigned SKUs because they may already be in use in exports or labels.
}
