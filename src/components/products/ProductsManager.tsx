'use client'

import { Languages, Pencil, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type SubmitEvent, useState, useTransition } from 'react'

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
import {
  ProductTranslationError,
  shouldAutoTranslateProductName,
  translateEnglishProductName,
} from '@/services/browser-translator'

type ProductFormProps = {
  dictionary: Dictionary
  onDone: () => void
  product: ProductSummary | null
}

function ProductForm({ dictionary, onDone, product }: ProductFormProps) {
  const router = useRouter()
  const [nameEnglish, setNameEnglish] = useState(product?.nameEnglish ?? '')
  const [nameBangla, setNameBangla] = useState(product?.nameBangla ?? '')
  const [nameArabic, setNameArabic] = useState(product?.nameArabic ?? '')
  const [includesVat, setIncludesVat] = useState(product?.priceIncludesVat ?? true)
  const [error, setError] = useState('')
  const [translationMessage, setTranslationMessage] = useState('')
  const [translationPending, setTranslationPending] = useState(false)
  const [pending, startTransition] = useTransition()

  function translationErrorMessage(translationError: unknown) {
    return translationError instanceof ProductTranslationError &&
      translationError.code === 'unavailable'
      ? dictionary.translationUnavailableMessage
      : dictionary.translationFailed
  }

  async function translateMissingNames(requireBangla: boolean): Promise<{
    translatedArabic: string
    translatedBangla: string
  } | null> {
    let translatedArabic = nameArabic.trim()
    let translatedBangla = nameBangla.trim()

    if (!nameEnglish.trim()) {
      setError(dictionary.translationEmptyEnglish)
      return null
    }

    if (
      !shouldAutoTranslateProductName(translatedArabic) &&
      !shouldAutoTranslateProductName(translatedBangla)
    ) {
      return { translatedArabic, translatedBangla }
    }

    setTranslationMessage('')
    setTranslationPending(true)

    try {
      if (shouldAutoTranslateProductName(translatedArabic)) {
        setTranslationMessage(dictionary.translatingArabic)
        try {
          translatedArabic = await translateEnglishProductName(nameEnglish, 'ar', (loaded) => {
            setTranslationMessage(
              `${dictionary.translatingArabic} ${Math.round(loaded * 100)}%`,
            )
          })
          setNameArabic(translatedArabic)
        } catch (translationError) {
          setError(translationErrorMessage(translationError))
          return null
        }
      }

      if (shouldAutoTranslateProductName(translatedBangla)) {
        setTranslationMessage(dictionary.translatingBangla)
        try {
          translatedBangla = await translateEnglishProductName(nameEnglish, 'bn', (loaded) => {
            setTranslationMessage(
              `${dictionary.translatingBangla} ${Math.round(loaded * 100)}%`,
            )
          })
          setNameBangla(translatedBangla)
        } catch (translationError) {
          if (requireBangla) {
            setError(translationErrorMessage(translationError))
            return null
          }
          translatedBangla = ''
        }
      }

      return { translatedArabic, translatedBangla }
    } finally {
      setTranslationPending(false)
      setTranslationMessage('')
    }
  }

  async function autoTranslate() {
    setError('')
    await translateMissingNames(true)
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError('')

    const priceMinor = decimalToMinor(String(formData.get('price') || ''))
    if (priceMinor === null) {
      setError('Enter a valid price with up to two decimal places.')
      return
    }

    const translatedNames = await translateMissingNames(false)
    if (!translatedNames) return

    const input = {
      nameEnglish,
      nameBangla: translatedNames.translatedBangla,
      nameArabic: translatedNames.translatedArabic,
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
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="nameEnglish">{dictionary.nameEnglish}</Label>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={pending || translationPending}
              onClick={autoTranslate}
            >
              <Languages aria-hidden="true" />
              {dictionary.autoTranslate}
            </Button>
          </div>
          <Input
            id="nameEnglish"
            name="nameEnglish"
            disabled={translationPending}
            onChange={(event) => setNameEnglish(event.target.value)}
            value={nameEnglish}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nameBangla">{dictionary.nameBangla}</Label>
          <Input
            id="nameBangla"
            name="nameBangla"
            disabled={translationPending}
            onChange={(event) => setNameBangla(event.target.value)}
            value={nameBangla}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nameArabic">{dictionary.nameArabic}</Label>
          <Input
            id="nameArabic"
            name="nameArabic"
            dir="rtl"
            disabled={translationPending}
            onChange={(event) => setNameArabic(event.target.value)}
            value={nameArabic}
          />
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
      {translationMessage && (
        <p className="text-sm text-muted-foreground" role="status">
          {translationMessage}
        </p>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <DialogFooter className="mx-0 mb-0 px-0 pb-0">
        <Button type="button" variant="outline" onClick={onDone}>{dictionary.cancel}</Button>
        <Button type="submit" disabled={pending || translationPending}>
          {pending ? dictionary.saving : dictionary.save}
        </Button>
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
