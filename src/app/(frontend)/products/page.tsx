import { ArrowUpDown } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ProductsManager } from '@/components/products/ProductsManager'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/localization'
import { getProducts } from '@/services/products'
import { getShopSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Products' }

export default async function ProductsPage() {
  const [{ dictionary }, products, settings] = await Promise.all([
    getDictionary(),
    getProducts(true),
    getShopSettings(),
  ])

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.products}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dictionary.productDescription}</p>
        </div>
        <Link
          href="/products/import-export"
          className={buttonVariants({ variant: 'outline' })}
        >
          <ArrowUpDown aria-hidden="true" />
          {dictionary.importExportProducts}
        </Link>
      </header>
      <ProductsManager
        defaultPriceIncludesVat={settings.defaultPriceIncludesVat ?? false}
        dictionary={dictionary}
        products={products}
      />
    </div>
  )
}
