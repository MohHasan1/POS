import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem, ComboboxTrigger } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import type { Dictionary, Locale } from '@/lib/localization'
import type { AvailableSupplyPurchase } from '@/lib/supply-stock'

import { supplyDateLabel, supplyNumber } from './format'

export const MANUAL_SUPPLY_ENTRY = 'manual'

export function SupplyPurchaseSelector({ dictionary, id, locale, onChange, purchases, value }: {
  dictionary: Dictionary
  id: string
  locale: Locale
  onChange: (value: string | null) => void
  purchases: AvailableSupplyPurchase[]
  value: string | null
}) {
  const labels = dictionary.supplyTracker
  const byId = new Map(purchases.map((purchase) => [purchase.id, purchase]))
  const name = (value: string) => byId.get(value)?.name ?? labels.manualStockEntry

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{labels.stockSource} *</Label>
      <Combobox
        items={[MANUAL_SUPPLY_ENTRY, ...byId.keys()]}
        value={value}
        onValueChange={onChange}
        itemToStringLabel={name}
        filter={(value, query) => {
          const purchase = byId.get(value)
          return `${name(value)} ${purchase?.vendor ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
        }}
      >
        <ComboboxInputGroup className="bg-background">
          <ComboboxInput id={id} placeholder={labels.searchStock} />
          <ComboboxTrigger aria-label={labels.stockSource} />
        </ComboboxInputGroup>
        <ComboboxContent emptyText={labels.noMatchingStock}>
          {(value: string) => {
            const purchase = byId.get(value)
            return (
              <ComboboxItem key={value} value={value}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{name(value)}</p>
                  {purchase && (
                    <p className="text-xs text-muted-foreground">
                      {[
                        purchase.vendor,
                        supplyDateLabel(purchase.purchasedOn, locale),
                        labels.unopenedCount.replace('{count}', supplyNumber(purchase.remainingQuantity, locale)),
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </ComboboxItem>
            )
          }}
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
