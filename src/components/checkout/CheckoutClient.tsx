'use client'

import { Languages, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type SubmitEvent, useState, useTransition } from 'react'

import { finalizeInvoiceAction } from '@/actions/checkout'
import { createProductAction } from '@/actions/products'
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
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary, Locale } from '@/lib/localization'
import { decimalToMinor, formatSAR, minorToDecimal } from '@/lib/money'
import type { BuyerInput, ProductSummary } from '@/lib/pos-types'
import { calculateInvoiceTotals, calculateLine } from '@/lib/vat'
import {
  ProductTranslationError,
  shouldAutoTranslateProductName,
  translateEnglishProductName,
} from '@/services/browser-translator'

type CartItem = {
  key: string
  productId?: string
  descriptionEnglish: string
  descriptionBangla?: string
  descriptionArabic: string
  unitPriceMinor: number
  quantityMilliunits: number
  vatCategory: ProductSummary['vatCategory']
  priceIncludesVat: boolean
}

function itemName(item: CartItem, locale: Locale) {
  return locale === 'bn' && item.descriptionBangla
    ? item.descriptionBangla
    : item.descriptionEnglish
}

function CustomItemDialog({
  defaultPriceIncludesVat,
  dictionary,
  onAdd,
}: {
  defaultPriceIncludesVat: boolean
  dictionary: Dictionary
  onAdd: (item: CartItem) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nameEnglish, setNameEnglish] = useState('')
  const [nameBangla, setNameBangla] = useState('')
  const [nameArabic, setNameArabic] = useState('')
  const [includesVat, setIncludesVat] = useState(defaultPriceIncludesVat)
  const [saveToCatalog, setSaveToCatalog] = useState(true)
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
            setTranslationMessage(`${dictionary.translatingArabic} ${Math.round(loaded * 100)}%`)
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
            setTranslationMessage(`${dictionary.translatingBangla} ${Math.round(loaded * 100)}%`)
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
    const quantity = Number(formData.get('quantity'))
    if (priceMinor === null || !Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a valid price and quantity.')
      return
    }

    const translatedNames = await translateMissingNames(false)
    if (!translatedNames) return

    const base = {
      descriptionEnglish: nameEnglish.trim(),
      descriptionBangla: translatedNames.translatedBangla || undefined,
      descriptionArabic: translatedNames.translatedArabic,
      unitPriceMinor: priceMinor,
      quantityMilliunits: Math.round(quantity * 1000),
      vatCategory: String(formData.get('vatCategory')) as ProductSummary['vatCategory'],
      priceIncludesVat: includesVat,
    }

    startTransition(async () => {
      if (saveToCatalog) {
        const result = await createProductAction({
          nameEnglish: base.descriptionEnglish,
          nameBangla: base.descriptionBangla || '',
          nameArabic: base.descriptionArabic,
          sku: String(formData.get('sku') || ''),
          priceMinor: base.unitPriceMinor,
          vatCategory: base.vatCategory,
          priceIncludesVat: base.priceIncludesVat,
        })
        if (!result.ok || !result.data) {
          setError(result.ok ? 'Unable to save the product.' : result.error)
          return
        }
        onAdd({ ...base, key: `product:${result.data.id}`, productId: result.data.id })
        router.refresh()
      } else {
        onAdd({ ...base, key: `custom:${crypto.randomUUID()}` })
      }
      setNameEnglish('')
      setNameBangla('')
      setNameArabic('')
      setIncludesVat(defaultPriceIncludesVat)
      setSaveToCatalog(true)
      setOpen(false)
      setError('')
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {dictionary.addCustomProduct}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{dictionary.addCustomProduct}</DialogTitle>
            <DialogDescription>{dictionary.customItemNote}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="custom-name-en">{dictionary.nameEnglish}</Label>
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
                  id="custom-name-en"
                  name="nameEnglish"
                  disabled={translationPending}
                  onChange={(event) => setNameEnglish(event.target.value)}
                  value={nameEnglish}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-name-bn">{dictionary.nameBangla}</Label>
                <Input
                  id="custom-name-bn"
                  name="nameBangla"
                  disabled={translationPending}
                  onChange={(event) => setNameBangla(event.target.value)}
                  value={nameBangla}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-name-ar">{dictionary.nameArabic}</Label>
                <Input
                  id="custom-name-ar"
                  name="nameArabic"
                  dir="rtl"
                  disabled={translationPending}
                  onChange={(event) => setNameArabic(event.target.value)}
                  value={nameArabic}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-sku">{dictionary.sku}</Label>
                <Input id="custom-sku" name="sku" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-price">{dictionary.price} (SAR)</Label>
                <Input id="custom-price" name="price" inputMode="decimal" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-quantity">{dictionary.quantity}</Label>
                <Input
                  id="custom-quantity"
                  name="quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  defaultValue="1"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-vat">{dictionary.vatCategory}</Label>
                <select
                  id="custom-vat"
                  name="vatCategory"
                  defaultValue="standard"
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
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
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={saveToCatalog} onCheckedChange={setSaveToCatalog} />
              {dictionary.saveToCatalog}
            </label>
            {translationMessage && (
              <p className="text-sm text-muted-foreground" role="status">
                {translationMessage}
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <DialogFooter className="mx-0 mb-0 px-0 pb-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {dictionary.cancel}
              </Button>
              <Button type="submit" disabled={pending || translationPending}>
                {pending ? dictionary.saving : dictionary.addCustomProduct}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CheckoutClient({
  defaultPriceIncludesVat,
  dictionary,
  locale,
  products,
  settingsReady,
}: {
  defaultPriceIncludesVat: boolean
  dictionary: Dictionary
  locale: Locale
  products: ProductSummary[]
  settingsReady: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [invoiceType, setInvoiceType] = useState<'simplified' | 'standard'>('simplified')
  const [buyer, setBuyer] = useState<BuyerInput>({})
  const [error, setError] = useState('')
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [pending, startTransition] = useTransition()

  const query = search.trim().toLocaleLowerCase()
  const filtered = products.filter((product) =>
    [product.nameEnglish, product.nameBangla, product.nameArabic, product.sku]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(query)),
  )
  const calculated = cart.map((item) => calculateLine(item))
  const totals = calculateInvoiceTotals(calculated)

  function addProduct(product: ProductSummary) {
    const key = `product:${product.id}`
    setCart((current) => {
      const existing = current.find((item) => item.key === key)
      if (existing) {
        return current.map((item) =>
          item.key === key ? { ...item, quantityMilliunits: item.quantityMilliunits + 1000 } : item,
        )
      }
      return [
        ...current,
        {
          key,
          productId: product.id,
          descriptionEnglish: product.nameEnglish,
          descriptionBangla: product.nameBangla || undefined,
          descriptionArabic: product.nameArabic,
          unitPriceMinor: product.priceMinor,
          quantityMilliunits: 1000,
          vatCategory: product.vatCategory,
          priceIncludesVat: product.priceIncludesVat,
        },
      ]
    })
  }

  function addCustom(item: CartItem) {
    setCart((current) => [...current, item])
  }

  function updateItem(key: string, changes: Partial<CartItem>) {
    setCart((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)))
  }

  function updateQuantity(key: string, delta: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.key === key
            ? { ...item, quantityMilliunits: item.quantityMilliunits + delta }
            : item,
        )
        .filter((item) => item.quantityMilliunits > 0),
    )
  }

  function finalize() {
    setError('')
    startTransition(async () => {
      const result = await finalizeInvoiceAction({
        idempotencyKey,
        invoiceType,
        buyer: invoiceType === 'standard' ? buyer : undefined,
        items: cart.map((item) => ({
          productId: item.productId,
          descriptionEnglish: item.productId ? undefined : item.descriptionEnglish,
          descriptionBangla: item.productId ? undefined : item.descriptionBangla,
          descriptionArabic: item.productId ? undefined : item.descriptionArabic,
          unitPriceMinor: item.unitPriceMinor,
          quantityMilliunits: item.quantityMilliunits,
          vatCategory: item.productId ? undefined : item.vatCategory,
          priceIncludesVat: item.productId ? undefined : item.priceIncludesVat,
        })),
      })
      if (!result.ok || !result.data) {
        setError(result.ok ? 'Unable to open the saved invoice.' : result.error)
        return
      }
      router.push(`/invoices/${result.data.id}`)
    })
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-lg border bg-background">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-8"
              type="search"
              placeholder={dictionary.searchProducts}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <CustomItemDialog
            defaultPriceIncludesVat={defaultPriceIncludesVat}
            dictionary={dictionary}
            onAdd={addCustom}
          />
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product)}
              className="flex min-h-24 flex-col justify-between bg-background p-3 text-left hover:bg-muted focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span>
                <span className="block text-sm font-medium">
                  {locale === 'bn' && product.nameBangla ? product.nameBangla : product.nameEnglish}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground" dir="rtl">
                  {product.nameArabic}
                </span>
              </span>
              <span className="mt-3 flex items-end justify-between gap-2">
                <span className="font-medium tabular-nums">{formatSAR(product.priceMinor)}</span>
                <Badge variant="outline">
                  {product.vatCategory === 'standard'
                    ? '15%'
                    : product.vatCategory === 'zero'
                      ? '0%'
                      : dictionary.exempt}
                </Badge>
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full bg-background p-8 text-center text-sm text-muted-foreground">
              {dictionary.noProducts}
            </p>
          )}
        </div>
      </section>

      <aside className="rounded-lg border bg-background lg:sticky lg:top-20">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="flex items-center gap-2 font-medium">
            <ShoppingCart className="size-4" aria-hidden="true" />
            {dictionary.cart}
          </h2>
          <Button
            size="sm"
            variant="ghost"
            disabled={cart.length === 0}
            onClick={() => setCart([])}
          >
            {dictionary.clearCart}
          </Button>
        </div>
        <div className="max-h-[42vh] divide-y overflow-y-auto">
          {cart.map((item, index) => {
            const line = calculated[index]
            return (
              <div key={item.key} className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{itemName(item, locale)}</p>
                    <p className="text-xs text-muted-foreground" dir="rtl">
                      {item.descriptionArabic}
                    </p>
                  </div>
                  <Button
                    aria-label={dictionary.remove}
                    size="icon-sm"
                    variant="ghost"
                    onClick={() =>
                      setCart((current) =>
                        current.filter((currentItem) => currentItem.key !== item.key),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                  <div>
                    <Label className="text-xs" htmlFor={`price-${item.key}`}>
                      {dictionary.price} (SAR)
                    </Label>
                    <Input
                      key={`${item.key}-${item.unitPriceMinor}`}
                      id={`price-${item.key}`}
                      className="mt-1"
                      defaultValue={minorToDecimal(item.unitPriceMinor)}
                      inputMode="decimal"
                      onBlur={(event) => {
                        const minor = decimalToMinor(event.target.value)
                        if (minor !== null) updateItem(item.key, { unitPriceMinor: minor })
                        else event.target.value = minorToDecimal(item.unitPriceMinor)
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      aria-label="Decrease quantity"
                      size="icon-sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.key, -1000)}
                    >
                      <Minus />
                    </Button>
                    <Input
                      aria-label={dictionary.quantity}
                      className="w-16 text-center"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={item.quantityMilliunits / 1000}
                      onChange={(event) => {
                        const value = Math.round(Number(event.target.value) * 1000)
                        if (value > 0) updateItem(item.key, { quantityMilliunits: value })
                      }}
                    />
                    <Button
                      aria-label="Increase quantity"
                      size="icon-sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.key, 1000)}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
                <p className="text-right text-sm font-medium tabular-nums">
                  {formatSAR(line.totalMinor)}
                </p>
              </div>
            )
          })}
          {cart.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">{dictionary.emptyCart}</p>
          )}
        </div>

        <div className="space-y-3 border-t p-3">
          <div className="space-y-1 text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{dictionary.subtotal}</span>
              <span>{formatSAR(totals.subtotalMinor)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{dictionary.vat}</span>
              <span>{formatSAR(totals.vatMinor)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>{dictionary.total}</span>
              <span>{formatSAR(totals.totalMinor)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoiceType">{dictionary.invoiceType}</Label>
            <select
              id="invoiceType"
              value={invoiceType}
              onChange={(event) => setInvoiceType(event.target.value as typeof invoiceType)}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            >
              <option value="simplified">{dictionary.simplifiedInvoice}</option>
              <option value="standard">{dictionary.standardInvoice}</option>
            </select>
          </div>

          {invoiceType === 'standard' && (
            <div className="grid gap-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Input
                placeholder={dictionary.buyerName}
                value={buyer.name || ''}
                onChange={(event) => setBuyer({ ...buyer, name: event.target.value })}
              />
              <Input
                placeholder={dictionary.buyerVat}
                inputMode="numeric"
                value={buyer.vatNumber || ''}
                onChange={(event) => setBuyer({ ...buyer, vatNumber: event.target.value })}
              />
              <Textarea
                className="sm:col-span-2 lg:col-span-1 xl:col-span-2"
                placeholder={dictionary.buyerAddress}
                rows={2}
                value={buyer.address || ''}
                onChange={(event) => setBuyer({ ...buyer, address: event.target.value })}
              />
              <Input
                className="sm:col-span-2 lg:col-span-1 xl:col-span-2"
                placeholder={dictionary.buyerIdentification}
                value={buyer.identification || ''}
                onChange={(event) => setBuyer({ ...buyer, identification: event.target.value })}
              />
            </div>
          )}

          {!settingsReady && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              Complete{' '}
              <Link href="/settings" className="font-medium underline">
                {dictionary.shopSettings}
              </Link>{' '}
              before finalizing.
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            className="h-10 w-full"
            disabled={!settingsReady || cart.length === 0 || pending}
            onClick={finalize}
          >
            {pending ? dictionary.finalizing : dictionary.finalizeSale}
          </Button>
        </div>
      </aside>
    </div>
  )
}
