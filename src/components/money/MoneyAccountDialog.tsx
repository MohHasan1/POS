'use client'

import { Trash2, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'

import { createMoneyAccountAction, createMoneyPersonAction, updateMoneyAccountAction } from '@/actions/money'
import { Button } from '@/components/ui/button'
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem, ComboboxTrigger } from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toMarketDateInput } from '@/lib/calendar'
import type { Dictionary } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'
import type { MoneyAccountView, MoneyDirection, MoneyInvoiceOption, MoneyKind } from '@/lib/money-types'
import { decimalToMinor, formatMoney, minorToDecimal } from '@/lib/money'
import type { MoneyPerson, Product } from '@/payload-types'

type ProductRow = { productId: string; quantity: string; unitPrice: string }

function relationId(value: { id: string } | null | string | undefined) {
  return typeof value === 'string' ? value : value?.id
}

function secondaryProductName(product: Product, market: MarketProfile) {
  return market.documentLanguage === 'bn' ? product.nameBangla : product.nameArabic
}

function kindLabel(kind: MoneyKind, dictionary: Dictionary) {
  if (kind === 'unpaidInvoice') return dictionary.unpaidInvoice
  if (kind === 'moneyLent') return dictionary.moneyLent
  if (kind === 'supplierCredit') return dictionary.supplierCredit
  if (kind === 'borrowedMoney') return dictionary.borrowedMoney
  return dictionary.otherMoney
}

