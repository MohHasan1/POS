export const countryCodes = ['SA', 'BD'] as const
export type CountryCode = (typeof countryCodes)[number]

export const secondaryLanguages = ['ar', 'bn', 'none'] as const
export type SecondaryLanguage = (typeof secondaryLanguages)[number]
export type DocumentLanguage = Exclude<SecondaryLanguage, 'none'>
export type TaxMode = 'saudiVat' | 'none'

export type MarketProfile = {
  countryCode: CountryCode
  countryName: string
  currencyCode: 'SAR' | 'BDT'
  currencySymbol: string
  defaultSecondaryLanguage: DocumentLanguage
  documentLanguage: DocumentLanguage
  locale: string
  minorUnitDigits: number
  taxMode: TaxMode
  timeZone: string
}

export const MARKET_PROFILES: Record<CountryCode, MarketProfile> = {
  SA: {
    countryCode: 'SA',
    countryName: 'Saudi Arabia',
    currencyCode: 'SAR',
    currencySymbol: 'SAR',
    defaultSecondaryLanguage: 'ar',
    documentLanguage: 'ar',
    locale: 'en-SA',
    minorUnitDigits: 2,
    taxMode: 'saudiVat',
    timeZone: 'Asia/Riyadh',
  },
  BD: {
    countryCode: 'BD',
    countryName: 'Bangladesh',
    currencyCode: 'BDT',
    currencySymbol: '৳',
    defaultSecondaryLanguage: 'bn',
    documentLanguage: 'bn',
    locale: 'en-BD',
    minorUnitDigits: 2,
    taxMode: 'none',
    timeZone: 'Asia/Dhaka',
  },
}

export const DEFAULT_MARKET = MARKET_PROFILES.SA

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === 'string' && countryCodes.includes(value as CountryCode)
}

export function getMarketProfile(countryCode: unknown): MarketProfile {
  return isCountryCode(countryCode) ? MARKET_PROFILES[countryCode] : DEFAULT_MARKET
}

export function getDocumentMarket(snapshot: {
  countryCode?: null | string
  currencyCode?: null | string
  currencyMinorUnitDigits?: null | number
  timeZone?: null | string
  taxMode?: null | string
}): MarketProfile {
  const base = getMarketProfile(snapshot.countryCode)
  return {
    ...base,
    currencyCode:
      snapshot.currencyCode === 'BDT' || snapshot.currencyCode === 'SAR'
        ? snapshot.currencyCode
        : base.currencyCode,
    currencySymbol: snapshot.currencyCode === 'BDT' ? '৳' : base.currencySymbol,
    minorUnitDigits: snapshot.currencyMinorUnitDigits ?? base.minorUnitDigits,
    taxMode: snapshot.taxMode === 'none' ? 'none' : base.taxMode,
    timeZone: snapshot.timeZone || base.timeZone,
  }
}

export function marketLocale(profile: MarketProfile, interfaceLocale: 'bn' | 'en'): string {
  if (interfaceLocale === 'bn') return 'bn-BD'
  return profile.locale
}

export type LocalizedName = { language: string; name: string }

export function localizedName(
  translations: LocalizedName[] | null | undefined,
  language: string | null | undefined,
): string | undefined {
  if (!language || language === 'none') return undefined
  return translations?.find((translation) => translation.language === language)?.name?.trim() || undefined
}

export function normalizedTranslations(
  translations: LocalizedName[] | null | undefined,
  legacy: { ar?: null | string; bn?: null | string } = {},
): LocalizedName[] {
  const values = new Map<string, string>()
  for (const translation of translations || []) {
    const language = translation.language?.trim()
    const name = translation.name?.trim()
    if (language && name && !values.has(language)) values.set(language, name)
  }
  if (legacy.ar?.trim() && !values.has('ar')) values.set('ar', legacy.ar.trim())
  if (legacy.bn?.trim() && !values.has('bn')) values.set('bn', legacy.bn.trim())
  return [...values].map(([language, name]) => ({ language, name }))
}

