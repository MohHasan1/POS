'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  getEmployeeCommissionRatesAction,
  saveCompensationPlanAction,
} from '@/actions/payroll'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/localization'
import type { CompensationType } from '@/lib/payroll-types'
import { decimalToMinor, minorToDecimal } from '@/lib/money'
import type { MarketProfile } from '@/lib/market'
import type { Employee, Product } from '@/payload-types'

export function CompensationForm({
  dictionary,
  employee,
  market,
  onDone,
  products,
}: {
  dictionary: Dictionary
  employee: Employee
  market: MarketProfile
  onDone: () => void
  products: Product[]
}) {
  const router = useRouter()
  const [compensationType, setCompensationType] = useState<CompensationType>(employee.compensationType)
  const [monthlySalary, setMonthlySalary] = useState(
    employee.monthlySalaryMinor ? minorToDecimal(employee.monthlySalaryMinor, market) : '',
  )
  const [rates, setRates] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loadingRates, setLoadingRates] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getEmployeeCommissionRatesAction(employee.id).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setRates(Object.fromEntries((result.data || []).map((rate) => [rate.productId, String(rate.rateBps / 100)])))
      } else {
        setError(result.error)
      }
      setLoadingRates(false)
    })
    return () => {
      cancelled = true
    }
  }, [employee.id])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return products.filter((product) =>
      !query || [product.nameEnglish, product.sku].filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query)),
    )
  }, [products, search])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const monthlySalaryMinor = compensationType === 'monthly'
      ? decimalToMinor(monthlySalary, market)
      : null
    if (compensationType === 'monthly' && (!monthlySalaryMinor || monthlySalaryMinor < 1)) {
      setError(dictionary.payrollAmountError)
      return
    }
    const parsedRates: Array<{ productId: string; rateBps: number }> = []
    for (const [productId, rawValue] of Object.entries(rates)) {
      if (!rawValue.trim()) continue
      const value = Number(rawValue)
      const rateBps = Math.round(value * 100)
      if (!Number.isFinite(value) || value < 0 || value > 100 || Math.abs(rateBps / 100 - value) > 0.00001) {
        setError(dictionary.commissionRateError)
        return
      }
      parsedRates.push({ productId, rateBps })
    }
    setError('')
    startTransition(async () => {
      const result = await saveCompensationPlanAction({
        compensationType,
        employeeId: employee.id,
        monthlySalaryMinor,
        rates: compensationType === 'commission' ? parsedRates : [],
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
      onDone()
    })
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label htmlFor="compensation-type">{dictionary.compensationPlan}</Label>
        <select
          id="compensation-type"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={compensationType}
          onChange={(event) => setCompensationType(event.target.value as CompensationType)}
        >
          <option value="unconfigured">{dictionary.compensationUnconfigured}</option>
          <option value="monthly">{dictionary.monthlySalary}</option>
          <option value="commission">{dictionary.serviceCommission}</option>
        </select>
      </div>

      {compensationType === 'monthly' && (
        <div className="space-y-1.5">
          <Label htmlFor="monthly-salary">{dictionary.defaultMonthlySalary}</Label>
          <Input
            id="monthly-salary"
            inputMode="decimal"
            placeholder={minorToDecimal(0, market)}
            required
            value={monthlySalary}
            onChange={(event) => setMonthlySalary(event.target.value)}
          />
        </div>
      )}

      {compensationType === 'commission' && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="commission-search">{dictionary.serviceCommissionRates}</Label>
            <Input
              id="commission-search"
              className="mt-1.5"
              placeholder={dictionary.searchProducts}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
            {loadingRates ? (
              <p className="p-4 text-sm text-muted-foreground">{dictionary.loading}</p>
            ) : filteredProducts.map((product) => (
              <label key={product.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{product.nameEnglish}</span>
                  <span className="block text-xs text-muted-foreground">
                    {product.active ? dictionary.active : dictionary.inactive}
                  </span>
                </span>
                <span className="relative">
                  <Input
                    aria-label={`${product.nameEnglish} ${dictionary.commissionPercentage}`}
                    className="pr-7 text-right"
                    disabled={!product.active && !rates[product.id]}
                    inputMode="decimal"
                    max="100"
                    min="0"
                    step="0.01"
                    type="number"
                    value={rates[product.id] || ''}
                    onChange={(event) => setRates((current) => ({
                      ...current,
                      [product.id]: event.target.value,
                    }))}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{dictionary.missingCommissionRateHelp}</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="cancel" onClick={onDone} disabled={pending}>
          {dictionary.cancel}
        </Button>
        <Button type="submit" variant="success" disabled={pending || loadingRates}>
          {pending ? dictionary.saving : dictionary.save}
        </Button>
      </DialogFooter>
    </form>
  )
}
