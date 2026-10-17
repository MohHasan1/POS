import config from '@payload-config'
import { getPayload } from 'payload'

import type { Product } from '@/payload-types'

export type ProductInput = Pick<
  Product,
  | 'nameArabic'
  | 'nameBangla'
  | 'nameEnglish'
  | 'priceIncludesVat'
  | 'priceMinor'
  | 'sku'
  | 'vatCategory'
>

export async function getProducts(includeInactive = false): Promise<Product[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'products',
    pagination: false,
    sort: 'nameEnglish',
    where: includeInactive ? undefined : { active: { equals: true } },
  })

  return result.docs
}

export async function createProduct(data: ProductInput): Promise<Product> {
  const payload = await getPayload({ config })
  return payload.create({
    collection: 'products',
    data: { ...data, active: true },
  })
}

export async function updateProduct(id: string, data: ProductInput): Promise<Product> {
  const payload = await getPayload({ config })
  return payload.update({ collection: 'products', id, data })
}

export async function setProductActive(id: string, active: boolean): Promise<Product> {
  const payload = await getPayload({ config })
  return payload.update({ collection: 'products', id, data: { active } })
}