export function MoneyAccountDialog({
  dictionary,
  direction,
  invoices,
  initialInvoiceId,
  market,
  onClose,
  products,
  people: initialPeople,
  today,
  view,
}: {
  dictionary: Dictionary
  direction: MoneyDirection
  invoices: MoneyInvoiceOption[]
  initialInvoiceId?: string
  market: MarketProfile
  onClose: () => void
  products: Product[]
  people: MoneyPerson[]
  today: string
  view: MoneyAccountView | null | undefined
}) {
  const router = useRouter()
  const existing = view?.account
  const kinds: MoneyKind[] = direction === 'owedToUs'
    ? ['unpaidInvoice', 'moneyLent', 'other']
    : ['supplierCredit', 'borrowedMoney', 'other']
  const [people, setPeople] = useState(initialPeople)
  const [kind, setKind] = useState<MoneyKind>(existing?.kind || (initialInvoiceId ? 'unpaidInvoice' : kinds[0]))
  const [personId, setPersonId] = useState(relationId(existing?.person) || '')
  const [invoiceId, setInvoiceId] = useState(relationId(existing?.invoice) || initialInvoiceId || '')
  const [recordDate, setRecordDate] = useState(existing ? toMarketDateInput(existing.recordDate, market) : today)
  const [dueDate, setDueDate] = useState(existing?.dueDate ? toMarketDateInput(existing.dueDate, market) : '')
  const [amount, setAmount] = useState(existing ? minorToDecimal(existing.originalAmountMinor, market) : '')
  const [reference, setReference] = useState(existing?.reference || '')
  const [note, setNote] = useState(existing?.note || '')
  const [productRows, setProductRows] = useState<ProductRow[]>(
    (existing?.products || []).map((row) => {
      const productId = relationId(row.product) || ''
      const product = products.find(({ id }) => id === productId)
      return {
        productId,
        quantity: String(row.quantityMilliunits / 1000),
        unitPrice: minorToDecimal(row.unitPriceMinor ?? product?.unitCostMinor ?? 0, market),
      }
    }),
  )
  const [productSearch, setProductSearch] = useState('')
  const [quickPerson, setQuickPerson] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [newPersonPhone, setNewPersonPhone] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const selectedPerson = people.find(({ id }) => id === personId)
  const selectedInvoice = invoices.find(({ id }) => id === invoiceId)
  const invoiceLocked = Boolean(existing?.invoice)
  const selectedProductIds = useMemo(() => new Set(productRows.map(({ productId }) => productId)), [productRows])
  const availableProducts = useMemo(() => {
    return products
      .filter(({ active, id }) => active && !selectedProductIds.has(id))
  }, [products, selectedProductIds])
  const calculatedProductTotalMinor = productRows.reduce((total, row) => {
    const quantityMilliunits = Math.round(Number(row.quantity) * 1000)
    const unitPriceMinor = decimalToMinor(row.unitPrice, market)
    if (!Number.isSafeInteger(quantityMilliunits) || quantityMilliunits < 1 || unitPriceMinor === null) return total
    return total + Math.round((quantityMilliunits * unitPriceMinor) / 1000)
  }, 0)
  const usesProductTotal = direction === 'weOwe' && kind === 'supplierCredit' && productRows.length > 0
  const shownAmount = selectedInvoice
    ? minorToDecimal(selectedInvoice.totalMinor, market)
    : usesProductTotal
      ? minorToDecimal(calculatedProductTotalMinor, market)
      : amount

  function addProduct(product: Product) {
    if (selectedProductIds.has(product.id)) return
    setProductRows((rows) => [...rows, {
      productId: product.id,
      quantity: '1',
      unitPrice: minorToDecimal(product.unitCostMinor ?? 0, market),
    }])
    setProductSearch('')
  }

  function quickCreatePerson() {
    setError('')
    startTransition(async () => {
      const result = await createMoneyPersonAction({ name: newPersonName, phone: newPersonPhone || undefined })
      if (!result.ok) return setError(result.error)
      if (!result.data) return setError(dictionary.genericError)
      const person: MoneyPerson = {
        active: true,
        createdAt: new Date().toISOString(),
        id: result.data.id,
        name: result.data.name,
        phone: newPersonPhone || null,
        updatedAt: new Date().toISOString(),
      }
      setPeople((current) => [...current, person].sort((a, b) => a.name.localeCompare(b.name)))
      setPersonId(person.id)
      setQuickPerson(false)
      setNewPersonName('')
      setNewPersonPhone('')
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const originalAmountMinor = selectedInvoice?.totalMinor
      ?? (usesProductTotal ? calculatedProductTotalMinor : decimalToMinor(amount, market))
    if (!originalAmountMinor || originalAmountMinor < 1) return setError(dictionary.moneyAmountError)
    const parsedProducts = productRows.map(({ productId, quantity, unitPrice }) => ({
      productId,
      quantityMilliunits: Math.round(Number(quantity) * 1000),
      unitPriceMinor: decimalToMinor(unitPrice, market),
    }))
    if (parsedProducts.some(({ productId, quantityMilliunits, unitPriceMinor }) => !productId || !Number.isSafeInteger(quantityMilliunits) || quantityMilliunits < 1 || unitPriceMinor === null || unitPriceMinor < 0)) {
      return setError(dictionary.moneyAmountError)
    }
    setError('')
    startTransition(async () => {
      const common = {
        dueDate: dueDate || undefined,
        kind,
        note: note || undefined,
        originalAmountMinor,
        personId,
        products: kind === 'supplierCredit'
          ? parsedProducts.map((row) => ({ ...row, unitPriceMinor: row.unitPriceMinor! }))
          : undefined,
        recordDate,
        reference: reference || undefined,
      }
      const result = existing
        ? await updateMoneyAccountAction(existing.id, common)
        : await createMoneyAccountAction({
            ...common,
            direction,
            idempotencyKey: crypto.randomUUID(),
            invoiceId: kind === 'unpaidInvoice' ? invoiceId || undefined : undefined,
          })
      if (!result.ok) return setError(result.error)
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open={view !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? dictionary.editMoneyRecord : direction === 'owedToUs' ? dictionary.addOwedToUs : dictionary.addWeOwe}</DialogTitle>
          <DialogDescription>{dictionary.moneyRecordDescription}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="money-kind">{dictionary.type} *</Label>
            <Select value={kind} disabled={invoiceLocked} onValueChange={(value) => setKind(value as MoneyKind)}>
              <SelectTrigger id="money-kind" className="w-full"><SelectValue>{kindLabel(kind, dictionary)}</SelectValue></SelectTrigger>
              <SelectContent>{kinds.map((value) => <SelectItem key={value} value={value}>{kindLabel(value, dictionary)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="money-person">{dictionary.person} *</Label>
            <div className="flex gap-2">
              <Select value={personId} onValueChange={(value) => setPersonId(value || '')}>
                <SelectTrigger id="money-person" className="min-w-0 flex-1"><SelectValue>{selectedPerson?.name || dictionary.selectPerson}</SelectValue></SelectTrigger>
                <SelectContent>{people.filter(({ active, id }) => active || id === personId).map((person) => <SelectItem key={person.id} value={person.id}>{person.name}{person.phone ? ` · ${person.phone}` : ''}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" title={dictionary.createPerson} onClick={() => setQuickPerson((value) => !value)}><UserPlus /></Button>
            </div>
          </div>
          {quickPerson && (
            <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:col-span-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5"><Label htmlFor="quick-person-name">{dictionary.person} *</Label><Input id="quick-person-name" value={newPersonName} maxLength={160} onChange={(event) => setNewPersonName(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="quick-person-phone">{dictionary.phoneOptional}</Label><Input id="quick-person-phone" value={newPersonPhone} maxLength={40} onChange={(event) => setNewPersonPhone(event.target.value)} /></div>
              <Button type="button" variant="success" disabled={pending || !newPersonName.trim()} onClick={quickCreatePerson}>{dictionary.create}</Button>
            </div>
          )}
          {direction === 'owedToUs' && kind === 'unpaidInvoice' && !existing && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="money-invoice">{dictionary.selectInvoice} *</Label>
              <Select value={invoiceId} onValueChange={(value) => setInvoiceId(value || '')}>
                <SelectTrigger id="money-invoice" className="w-full"><SelectValue>{selectedInvoice ? `${selectedInvoice.invoiceNumber}${selectedInvoice.customerName ? ` · ${selectedInvoice.customerName}` : ''}` : dictionary.selectInvoice}</SelectValue></SelectTrigger>
                <SelectContent>{invoices.map((invoice) => <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoiceNumber}{invoice.customerName ? ` · ${invoice.customerName}` : ''} · {minorToDecimal(invoice.totalMinor, market)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label htmlFor="money-record-date">{dictionary.moneyRecordDate} *</Label><Input id="money-record-date" type="date" required max={today} disabled={Boolean(selectedInvoice || existing?.invoice)} value={selectedInvoice ? toMarketDateInput(selectedInvoice.issuedAt, market) : recordDate} onChange={(event) => setRecordDate(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="money-due-date">{dictionary.dueDateOptional}</Label><Input id="money-due-date" type="date" min={recordDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="money-amount">{dictionary.originalAmount} *</Label><Input id="money-amount" inputMode="decimal" required disabled={Boolean(selectedInvoice || existing?.invoice || usesProductTotal)} value={shownAmount} onChange={(event) => setAmount(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="money-reference">{dictionary.reference}</Label><Input id="money-reference" maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} /></div>
          {direction === 'weOwe' && kind === 'supplierCredit' && (
            <div className="space-y-3 rounded-lg bg-muted/40 p-3 sm:col-span-2">
              <Label htmlFor="money-product-search">{dictionary.productsAndQuantities}</Label>
              <Combobox
                items={availableProducts}
                value={null}
                inputValue={productSearch}
                itemToStringLabel={(product: Product) => product.nameEnglish}
                filter={(product: Product, query) => {
                  const normalized = query.trim().toLocaleLowerCase()
                  return !normalized || [product.nameEnglish, product.nameBangla, product.nameArabic, product.sku]
                    .filter(Boolean)
                    .some((value) => value!.toLocaleLowerCase().includes(normalized))
                }}
                onInputValueChange={(value) => setProductSearch(value)}
                onValueChange={(product: Product | null) => product && addProduct(product)}
              >
                <ComboboxInputGroup>
                  <ComboboxInput id="money-product-search" placeholder={dictionary.searchProducts} />
                  <ComboboxTrigger aria-label={dictionary.selectProduct} />
                </ComboboxInputGroup>
                <ComboboxContent emptyText={dictionary.noProducts}>
                  {(product: Product) => {
                    const secondaryName = secondaryProductName(product, market)
                    return <ComboboxItem key={product.id} value={product}>
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{product.nameEnglish}</span>{secondaryName && <span className="block truncate text-xs text-muted-foreground">{secondaryName}</span>}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatMoney(product.unitCostMinor ?? 0, market, market.locale)}</span>
                    </ComboboxItem>
                  }}
                </ComboboxContent>
              </Combobox>
              {productRows.map((row, index) => {
                const product = products.find(({ id }) => id === row.productId)
                const secondaryName = product ? secondaryProductName(product, market) : undefined
                const quantityMilliunits = Math.round(Number(row.quantity) * 1000)
                const unitPriceMinor = decimalToMinor(row.unitPrice, market)
                const lineTotalMinor = Number.isSafeInteger(quantityMilliunits) && quantityMilliunits > 0 && unitPriceMinor !== null
                  ? Math.round((quantityMilliunits * unitPriceMinor) / 1000)
                  : 0
                return <div key={row.productId} className="grid items-end gap-2 rounded-lg bg-background p-2 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_auto]">
                  <div className="min-w-0 self-center"><p className="truncate text-sm font-medium">{product?.nameEnglish || dictionary.selectProduct}</p>{secondaryName && <p className="truncate text-xs text-muted-foreground">{secondaryName}</p>}</div>
                  <div className="space-y-1"><Label className="text-xs" htmlFor={`money-product-quantity-${row.productId}`}>{dictionary.quantity}</Label><Input id={`money-product-quantity-${row.productId}`} inputMode="decimal" value={row.quantity} onChange={(event) => setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} /></div>
                  <div className="space-y-1"><Label className="text-xs" htmlFor={`money-product-price-${row.productId}`}>{dictionary.price}</Label><Input id={`money-product-price-${row.productId}`} inputMode="decimal" value={row.unitPrice} onChange={(event) => setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: event.target.value } : item))} /></div>
                  <div className="self-center text-right"><p className="text-xs text-muted-foreground">{dictionary.total}</p><p className="text-sm font-semibold tabular-nums">{formatMoney(lineTotalMinor, market, market.locale)}</p></div>
                  <Button type="button" variant="ghost" size="icon" title={dictionary.remove} onClick={() => setProductRows((rows) => rows.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button>
                </div>
              })}
              {productRows.length > 0 && <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2"><span className="text-sm font-medium">{dictionary.total}</span><strong className="tabular-nums">{formatMoney(calculatedProductTotalMinor, market, market.locale)}</strong></div>}
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="money-note">{dictionary.note}</Label><Textarea id="money-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></div>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2" role="alert">{error}</p>}
          <DialogFooter className="sm:col-span-2"><Button type="button" variant="cancel" onClick={onClose}>{dictionary.cancel}</Button><Button type="submit" variant="success" disabled={pending || !personId || (kind === 'unpaidInvoice' && !existing && !invoiceId)}>{pending ? dictionary.saving : dictionary.save}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
