'use client'

import {
  ChevronDown,
  ChevronUp,
  Languages,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type SubmitEvent, useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { finalizeInvoiceAction } from '@/actions/checkout'
import { recordHistoricalSaleAction } from '@/actions/historical-sales'
import { createProductAction } from '@/actions/products'
import { EmployeeSelector } from '@/components/employees/EmployeeSelector'
import { createSaleSettlementDraft, SaleSettlementPanel, saleSettlementInput } from '@/components/money/SaleSettlementPanel'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { dateInputToISOString, formatMarketDate, todayDateInput } from '@/lib/calendar'
import type { Dictionary, Locale } from '@/lib/localization'
import { localizedName, marketLocale, normalizedTranslations, type MarketProfile, type SecondaryLanguage } from '@/lib/market'
import { decimalToMinor, formatMoney, minorToDecimal } from '@/lib/money'
import {
  DEFAULT_INVOICE_ADDRESS,
  type BuyerInput,
  type EmployeeSummary,
  type ProductSummary,
} from '@/lib/pos-types'
import { calculateInvoiceTotals, calculateLine } from '@/lib/vat'
import {
  ProductTranslationError,
  shouldAutoTranslateProductName,
  translateEnglishProductName,
} from '@/services/browser-translator'
import type { MoneyPerson } from '@/payload-types'

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
  translations?: Array<{ language: string; name: string }>
}

function itemName(item: CartItem) {
  return item.descriptionEnglish
}

function itemSecondaryName(item: CartItem, language: SecondaryLanguage) {
  return localizedName(
    normalizedTranslations(item.translations, {
      ar: item.descriptionArabic,
      bn: item.descriptionBangla,
    }),
    language,
  )
}

