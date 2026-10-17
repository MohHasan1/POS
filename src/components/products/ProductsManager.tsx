'use client'

import { Pencil, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useState, useTransition } from 'react'

import {
  createProductAction,
  setProductActiveAction,
  updateProductAction,
} from '@/actions/products'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Dictionary } from '@/lib/localization'
import { decimalToMinor, formatSAR, minorToDecimal } from '@/lib/money'
import type { ProductSummary } from '@/lib/pos-types'

type ProductFormProps = {
  dictionary: Dictionary
  onDone: () => void
  product: ProductSummary | null
}

function ProductForm({ dictionary, onDone, product }: ProductFormProps) {
  const router = useRouter()
  const [includesVat, setIncludesVat] = useState(product?.priceIncludesVat ?? true)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const priceMinor = decimalToMinor(String(formData.get('price') || ''))
    if (priceMinor === null) {
      setError('Enter a valid price with up to two decimal places.')
      return
    }

    const input = {
      nameEnglish: String(formData.get('nameEnglish') || ''),
      nameBangla: String(formData.get('nameBangla') || ''),
      nameArabic: String(formData.get('nameArabic') || ''),
      sku: String(formData.get('sku') || ''),
      priceMinor,
      vatCategory: String(formData.get('vatCategory')) as ProductSummary['vatCategory'],
      priceIncludesVat: includesVat,
    }

    startTransition(async () => {
      const result = product
        ? await updateProductAction(product.id, input)
        : await createProductAction(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
      onDone()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nameEnglish">{dictionary.nameEnglish}</Label>
          <Input id="nameEnglish" name="nameEnglish" defaultValue={product?.nameEnglish} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nameBangla">{dictionary.nameBangla}</Label>
          <Input id="nameBangla" name="nameBangla" defaultValue={product?.nameBangla || ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nameArabic">{dictionary.nameArabic}</Label>
          <Input id="nameArabic" name="nameArabic" dir="rtl" defaultValue={product?.nameArabic} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sku">{dictionary.sku}</Label>
          <Input id="sku" name="sku" defaultValue={product?.sku || ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">{dictionary.price} (SAR)</Label>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={product ? minorToDecimal(product.priceMinor) : ''}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vatCategory">{dictionary.vatCategory}</Label>
          <select
            id="vatCategory"
            name="vatCategory"
            defaultValue={product?.vatCategory || 'standard'}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="standard">{dictionary.standardRated}</option>
            <option value="zero">{dictionary.zeroRated}</option>
            <option value="exempt">{dictionary.exempt}</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={includesVat} onCheckedChange={setIncludesVat} />
        {dictionary.priceIncludesVat}
      </label>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <DialogFooter className="mx-0 mb-0 px-0 pb-0">
        <Button type="button" variant="outline" onClick={onDone}>{dictionary.cancel}</Button>
        <Button type="submit" disabled={pending}>{pending ? dictionary.saving : dictionary.save}</Button>
      </DialogFooter>
    </form>
  )
}

export function ProductsManager({
  dictionary,
  products,
}: {
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
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" aria-hidden="true" />
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
      {actionError && <p className="border-b p-3 text-sm text-destructive" role="alert">{actionError}</p>}
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
                {product.nameBangla && <span className="block text-xs text-muted-foreground">{product.nameBangla}</span>}
              </TableCell>
              <TableCell dir="rtl">{product.nameArabic}</TableCell>
              <TableCell>{product.sku || '—'}</TableCell>
              <TableCell>{formatSAR(product.priceMinor)}</TableCell>
              <TableCell>{product.vatCategory === 'standard' ? '15%' : product.vatCategory === 'zero' ? '0%' : dictionary.exempt}</TableCell>
              <TableCell><Badge variant={product.active ? 'secondary' : 'outline'}>{product.active ? dictionary.active : dictionary.inactive}</Badge></TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openForm(product)}>
                    <Pencil aria-hidden="true" />{dictionary.edit}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => toggleActive(product)}>
                    {product.active ? dictionary.deactivate : dictionary.activate}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">{dictionary.noProducts}</TableCell></TableRow>
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
            dictionary={dictionary}
            product={editing}
            onDone={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  )
}
