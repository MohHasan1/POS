import type { Metadata } from 'next'

import { ProductsManager } from '@/components/products/ProductsManager'
import { getDictionary } from '@/lib/localization'
import { getProducts } from '@/services/products'

export const metadata: Metadata = { title: 'Products' }

export default async function ProductsPage() {
  const [{ dictionary }, products] = await Promise.all([getDictionary(), getProducts(true)])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.products}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.productDescription}</p>
      </header>
      <ProductsManager dictionary={dictionary} products={products} />
    </div>
  )
}