function CustomItemDialog({
  defaultPriceIncludesVat,
  dictionary,
  market,
  secondaryLanguage,
  autoTranslateProducts,
  onAdd,
}: {
  defaultPriceIncludesVat: boolean
  dictionary: Dictionary
  market: MarketProfile
  secondaryLanguage: SecondaryLanguage
  autoTranslateProducts: boolean
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

    const targetValue = secondaryLanguage === 'ar' ? translatedArabic : translatedBangla
    if (secondaryLanguage === 'none' || !shouldAutoTranslateProductName(targetValue)) {
      return { translatedArabic, translatedBangla }
    }

    setTranslationMessage('')
    setTranslationPending(true)

    try {
      if (secondaryLanguage === 'ar' && shouldAutoTranslateProductName(translatedArabic)) {
        setTranslationMessage(dictionary.translatingArabic)
        try {
          translatedArabic = await translateEnglishProductName(nameEnglish, 'ar', (loaded) => {
            setTranslationMessage(`${dictionary.translatingArabic} ${Math.round(loaded * 100)}%`)
          })
          setNameArabic(translatedArabic)
        } catch (translationError) {
          if (requireBangla) setError(translationErrorMessage(translationError))
          return { translatedArabic, translatedBangla }
        }
      }

      if (secondaryLanguage === 'bn' && shouldAutoTranslateProductName(translatedBangla)) {
        setTranslationMessage(dictionary.translatingBangla)
        try {
          translatedBangla = await translateEnglishProductName(nameEnglish, 'bn', (loaded) => {
            setTranslationMessage(`${dictionary.translatingBangla} ${Math.round(loaded * 100)}%`)
          })
          setNameBangla(translatedBangla)
        } catch (translationError) {
          if (requireBangla) {
            setError(translationErrorMessage(translationError))
            return { translatedArabic, translatedBangla }
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

    const priceMinor = decimalToMinor(String(formData.get('price') || ''), market)
    const quantity = Number(formData.get('quantity'))
    if (priceMinor === null || !Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a valid price and quantity.')
      return
    }

    const translatedNames = autoTranslateProducts
      ? await translateMissingNames(false)
      : { translatedArabic: nameArabic.trim(), translatedBangla: nameBangla.trim() }
    if (!translatedNames) return

    const base = {
      descriptionEnglish: nameEnglish.trim(),
      descriptionBangla: translatedNames.translatedBangla || undefined,
      descriptionArabic: translatedNames.translatedArabic || nameEnglish.trim(),
      translations: [
        ...(translatedNames.translatedArabic ? [{ language: 'ar', name: translatedNames.translatedArabic }] : []),
        ...(translatedNames.translatedBangla ? [{ language: 'bn', name: translatedNames.translatedBangla }] : []),
      ],
      unitPriceMinor: priceMinor,
      quantityMilliunits: Math.round(quantity * 1000),
      vatCategory: market.taxMode === 'none' ? 'exempt' as const : String(formData.get('vatCategory')) as ProductSummary['vatCategory'],
      priceIncludesVat: market.taxMode === 'none' ? false : includesVat,
    }

    startTransition(async () => {
      if (saveToCatalog) {
        const result = await createProductAction({
          nameEnglish: base.descriptionEnglish,
          nameBangla: base.descriptionBangla || '',
          nameArabic: base.descriptionArabic,
          translations: base.translations,
          sku: String(formData.get('sku') || ''),
          priceMinor: base.unitPriceMinor,
          vatCategory: base.vatCategory,
          priceIncludesVat: base.priceIncludesVat,
        })
        if (!result.ok || !result.data) {
          setError(result.ok ? 'Unable to save the product.' : result.error)
          return
        }
        onAdd({
          ...base,
          key: `product:${result.data.id}`,
          productId: result.data.id,
          unitPriceMinor: result.data.priceMinor,
          vatCategory: result.data.vatCategory,
          priceIncludesVat: result.data.priceIncludesVat,
        })
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
                  <Label htmlFor="custom-name-en">
                    <span>
                      {dictionary.nameEnglish}{' '}
                      <span className="text-destructive" aria-hidden="true">
                        *
                      </span>
                    </span>
                  </Label>
                  {secondaryLanguage !== 'none' && <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={pending || translationPending}
                    onClick={autoTranslate}
                  >
                    <Languages aria-hidden="true" />
                    {dictionary.autoTranslate}
                  </Button>}
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
                <Label htmlFor="custom-price">
                  <span>
                    {dictionary.price} ({market.currencyCode}){' '}
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </span>
                </Label>
                <Input id="custom-price" name="price" inputMode="decimal" required />
              </div>
              {secondaryLanguage === 'ar' && <div className="space-y-1.5">
                <Label htmlFor="custom-name-ar">{dictionary.nameArabic}</Label>
                <Input
                  id="custom-name-ar"
                  name="nameArabic"
                  dir="rtl"
                  disabled={translationPending}
                  onChange={(event) => setNameArabic(event.target.value)}
                  value={nameArabic}
                />
              </div>}
              {secondaryLanguage === 'bn' && <div className="space-y-1.5">
                <Label htmlFor="custom-name-bn">{dictionary.nameBangla}</Label>
                <Input
                  id="custom-name-bn"
                  name="nameBangla"
                  disabled={translationPending}
                  onChange={(event) => setNameBangla(event.target.value)}
                  value={nameBangla}
                />
              </div>}
              <div className="space-y-1.5">
                <Label htmlFor="custom-sku">{dictionary.sku}</Label>
                <Input id="custom-sku" name="sku" />
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
              {market.taxMode === 'saudiVat' && <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="custom-vat">{dictionary.vatCategory}</Label>
                <Select name="vatCategory" defaultValue="standard">
                  <SelectTrigger id="custom-vat" className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="standard">{dictionary.standardRated}</SelectItem>
                    <SelectItem value="zero">{dictionary.zeroRated}</SelectItem>
                    <SelectItem value="exempt">{dictionary.exempt}</SelectItem>
                  </SelectContent>
                </Select>
              </div>}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={saveToCatalog} onCheckedChange={setSaveToCatalog} />
              {dictionary.saveToCatalog}
            </label>
            {!saveToCatalog && market.taxMode === 'saudiVat' && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includesVat} onCheckedChange={setIncludesVat} />
                {dictionary.priceIncludesVat}
              </label>
            )}
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
              <Button type="button" variant="cancel" onClick={() => setOpen(false)}>
                {dictionary.cancel}
              </Button>
              <Button
                type="submit"
                variant="success"
                disabled={pending || translationPending}
              >
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
  autoTranslateProducts,
  defaultSaleDate,
  defaultEmployeeId,
  defaultPriceIncludesVat,
  dictionary,
  employees,
  locale,
  market,
  people = [],
  products,
  saleMode = 'checkout',
  secondaryLanguage,
  settingsReady,
}: {
  autoTranslateProducts: boolean
  defaultSaleDate?: string
  defaultEmployeeId?: string
  defaultPriceIncludesVat: boolean
  dictionary: Dictionary
  employees: EmployeeSummary[]
  locale: Locale
  market: MarketProfile
  people?: MoneyPerson[]
  products: ProductSummary[]
  saleMode?: 'checkout' | 'historical'
  secondaryLanguage: SecondaryLanguage
  settingsReady: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [invoiceType, setInvoiceType] = useState<'sales' | 'simplified' | 'standard'>(
    market.taxMode === 'none' ? 'sales' : 'simplified',
  )
  const [buyer, setBuyer] = useState<BuyerInput>({ address: DEFAULT_INVOICE_ADDRESS })
  const [employeeId, setEmployeeId] = useState<string | null>(defaultEmployeeId || null)
  const [externalReference, setExternalReference] = useState('')
  const [saleDate, setSaleDate] = useState(defaultSaleDate || '')
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({})
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saleConfirmationOpen, setSaleConfirmationOpen] = useState(false)
  const [historicalSuccess, setHistoricalSuccess] = useState(false)
  const [cartActivity, setCartActivity] = useState<{
    id: number
    itemKey: string
  } | null>(null)
  const [highlightedItemKey, setHighlightedItemKey] = useState<string | null>(null)
  const [cartScrollState, setCartScrollState] = useState({
    hasOverflow: false,
    canScrollUp: false,
    canScrollDown: false,
  })
  const cartActivityId = useRef(0)
  const cartScrollContainer = useRef<HTMLDivElement>(null)
  const cartItemElements = useRef(new Map<string, HTMLDivElement>())
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const saleToday = todayDateInput(market)
  const [settlement, setSettlement] = useState(() => createSaleSettlementDraft(defaultSaleDate || saleToday))
  const [pending, startTransition] = useTransition()

  const query = search.trim().toLocaleLowerCase()
  const filtered = products.filter((product) =>
    [product.nameEnglish, product.nameBangla, product.nameArabic, product.sku]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(query)),
  )
  const calculated = cart.map((item) => calculateLine(item))
  const totals = calculateInvoiceTotals(calculated)
  const cartQuantityMilliunits = cart.reduce((total, item) => total + item.quantityMilliunits, 0)
  const cartQuantity = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-US', {
    maximumFractionDigits: 3,
  }).format(cartQuantityMilliunits / 1000)
  const uniqueProductCount = cart.length
  const moneyLocale = marketLocale(market, locale)
  const historical = saleMode === 'historical'
  const historicalDateLabel =
    historical && saleDate
      ? formatMarketDate(dateInputToISOString(saleDate, market), market, moneyLocale)
      : ''

  const activityId = cartActivity?.id
  const activityItemKey = cartActivity?.itemKey

  const syncCartScrollState = useCallback((element: HTMLDivElement) => {
    const hasOverflow = element.scrollHeight > element.clientHeight + 1
    const canScrollUp = hasOverflow && element.scrollTop > 1
    const canScrollDown =
      hasOverflow && element.scrollTop + element.clientHeight < element.scrollHeight - 1

    setCartScrollState((current) =>
      current.hasOverflow === hasOverflow &&
      current.canScrollUp === canScrollUp &&
      current.canScrollDown === canScrollDown
        ? current
        : { hasOverflow, canScrollUp, canScrollDown },
    )
  }, [])

  useEffect(() => {
    const element = cartScrollContainer.current
    if (!element) return

    const frame = window.requestAnimationFrame(() => syncCartScrollState(element))
    const handleResize = () => syncCartScrollState(element)
    window.addEventListener('resize', handleResize)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleResize)
    }
  }, [cart.length, syncCartScrollState])

  useEffect(() => {
    if (activityId === undefined || !activityItemKey) return

    const focusTimer = window.setTimeout(() => {
      const itemElement = cartItemElements.current.get(activityItemKey)
      if (!itemElement) return

      itemElement.focus({ preventScroll: true })
      itemElement.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      })
    }, 150)
    const highlightTimer = window.setTimeout(() => {
      setHighlightedItemKey((current) => (current === activityItemKey ? null : current))
      setCartActivity((current) => (current?.id === activityId ? null : current))
    }, 1800)

    return () => {
      window.clearTimeout(focusTimer)
      window.clearTimeout(highlightTimer)
    }
  }, [activityId, activityItemKey])

  function revealCartItem(itemKey: string) {
    cartActivityId.current += 1
    setHighlightedItemKey(itemKey)
    setCartActivity({ id: cartActivityId.current, itemKey })
  }

  function scrollCart(direction: 'up' | 'down') {
    const element = cartScrollContainer.current
    if (!element) return

    element.scrollBy({
      top: (direction === 'down' ? 1 : -1) * Math.max(140, element.clientHeight * 0.7),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  function addProduct(product: ProductSummary) {
    const key = `product:${product.id}`
    setQuantityInputs((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
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
          descriptionArabic: product.nameArabic || product.nameEnglish,
          translations: normalizedTranslations(product.translations, {
            ar: product.nameArabic,
            bn: product.nameBangla,
          }),
          unitPriceMinor: product.priceMinor,
          quantityMilliunits: 1000,
          vatCategory: market.taxMode === 'none' ? 'exempt' : product.vatCategory,
          priceIncludesVat: market.taxMode === 'none' ? false : product.priceIncludesVat,
        },
      ]
    })
    revealCartItem(key)
  }

  function addCustom(item: CartItem) {
    setCart((current) => [...current, item])
    revealCartItem(item.key)
  }

  function updateItem(key: string, changes: Partial<CartItem>) {
    setCart((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)))
  }

  function updateQuantity(key: string, delta: number) {
    setQuantityInputs((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
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

  function removeItem(key: string) {
    setCart((current) => current.filter((item) => item.key !== key))
    setPriceInputs((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    setQuantityInputs((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function updateHistoricalSaleDate(date: string) {
    setSaleDate(date)
    setSettlement((current) => ({
      ...current,
      payment: {
        ...current.payment,
        transferDate: current.payment.transferDate === saleDate ? date : current.payment.transferDate,
        chequeDate: current.payment.chequeDate === saleDate ? date : current.payment.chequeDate,
      },
    }))
  }

  function finalize() {
    const parsedSettlement = saleSettlementInput(settlement, totals.totalMinor, market, dictionary)
    if (parsedSettlement.error) {
      setError(parsedSettlement.error)
      return
    }
    setError('')
    setHistoricalSuccess(false)
    startTransition(async () => {
      const items = cart.map((item) => ({
        productId: item.productId,
        descriptionEnglish: item.productId ? undefined : item.descriptionEnglish,
        descriptionBangla: item.productId ? undefined : item.descriptionBangla,
        descriptionArabic: item.productId ? undefined : item.descriptionArabic,
        unitPriceMinor: item.unitPriceMinor,
        quantityMilliunits: item.quantityMilliunits,
        vatCategory: item.productId ? undefined : item.vatCategory,
        priceIncludesVat: item.productId ? undefined : item.priceIncludesVat,
        translations: item.productId ? undefined : item.translations,
      }))
      const result = historical
        ? await recordHistoricalSaleAction({
            employeeId,
            externalReference,
            idempotencyKey,
            items,
            saleDate,
            settlement: parsedSettlement.settlement,
          })
        : await finalizeInvoiceAction({
            employeeId,
            idempotencyKey,
            invoiceType,
            buyer: invoiceType === 'standard' ? buyer : undefined,
            items,
            settlement: parsedSettlement.settlement,
          })
      if (!result.ok || !result.data) {
        setError(result.ok ? 'Unable to open the saved invoice.' : result.error)
        return
      }
      if (historical) {
        setCart([])
        setPriceInputs({})
        setQuantityInputs({})
        setExternalReference('')
        setIdempotencyKey(crypto.randomUUID())
        setSettlement(createSaleSettlementDraft(saleDate))
        setSaleConfirmationOpen(false)
        setHistoricalSuccess(true)
        return
      }
      setSaleConfirmationOpen(false)
      router.push(`/invoices/${result.data.id}`)
    })
  }

  return (
    <>
      <div className="grid items-start gap-4 lg:h-[calc(100dvh-10rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card lg:h-full">
        <div className="border-b p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              autoTranslateProducts={autoTranslateProducts}
              defaultPriceIncludesVat={defaultPriceIncludesVat}
              dictionary={dictionary}
              market={market}
              secondaryLanguage={secondaryLanguage}
              onAdd={addCustom}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground" aria-live="polite">
            {dictionary.productsAvailable.replace('{count}', String(filtered.length))}
          </p>
        </div>
        <div className="cart-scroll-area max-h-[46vh] min-h-0 divide-y overflow-y-auto lg:max-h-none lg:flex-1">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product)}
              className="flex w-full items-center justify-between gap-4 bg-muted/35 px-3 py-2.5 text-left hover:bg-muted/70 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="grid min-w-0 flex-1 grid-cols-2 items-center gap-4">
                <span className="truncate text-base font-bold">{product.nameEnglish}</span>
                <span
                  className="truncate text-right text-base font-medium text-muted-foreground"
                  dir="rtl"
                >
                  {localizedName(normalizedTranslations(product.translations, { ar: product.nameArabic, bn: product.nameBangla }), secondaryLanguage)}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatMoney(product.priceMinor, market, moneyLocale)}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="bg-muted/35 p-8 text-center text-sm text-muted-foreground">
              {dictionary.noProducts}
            </p>
          )}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col overflow-clip rounded-lg border bg-card lg:sticky lg:top-20 lg:h-full lg:self-start">
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 border-b bg-muted p-3 lg:top-0">
          <h2 className="mr-auto flex items-center gap-2 font-medium">
            <ShoppingCart className="size-4" aria-hidden="true" />
            {dictionary.cart}
          </h2>
          <Badge
            key={cartQuantityMilliunits}
            variant="secondary"
            className="animate-in zoom-in-75 duration-200 tabular-nums"
          >
            {dictionary.cartProducts}: {cartQuantity}
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            {dictionary.uniqueProducts}: {uniqueProductCount}
          </Badge>
        </div>
        {historical ? (
          <div className="border-b bg-card p-3 text-sm font-medium">
            {dictionary.historicalPaperSale}
          </div>
        ) : market.taxMode === 'saudiVat' ? <div className="border-b bg-card p-2">
          <div
            className="grid grid-cols-2 rounded-md bg-muted p-1"
            role="radiogroup"
            aria-label={dictionary.invoiceType}
          >
            {(['simplified', 'standard'] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={invoiceType === type}
                className={`rounded-sm px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  invoiceType === type
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setInvoiceType(type)}
              >
                {type === 'simplified' ? dictionary.simplifiedInvoice : dictionary.standardInvoice}
              </button>
            ))}
          </div>
        </div> : <div className="border-b bg-card p-3 text-sm font-medium">{dictionary.salesInvoice}</div>}
        {cartScrollState.hasOverflow && (
          <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {cartScrollState.canScrollDown ? dictionary.moreItemsBelow : dictionary.endOfCart}
              {cartScrollState.canScrollDown && (
                <ChevronDown className="size-3.5 animate-bounce" aria-hidden="true" />
              )}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={!cartScrollState.canScrollUp}
                aria-label={dictionary.scrollCartUp}
                title={dictionary.scrollCartUp}
                onClick={() => scrollCart('up')}
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={!cartScrollState.canScrollDown}
                aria-label={dictionary.scrollCartDown}
                title={dictionary.scrollCartDown}
                onClick={() => scrollCart('down')}
              >
                <ChevronDown />
              </Button>
            </div>
          </div>
        )}
        <div
          ref={cartScrollContainer}
          className="cart-scroll-area min-h-0 flex-1 divide-y overflow-y-auto max-lg:max-h-[36vh]"
          onScroll={(event) => syncCartScrollState(event.currentTarget)}
        >
          {cart.map((item, index) => {
            const line = calculated[index]
            return (
              <div
                key={item.key}
                ref={(element) => {
                  if (element) cartItemElements.current.set(item.key, element)
                  else cartItemElements.current.delete(item.key)
                }}
                tabIndex={-1}
                className={`space-y-2 p-3 outline-none transition-colors duration-500 ${
                  highlightedItemKey === item.key
                    ? 'bg-emerald-100 ring-2 ring-inset ring-emerald-500 dark:bg-emerald-950'
                    : 'bg-emerald-50/70 dark:bg-emerald-950/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="grid min-w-0 flex-1 grid-cols-2 items-start gap-3">
                    <p className="text-sm font-bold">{itemName(item)}</p>
                    <p className="text-right text-sm text-muted-foreground" dir={secondaryLanguage === 'ar' ? 'rtl' : undefined}>
                      {itemSecondaryName(item, secondaryLanguage)}
                    </p>
                  </div>
                  <Button
                    aria-label={dictionary.remove}
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                    onClick={() => removeItem(item.key)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                  <div>
                    <Label className="text-xs" htmlFor={`price-${item.key}`}>
                      {dictionary.price} ({market.currencyCode})
                    </Label>
                    <Input
                      id={`price-${item.key}`}
                      className="mt-1"
                      inputMode="decimal"
                      value={priceInputs[item.key] ?? minorToDecimal(item.unitPriceMinor, market)}
                      onChange={(event) => {
                        const value = event.target.value
                        setPriceInputs((current) => ({ ...current, [item.key]: value }))
                        const parseable = /^\d+\.$/.test(value.trim()) ? `${value.trim()}0` : value
                        const minor = decimalToMinor(parseable, market)
                        if (minor !== null) updateItem(item.key, { unitPriceMinor: minor })
                      }}
                      onBlur={(event) => {
                        const parseable = /^\d+\.$/.test(event.target.value.trim())
                          ? `${event.target.value.trim()}0`
                          : event.target.value
                        const minor = decimalToMinor(parseable, market)
                        if (minor !== null) updateItem(item.key, { unitPriceMinor: minor })
                        setPriceInputs((current) => {
                          const next = { ...current }
                          delete next[item.key]
                          return next
                        })
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      aria-label="Decrease quantity"
                      size="icon-sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      onClick={() => updateQuantity(item.key, -1000)}
                    >
                      <Minus />
                    </Button>
                    <Input
                      aria-label={dictionary.quantity}
                      className="w-16 text-center"
                      inputMode="decimal"
                      value={quantityInputs[item.key] ?? String(item.quantityMilliunits / 1000)}
                      onChange={(event) => {
                        const raw = event.target.value
                        if (!/^\d*(?:\.\d{0,3})?$/.test(raw)) return
                        setQuantityInputs((current) => ({ ...current, [item.key]: raw }))
                        const value = Math.round(Number(raw) * 1000)
                        if (Number.isSafeInteger(value) && value > 0) {
                          updateItem(item.key, { quantityMilliunits: value })
                        }
                      }}
                      onBlur={() => {
                        setQuantityInputs((current) => {
                          const next = { ...current }
                          delete next[item.key]
                          return next
                        })
                      }}
                    />
                    <Button
                      aria-label="Increase quantity"
                      size="icon-sm"
                      variant="outline"
                      className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                      onClick={() => updateQuantity(item.key, 1000)}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
                {market.taxMode === 'saudiVat' ? <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-2 text-xs tabular-nums">
                  <span>
                    <span className="block text-muted-foreground">
                      {dictionary.priceExcludingVat}
                    </span>
                    <span className="font-medium text-foreground">{formatMoney(line.netMinor, market, moneyLocale)}</span>
                  </span>
                  <span className="text-center">
                    <span className="block text-muted-foreground">{dictionary.vat}</span>
                    <span className="font-medium text-foreground">{formatMoney(line.vatMinor, market, moneyLocale)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-muted-foreground">
                      {dictionary.priceIncludingVat}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatMoney(line.totalMinor, market, moneyLocale)}
                    </span>
                  </span>
                </div> : <div className="flex justify-between rounded-md bg-muted/40 p-2 text-xs tabular-nums"><span>{dictionary.total}</span><strong>{formatMoney(line.totalMinor, market, moneyLocale)}</strong></div>}
              </div>
            )
          })}
          {cart.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">{dictionary.emptyCart}</p>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t-2 bg-muted/50 p-3">
          <div className="space-y-1 text-sm tabular-nums">
            {market.taxMode === 'saudiVat' && <div className="flex justify-between">
              <span className="text-muted-foreground">{dictionary.subtotal}</span>
              <span>{formatMoney(totals.subtotalMinor, market, moneyLocale)}</span>
            </div>}
            {market.taxMode === 'saudiVat' && <div className="flex justify-between">
              <span className="text-muted-foreground">{dictionary.vat}</span>
              <span>{formatMoney(totals.vatMinor, market, moneyLocale)}</span>
            </div>}
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>{dictionary.total}</span>
              <span>{formatMoney(totals.totalMinor, market, moneyLocale)}</span>
            </div>
          </div>

          {!historical && invoiceType === 'standard' && (
            <div className="grid gap-2 rounded-md bg-violet-100/60 p-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 dark:bg-violet-950/30">
              <Input
                className="bg-card"
                placeholder={dictionary.buyerName}
                value={buyer.name || ''}
                onChange={(event) => setBuyer({ ...buyer, name: event.target.value })}
              />
              <Input
                className="bg-card"
                placeholder={dictionary.buyerVat}
                inputMode="numeric"
                value={buyer.vatNumber || ''}
                onChange={(event) => setBuyer({ ...buyer, vatNumber: event.target.value })}
              />
              <Textarea
                className="bg-card sm:col-span-2 lg:col-span-1 xl:col-span-2"
                placeholder={dictionary.buyerAddress}
                rows={2}
                value={buyer.address || ''}
                onChange={(event) => setBuyer({ ...buyer, address: event.target.value })}
              />
              <Input
                className="bg-card sm:col-span-2 lg:col-span-1 xl:col-span-2"
                placeholder={dictionary.buyerIdentification}
                value={buyer.identification || ''}
                onChange={(event) => setBuyer({ ...buyer, identification: event.target.value })}
              />
            </div>
          )}

          {historical && (
            <div className="grid gap-3 rounded-md bg-muted/60 p-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="historical-sale-date">
                  {dictionary.originalSaleDate} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="historical-sale-date"
                  type="date"
                  max={defaultSaleDate}
                  required
                  value={saleDate}
                  onChange={(event) => updateHistoricalSaleDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="historical-paper-reference">
                  {dictionary.paperReference}
                </Label>
                <Input
                  id="historical-paper-reference"
                  maxLength={80}
                  placeholder={dictionary.paperReferencePlaceholder}
                  value={externalReference}
                  onChange={(event) => setExternalReference(event.target.value)}
                />
              </div>
            </div>
          )}

          <EmployeeSelector
            dictionary={dictionary}
            employees={employees}
            onValueChange={setEmployeeId}
            value={employeeId}
          />

          {!settingsReady && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              Complete{' '}
              <Link href="/business" className="font-medium underline">
                {dictionary.businessInformation}
              </Link>{' '}
              before finalizing.
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {historicalSuccess && (
            <p
              className="rounded-md bg-emerald-100 p-3 text-sm font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              role="status"
            >
              {dictionary.historicalSaleRecorded}
            </p>
          )}
          <Button
            className="h-11 w-full bg-emerald-600 text-base text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-600 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
            disabled={
              !settingsReady ||
              cart.length === 0 ||
              pending ||
              (historical && !saleDate)
            }
            onClick={() => {
              setError('')
              setHistoricalSuccess(false)
              setSaleConfirmationOpen(true)
            }}
          >
            {pending
              ? historical
                ? dictionary.recordingPastSale
                : dictionary.finalizing
              : historical
                ? dictionary.recordPastSale
                : dictionary.finalizeSale}
          </Button>
        </div>
      </aside>
      </div>

      <Dialog
        open={saleConfirmationOpen}
        onOpenChange={(open) => {
          if (!pending) setSaleConfirmationOpen(open)
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {historical
                ? dictionary.confirmHistoricalSaleTitle
                : dictionary.confirmCheckoutSaleTitle}
            </DialogTitle>
            <DialogDescription>
              {(historical
                ? dictionary.confirmHistoricalSaleDescription.replace(
                    '{date}',
                    historicalDateLabel,
                  )
                : dictionary.confirmCheckoutSaleDescription
              ).replace('{amount}', formatMoney(totals.totalMinor, market, moneyLocale))}
            </DialogDescription>
          </DialogHeader>
          <SaleSettlementPanel
            dictionary={dictionary}
            idPrefix="checkout-settlement"
            market={market}
            paidAmountLabel={historical ? dictionary.paidOnSaleDateOptional : undefined}
            people={people}
            today={saleToday}
            totalMinor={totals.totalMinor}
            value={settlement}
            onChange={setSettlement}
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="cancel"
              disabled={pending}
              onClick={() => setSaleConfirmationOpen(false)}
            >
              {dictionary.cancel}
            </Button>
            <Button type="button" variant="success" disabled={pending} onClick={finalize}>
              {pending
                ? historical
                  ? dictionary.recordingPastSale
                  : dictionary.finalizing
                : historical
                  ? dictionary.recordPastSale
                  : dictionary.finalizeSale}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
