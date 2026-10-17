import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ProductImportExport } from '@/components/products/ProductImportExport'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/localization'

export const metadata: Metadata = { title: 'Import / Export Products' }

export default async function ProductImportExportPage() {
  const { dictionary } = await getDictionary()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dictionary.importExportProducts}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dictionary.importExportProductsDescription}
          </p>
        </div>
        <Link href="/products" className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeft aria-hidden="true" />
          {dictionary.backToProducts}
        </Link>
      </header>
      <ProductImportExport dictionary={dictionary} />
    </div>
  )
}
