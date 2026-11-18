'use client'

import { ArrowLeft, ArrowRight, EyeOff, Plus, RefreshCw, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type CSSProperties,
  type SubmitEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'

import {
  addServiceBoardColumnAction,
  createServiceBoardProductAction,
  createServiceBoardSaleAction,
  moveServiceBoardColumnAction,
  removeServiceBoardColumnAction,
} from '@/actions/service-board'
import { ProductForm } from '@/components/products/ProductForm'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary, Locale } from '@/lib/localization'
import { formatMarketDateTime } from '@/lib/calendar'
import { localizedName, marketLocale, normalizedTranslations } from '@/lib/market'
import { decimalToMinor, formatMoney, formatQuantity, minorToDecimal } from '@/lib/money'
import type { ProductSummary } from '@/lib/pos-types'
import {
  buildServiceCardAccents,
  type ServiceCardAccent,
} from '@/lib/service-board-colors'
import type { ServiceBoardCard, ServiceBoardView } from '@/lib/service-board-types'
import { cn } from '@/lib/utils'

type SaleRow = {
  price: string
  productId: string
  quantity: string
}

function localizedProductName(product: ProductSummary) {
  return product.nameEnglish
}

function secondaryProductName(product: ProductSummary, language: ServiceBoardView['secondaryLanguage']) {
  return localizedName(
    normalizedTranslations(product.translations, { ar: product.nameArabic, bn: product.nameBangla }),
    language,
  )
}

function ServiceCard({
  accent,
  card,
  dictionary,
  locale,
  view,
}: {
  accent: ServiceCardAccent
  card: ServiceBoardCard
  dictionary: Dictionary
  locale: Locale
  view: Pick<ServiceBoardView, 'market'>
}) {
  const dateLocale = marketLocale(view.market, locale)

  return (
    <article
      className="space-y-3 rounded-lg border bg-[var(--service-card-bg)] p-3 shadow-sm dark:bg-[var(--service-card-bg-dark)]"
      style={
        {
          '--service-card-bg': accent.light,
          '--service-card-bg-dark': accent.dark,
        } as CSSProperties
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{card.customerName || card.invoiceNumber}</p>
          {card.customerName && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.invoiceNumber}</p>
          )}
        </div>
        <Badge variant="outline" className="shrink-0 bg-background/70 tabular-nums">
          ×{formatQuantity(card.quantityMilliunits, dateLocale)}
        </Badge>
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{dictionary.date}</dt>
          <dd className="text-right tabular-nums">
            {formatMarketDateTime(card.issuedAt, view.market, dateLocale)}
          </dd>
        </div>
        {card.customerPhone && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{dictionary.mobile}</dt>
            <dd className="text-right" dir="auto">
              {card.customerPhone}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{dictionary.total}</dt>
          <dd className="font-semibold tabular-nums">
            {formatMoney(card.totalMinor, view.market, dateLocale)}
          </dd>
        </div>
      </dl>
      {card.note && <p className="line-clamp-2 text-xs text-muted-foreground">{card.note}</p>}
      <Link
        href={`/invoices/${card.invoiceId}`}
        className={cn(
          buttonVariants({ size: 'sm', variant: 'outline' }),
          'w-full border-amber-500 bg-amber-500 text-amber-950 hover:border-amber-400 hover:bg-amber-400 hover:text-amber-950 dark:border-amber-300 dark:bg-amber-300 dark:text-amber-950 dark:hover:border-amber-200 dark:hover:bg-amber-200 dark:hover:text-amber-950',
        )}
      >
        {dictionary.viewPrintInvoice}
      </Link>
    </article>
  )
}

function CreateServiceDialog({
  autoTranslateProducts,
  defaultPriceIncludesVat,
  dictionary,
  onOpenChange,
  open,
  view,
}: {
  autoTranslateProducts: boolean
  defaultPriceIncludesVat: boolean
  dictionary: Dictionary
  onOpenChange: (open: boolean) => void
  open: boolean
  view: ServiceBoardView
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{dictionary.createNewService}</DialogTitle>
          <DialogDescription>{dictionary.productDescription}</DialogDescription>
        </DialogHeader>
        <ProductForm
          createAction={createServiceBoardProductAction}
          defaultPriceIncludesVat={defaultPriceIncludesVat}
          dictionary={dictionary}
          market={view.market}
          secondaryLanguage={view.secondaryLanguage}
          autoTranslateProducts={autoTranslateProducts}
          onDone={() => onOpenChange(false)}
          product={null}
        />
      </DialogContent>
    </Dialog>
  )
}

