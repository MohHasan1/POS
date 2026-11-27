'use client'

import Link from 'next/link'
import { useId, useState, useTransition } from 'react'

import { addSupplyPurchaseAction, getSupplyExpenseCategoriesAction, type SupplyActionResult } from '@/actions/supplies'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ExpensePaymentMethod, ExpensePaymentStatus } from '@/lib/expense-types'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale, type MarketProfile } from '@/lib/market'
import { decimalToMinor, formatMoney } from '@/lib/money'
import { SUPPLY_LABEL_LIMIT, SUPPLY_NOTES_LIMIT, SUPPLY_VENDOR_LIMIT } from '@/lib/supplies'

import { SupplyDialog } from './SupplyDialogs'

export function SupplyPurchaseDialog({
  dictionary, locale, market, onClose, onSaved, requestId, supplies, today,
}: {
  dictionary: Dictionary
  locale: Locale
  market: MarketProfile
  onClose: () => void
  onSaved: () => void
  requestId: string
  supplies: { id: string; name: string }[]
  today: string
}) {
  const labels = dictionary.supplyTracker
  const id = useId()
  const [supplyId, setSupplyId] = useState(supplies.length === 1 ? supplies[0].id : '')
  const [purchasedOn, setPurchasedOn] = useState(today)
  const [quantity, setQuantity] = useState('1')
  const [cost, setCost] = useState('')
  const [hasExpense, setHasExpense] = useState(false)
  const [categories, setCategories] = useState<{ id: string; name: string }[] | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [loadingCategories, loadCategories] = useTransition()
  const [paymentStatus, setPaymentStatus] = useState<ExpensePaymentStatus>('paid')
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('cash')
  const [payDate, setPayDate] = useState('')
  const costMinor = cost.trim() ? decimalToMinor(cost, market) : null
  const total = costMinor === null ? null : costMinor * Number(quantity)
  const hasVat = market.taxMode === 'saudiVat'
  const paymentMethods = [
    { value: 'cash', label: dictionary.payment_cash },
    { value: 'bank', label: dictionary.payment_bank_transfer },
    { value: 'other', label: dictionary.payment_other },
  ] as const

  function toggleExpense(checked: boolean) {
    setHasExpense(checked)
    if (!checked || categories?.length || loadingCategories) return
    loadCategories(async () => {
      const result = await getSupplyExpenseCategoriesAction()
      setCategories(result)
      setCategoryId(result?.find(({ name }) => name.toLowerCase() === 'supplies')?.id ?? result?.[0]?.id ?? '')
    })
  }

  async function save(data: FormData): Promise<SupplyActionResult> {
    const name = String(data.get('name') ?? '').trim()
    const units = Number(quantity)
    if (!supplyId || !name || !purchasedOn || !Number.isSafeInteger(units) || units < 1 || units > 1_000_000) {
      return { ok: false, error: 'invalidPurchase' }
    }
    if (cost.trim() && costMinor === null) return { ok: false, error: 'invalidCost' }
    const vatText = hasExpense && hasVat ? String(data.get('vat') ?? '').trim() : ''
    const vatMinor = vatText ? decimalToMinor(vatText, market) : 0
    if (hasExpense && (!categoryId || total === null || total < 1 || vatMinor === null || vatMinor > total)) {
      return { ok: false, error: 'invalidPurchaseExpense' }
    }
    return addSupplyPurchaseAction(supplyId, requestId, {
      name, purchasedOn, quantity: units, unitCostMinor: costMinor,
      vendor: String(data.get('vendor') ?? ''),
      notes: String(data.get('notes') ?? ''),
      expense: hasExpense ? {
        categoryId, paymentStatus, paymentMethod,
        paidAt: paymentStatus === 'paid' ? payDate || purchasedOn : undefined,
        vatMinor: vatMinor ?? 0,
      } : undefined,
    })
  }

  return (
    <SupplyDialog dictionary={dictionary} title={labels.addPurchase} submitLabel={dictionary.save} action={save} onClose={onClose} onSaved={onSaved}>
      <div className="space-y-1.5">
        {supplies.length === 1 ? (
          <p className="text-sm font-medium"><span className="text-muted-foreground">{labels.name}</span> · {supplies[0].name}</p>
        ) : (
          <>
            <Label htmlFor={`${id}-supply`}>{labels.name} *</Label>
            <Select items={supplies.map(({ id, name }) => ({ value: id, label: name }))} value={supplyId || null} onValueChange={(value) => setSupplyId(value ?? '')}>
              <SelectTrigger id={`${id}-supply`} className="w-full"><SelectValue placeholder={labels.selectSupply} /></SelectTrigger>
              <SelectContent>{supplies.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`}>{labels.purchaseName} *</Label>
        <Input id={`${id}-name`} name="name" maxLength={SUPPLY_LABEL_LIMIT} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-date`}>{labels.purchasedOn} *</Label>
          <Input id={`${id}-date`} type="date" value={purchasedOn} max={today} required onChange={(event) => setPurchasedOn(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-qty`}>{dictionary.quantity} *</Label>
          <Input id={`${id}-qty`} type="number" min={1} max={1_000_000} step={1} value={quantity} required onChange={(event) => setQuantity(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-cost`}>{labels.unitCostOptional} · {market.currencyCode}</Label>
          <Input id={`${id}-cost`} inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-vendor`}>{labels.vendorOptional}</Label>
          <Input id={`${id}-vendor`} name="vendor" maxLength={SUPPLY_VENDOR_LIMIT} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-notes`}>{labels.notesOptional}</Label>
        <Textarea id={`${id}-notes`} name="notes" rows={2} maxLength={SUPPLY_NOTES_LIMIT} />
      </div>
      {total !== null && Number.isSafeInteger(total) && (
        <div className="flex justify-between gap-2 rounded-md bg-muted px-3 py-2">
          <span>{labels.purchaseTotal}</span>
          <strong className="tabular-nums">{formatMoney(total, market, marketLocale(market, locale))}</strong>
        </div>
      )}
      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Checkbox id={`${id}-expense`} checked={hasExpense} onCheckedChange={(checked) => toggleExpense(checked === true)} />
          <Label htmlFor={`${id}-expense`}>{labels.addToExpenses}</Label>
        </div>
        {hasExpense && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-category`}>{dictionary.category} *</Label>
              <Select items={categories?.map(({ id, name }) => ({ value: id, label: name })) ?? []} value={categoryId || null} onValueChange={(value) => setCategoryId(value ?? '')}>
                <SelectTrigger id={`${id}-category`} className="w-full" disabled={!categories?.length}><SelectValue placeholder={loadingCategories ? dictionary.loading : dictionary.category} /></SelectTrigger>
                <SelectContent>{categories?.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
              </Select>
              {!loadingCategories && !categories?.length && (
                <Link href="/expenses" target="_blank" rel="noreferrer" className="text-xs underline">{labels.manageExpenseCategories}</Link>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-status`}>{dictionary.paymentStatus}</Label>
              <Select value={paymentStatus} onValueChange={(value) => { if (value) setPaymentStatus(value as ExpensePaymentStatus) }}>
                <SelectTrigger id={`${id}-status`} className="w-full"><SelectValue>{dictionary[paymentStatus]}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="paid">{dictionary.paid}</SelectItem><SelectItem value="unpaid">{dictionary.unpaid}</SelectItem></SelectContent>
              </Select>
            </div>
            {paymentStatus === 'paid' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-paid-on`}>{dictionary.paymentDate}</Label>
                  <Input id={`${id}-paid-on`} type="date" min={purchasedOn} max={today} value={payDate || purchasedOn} onChange={(event) => setPayDate(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-method`}>{dictionary.paymentMethod}</Label>
                  <Select items={paymentMethods} value={paymentMethod} onValueChange={(value) => { if (value) setPaymentMethod(value as ExpensePaymentMethod) }}>
                    <SelectTrigger id={`${id}-method`} className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{paymentMethods.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            {hasVat && (
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-vat`}>{labels.purchaseVat} · {market.currencyCode}</Label>
                <Input id={`${id}-vat`} name="vat" inputMode="decimal" placeholder="0" />
              </div>
            )}
          </div>
        )}
      </div>
    </SupplyDialog>
  )
}
