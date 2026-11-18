import type { Dictionary } from '@/lib/localization'
import type { MarketProfile } from '@/lib/market'

export function MarketProfileSummary({
  dictionary,
  locked,
  profile,
}: {
  dictionary: Dictionary
  locked: boolean
  profile: MarketProfile
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-background p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">{dictionary.marketProfile}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {dictionary.marketProfileDescription}
        </p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">{dictionary.country}</dt><dd className="font-medium">{profile.countryCode === 'BD' ? dictionary.bangladesh : dictionary.saudiArabia}</dd></div>
        <div><dt className="text-muted-foreground">{dictionary.currency}</dt><dd className="font-medium">{profile.currencyCode}</dd></div>
        <div><dt className="text-muted-foreground">{dictionary.timeZone}</dt><dd className="font-medium">{profile.timeZone}</dd></div>
        <div><dt className="text-muted-foreground">{dictionary.taxMode}</dt><dd className="font-medium">{profile.taxMode === 'none' ? dictionary.noTax : dictionary.saudiVat}</dd></div>
      </dl>
      {locked && <p className="text-xs text-muted-foreground">{dictionary.countryLocked}</p>}
    </section>
  )
}