export function ServiceBoardClient({
  allProducts,
  autoTranslateProducts,
  defaultPriceIncludesVat,
  dictionary,
  locale,
  settingsReady,
  view,
}: {
  allProducts: ProductSummary[]
  autoTranslateProducts: boolean
  defaultPriceIncludesVat: boolean
  dictionary: Dictionary
  locale: Locale
  settingsReady: boolean
  view: ServiceBoardView
}) {
  const router = useRouter()
  const [manageOpen, setManageOpen] = useState(false)
  const [createServiceOpen, setCreateServiceOpen] = useState(false)
  const [saleOpen, setSaleOpen] = useState(false)
  const [saleRows, setSaleRows] = useState<SaleRow[]>([])
  const [serviceToAdd, setServiceToAdd] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [refreshPending, startRefreshTransition] = useTransition()
  const selectedIds = useMemo(
    () => new Set(view.columns.map(({ product }) => product.id)),
    [view.columns],
  )
  const cardAccents = useMemo(
    () =>
      buildServiceCardAccents(
        view.columns.flatMap(({ cards }) => cards.map(({ invoiceId }) => invoiceId)),
      ),
    [view.columns],
  )
  const availableProducts = allProducts.filter((product) => !selectedIds.has(product.id))
  const visibleProducts = view.columns.map(({ product }) => product)
  const dateLocale = marketLocale(view.market, locale)
  const anyDialogOpen = manageOpen || createServiceOpen || saleOpen

  useEffect(() => {
    if (anyDialogOpen) return
    const interval = window.setInterval(() => {
      startRefreshTransition(() => router.refresh())
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [anyDialogOpen, router])

  function runColumnAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error || 'Unable to update Service Board.')
        return
      }
      router.refresh()
    })
  }

  function openSale(product: ProductSummary) {
    setSaleRows([
      {
        price: minorToDecimal(product.priceMinor, view.market),
        productId: product.id,
        quantity: '1',
      },
    ])
    setServiceToAdd(null)
    setIdempotencyKey(crypto.randomUUID())
    setError('')
    setMessage('')
    setSaleOpen(true)
  }

  function addSaleRow(productId: string | null) {
    if (!productId || saleRows.some((row) => row.productId === productId)) return
    const product = visibleProducts.find((candidate) => candidate.id === productId)
    if (!product) return
    setSaleRows((rows) => [
      ...rows,
      { price: minorToDecimal(product.priceMinor, view.market), productId, quantity: '1' },
    ])
    setServiceToAdd(null)
  }

  function updateSaleRow(productId: string, changes: Partial<SaleRow>) {
    setSaleRows((rows) =>
      rows.map((row) => (row.productId === productId ? { ...row, ...changes } : row)),
    )
  }

  function submitSale(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const items = saleRows.map((row) => ({
      productId: row.productId,
      quantityMilliunits: Math.round(Number(row.quantity) * 1000),
      unitPriceMinor: decimalToMinor(row.price, view.market),
    }))

    if (
      items.some(
        (item) =>
          item.unitPriceMinor === null ||
          !Number.isSafeInteger(item.quantityMilliunits) ||
          item.quantityMilliunits <= 0,
      )
    ) {
      setError('Enter a valid price and quantity for every service.')
      return
    }

    setError('')
    startTransition(async () => {
      const result = await createServiceBoardSaleAction({
        customerName: String(formData.get('customerName') || ''),
        customerPhone: String(formData.get('customerPhone') || ''),
        idempotencyKey,
        items: items.map((item) => ({
          productId: item.productId,
          quantityMilliunits: item.quantityMilliunits,
          unitPriceMinor: item.unitPriceMinor!,
        })),
        note: String(formData.get('note') || ''),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSaleOpen(false)
      setMessage(dictionary.serviceBoardCreated)
      router.refresh()
    })
  }

  const remainingSaleProducts = visibleProducts.filter(
    (product) => !saleRows.some((row) => row.productId === product.id),
  )
  const selectedAdditionalService = remainingSaleProducts.find(
    (product) => product.id === serviceToAdd,
  )
  const popular = view.summary.mostPopularService
  const popularName = popular?.nameEnglish || '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setManageOpen(true)}>
            <Plus aria-hidden="true" />
            {view.columns.length === 0 ? dictionary.addServices : dictionary.manageColumns}
          </Button>
          <Button
            variant="ghost"
            disabled={refreshPending}
            onClick={() => startRefreshTransition(() => router.refresh())}
          >
            <RefreshCw className={refreshPending ? 'animate-spin' : ''} aria-hidden="true" />
            {dictionary.refreshBoard}
          </Button>
        </div>
        {message && (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
            {message}
          </p>
        )}
      </div>

      {error && !saleOpen && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={dictionary.salesDashboard}
      >
        {[
          [dictionary.allSalesToday, formatMoney(view.summary.allSalesTodayMinor, view.market, dateLocale)],
          [
            dictionary.visibleServiceRevenue,
            formatMoney(view.summary.visibleServiceRevenueMinor, view.market, dateLocale),
          ],
          [
            dictionary.visitsToday,
            new Intl.NumberFormat(dateLocale).format(view.summary.distinctVisits),
          ],
          [dictionary.mostPopularService, popularName],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 truncate text-xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      {!settingsReady && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <Link href="/business" className="font-medium underline">
            {dictionary.completeBusinessBeforeSale}
          </Link>
        </p>
      )}

      {view.columns.length === 0 ? (
        <section className="rounded-xl border border-dashed bg-card p-10 text-center">
          <h2 className="text-lg font-semibold">{dictionary.noServiceColumns}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {dictionary.noServiceColumnsDescription}
          </p>
          <Button className="mt-5" onClick={() => setManageOpen(true)}>
            <Plus aria-hidden="true" />
            {dictionary.addServices}
          </Button>
        </section>
      ) : (
        <section className="overflow-x-auto pb-3">
          <div
            className={cn('grid min-w-full items-start gap-3', view.columns.length > 6 && 'w-max')}
            style={{
              gridTemplateColumns:
                view.columns.length <= 6
                  ? `repeat(${view.columns.length}, minmax(0, 1fr))`
                  : `repeat(${view.columns.length}, 14rem)`,
            }}
          >
            {view.columns.map(({ cards, product, summary }, index) => {
              return (
                <div key={product.id} className="min-w-0 space-y-2">
                  <div className="rounded-lg bg-violet-50/80 px-3 py-2 shadow-sm dark:bg-indigo-900/55">
                    <p className="text-[0.6875rem] font-medium text-muted-foreground">
                      {dictionary.serviceTotalToday}
                    </p>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <p className="min-w-0 truncate text-base font-semibold tabular-nums">
                        {formatMoney(summary.todayRevenueMinor, view.market, dateLocale)}
                      </p>
                      <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {dictionary.unitsSold.replace(
                          '{quantity}',
                          formatQuantity(summary.todayQuantityMilliunits, dateLocale),
                        )}
                      </p>
                    </div>
                  </div>
                  <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  <header className="space-y-3 border-b border-violet-300/70 bg-violet-200/90 p-3 dark:border-violet-700/70 dark:bg-violet-800/65">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-semibold">
                          {localizedProductName(product)}
                        </h2>
                        <p
                          className="mt-0.5 truncate text-left text-xs text-muted-foreground"
                          dir="auto"
                        >
                          {secondaryProductName(product, view.secondaryLanguage)}
                        </p>
                        <p className="mt-1 text-sm font-medium tabular-nums">
                          {formatMoney(product.priceMinor, view.market, dateLocale)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          disabled={pending || index === 0}
                          aria-label={dictionary.moveColumnLeft}
                          title={dictionary.moveColumnLeft}
                          onClick={() =>
                            runColumnAction(() => moveServiceBoardColumnAction(product.id, 'left'))
                          }
                        >
                          <ArrowLeft />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          disabled={pending || index === view.columns.length - 1}
                          aria-label={dictionary.moveColumnRight}
                          title={dictionary.moveColumnRight}
                          onClick={() =>
                            runColumnAction(() => moveServiceBoardColumnAction(product.id, 'right'))
                          }
                        >
                          <ArrowRight />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          disabled={pending}
                          aria-label={dictionary.hideColumn}
                          title={dictionary.hideColumn}
                          onClick={() =>
                            runColumnAction(() => removeServiceBoardColumnAction(product.id))
                          }
                        >
                          <EyeOff />
                        </Button>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200"
                      disabled={!settingsReady}
                      onClick={() => openSale(product)}
                    >
                      <Plus aria-hidden="true" />
                      {dictionary.addSale}
                    </Button>
                  </header>
                  <div className="max-h-[calc(100dvh-23rem)] min-h-40 space-y-3 overflow-y-auto p-3">
                    {cards.map((card, cardIndex) => (
                      <ServiceCard
                        key={`${card.invoiceId}:${card.productId}:${cardIndex}`}
                        accent={cardAccents.get(card.invoiceId)!}
                        card={card}
                        dictionary={dictionary}
                        locale={locale}
                        view={view}
                      />
                    ))}
                    {cards.length === 0 && (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {dictionary.noSalesToday}
                      </p>
                    )}
                  </div>
                  </section>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{dictionary.manageColumns}</DialogTitle>
            <DialogDescription>{dictionary.noServiceColumnsDescription}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground">
              {dictionary.selectExistingService}
            </p>
            {availableProducts.map((product) => (
              <div key={product.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{localizedProductName(product)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(product.priceMinor, view.market, dateLocale)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => runColumnAction(() => addServiceBoardColumnAction(product.id))}
                >
                  <Plus />
                  {dictionary.addService}
                </Button>
              </div>
            ))}
            {availableProducts.length === 0 && (
              <p className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
                {dictionary.noProducts}
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManageOpen(false)}>
              {dictionary.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setManageOpen(false)
                setCreateServiceOpen(true)
              }}
            >
              <Plus />
              {dictionary.createNewService}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateServiceDialog
        autoTranslateProducts={autoTranslateProducts}
        defaultPriceIncludesVat={defaultPriceIncludesVat}
        dictionary={dictionary}
        open={createServiceOpen}
        onOpenChange={setCreateServiceOpen}
        view={view}
      />

      <Dialog
        open={saleOpen}
        onOpenChange={(open) => {
          setSaleOpen(open)
          if (!open) setError('')
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dictionary.addSale}</DialogTitle>
            <DialogDescription>{dictionary.serviceBoardDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSale} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="customerName" maxLength={160} placeholder={dictionary.customerName} />
              <Input name="customerPhone" maxLength={40} placeholder={dictionary.customerPhone} />
              <Textarea
                className="sm:col-span-2"
                name="note"
                maxLength={500}
                rows={2}
                placeholder={dictionary.serviceNote}
              />
            </div>

            <div className="space-y-2">
              {saleRows.map((row) => {
                const product = visibleProducts.find((candidate) => candidate.id === row.productId)!
                return (
                  <div
                    key={row.productId}
                    className="grid items-end gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_140px_110px_auto]"
                  >
                    <div>
                      <p className="font-medium">{localizedProductName(product)}</p>
                      <p className="text-xs text-muted-foreground" dir="rtl">
                        {secondaryProductName(product, view.secondaryLanguage)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`sale-price-${product.id}`}>{dictionary.price}</Label>
                      <Input
                        id={`sale-price-${product.id}`}
                        inputMode="decimal"
                        value={row.price}
                        onChange={(event) =>
                          updateSaleRow(product.id, { price: event.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`sale-quantity-${product.id}`}>{dictionary.quantity}</Label>
                      <Input
                        id={`sale-quantity-${product.id}`}
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(event) => {
                          if (/^\d*(?:\.\d{0,3})?$/.test(event.target.value)) {
                            updateSaleRow(product.id, { quantity: event.target.value })
                          }
                        }}
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={saleRows.length === 1}
                      aria-label={dictionary.removeService}
                      title={dictionary.removeService}
                      onClick={() =>
                        setSaleRows((rows) =>
                          rows.filter((candidate) => candidate.productId !== product.id),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )
              })}
            </div>

            {remainingSaleProducts.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={serviceToAdd} onValueChange={setServiceToAdd}>
                  <SelectTrigger className="w-full bg-background sm:flex-1">
                    <SelectValue>
                      {selectedAdditionalService
                        ? localizedProductName(selectedAdditionalService)
                        : dictionary.selectService}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {remainingSaleProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {localizedProductName(product)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                  disabled={!serviceToAdd}
                  onClick={() => addSaleRow(serviceToAdd)}
                >
                  <Plus />
                  {dictionary.addAnotherService}
                </Button>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <DialogFooter className="mx-0 mb-0 px-0 pb-0">
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:text-red-950 dark:hover:bg-red-400"
                onClick={() => setSaleOpen(false)}
              >
                {dictionary.cancel}
              </Button>
              <Button type="submit" disabled={pending || !settingsReady}>
                {pending ? dictionary.creatingSale : dictionary.createSale}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
