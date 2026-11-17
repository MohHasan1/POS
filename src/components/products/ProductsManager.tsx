'use client'

import { Pencil, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { setProductActiveAction } from '@/actions/products'
import { ProductForm } from '@/components/products/ProductForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Dictionary } from '@/lib/localization'
import { formatSAR } from '@/lib/money'
import type { ProductSummary } from '@/lib/pos-types'

export function ProductsManager({
  defaultPriceIncludesVat,
  dictionary,
  products,
}: {
  defaultPriceIncludesVat: boolean
  dictionary: Dictionary
  products: ProductSummary[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ProductSummary | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const [pending, startTransition] = useTransition()
  const query = search.trim().toLocaleLowerCase()
  const filtered = products.filter((product) =>
    [product.nameEnglish, product.nameBangla, product.nameArabic, product.sku]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(query)),
  )

  function openForm(product: ProductSummary | null) {
    setEditing(product)
    setDialogOpen(true)
  }

  function toggleActive(product: ProductSummary) {
    setActionError('')
    startTransition(async () => {
      const result = await setProductActiveAction(product.id, !product.active)
      if (!result.ok) setActionError(result.error)
      else router.refresh()
    })
  }

  return (
    <section className="rounded-lg border bg-background">
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label={dictionary.search}
            className="pl-8"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={dictionary.searchProducts}
            type="search"
            value={search}
          />
        </div>
        <Button onClick={() => openForm(null)}>
          <Plus aria-hidden="true" />
          {dictionary.addProduct}
        </Button>
      </div>
      {actionError && (
        <p className="border-b p-3 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{dictionary.nameEnglish}</TableHead>
            <TableHead>{dictionary.nameArabic}</TableHead>
            <TableHead>{dictionary.sku}</TableHead>
            <TableHead>{dictionary.price}</TableHead>
            <TableHead>{dictionary.vatCategory}</TableHead>
            <TableHead>{dictionary.status}</TableHead>
            <TableHead className="text-right">{dictionary.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <span className="font-medium">{product.nameEnglish}</span>
                {product.nameBangla && (
                  <span className="block text-xs text-muted-foreground">{product.nameBangla}</span>
                )}
              </TableCell>
              <TableCell dir="rtl">{product.nameArabic}</TableCell>
              <TableCell>{product.sku || '—'}</TableCell>
              <TableCell>{formatSAR(product.priceMinor)}</TableCell>
              <TableCell>
                {product.vatCategory === 'standard'
                  ? '15%'
                  : product.vatCategory === 'zero'
                    ? '0%'
                    : dictionary.exempt}
              </TableCell>
              <TableCell>
                <Badge variant={product.active ? 'secondary' : 'outline'}>
                  {product.active ? dictionary.active : dictionary.inactive}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openForm(product)}>
                    <Pencil aria-hidden="true" />
                    {dictionary.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => toggleActive(product)}
                  >
                    {product.active ? dictionary.deactivate : dictionary.activate}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                {dictionary.noProducts}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? dictionary.editProduct : dictionary.addProduct}</DialogTitle>
            <DialogDescription>{dictionary.productDescription}</DialogDescription>
          </DialogHeader>
          <ProductForm
            key={editing?.id || 'new'}
            defaultPriceIncludesVat={defaultPriceIncludesVat}
            dictionary={dictionary}
            product={editing}
            onDone={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  )
}
