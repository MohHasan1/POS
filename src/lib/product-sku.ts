import { randomBytes } from 'node:crypto'

export async function allocateProductSku(isTaken: (sku: string) => boolean | Promise<boolean>) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const sku = `SKU-${randomBytes(4).toString('hex').toUpperCase()}`
    if (!(await isTaken(sku))) return sku
  }
  throw new Error('Could not generate a unique SKU. Try again.')
}
