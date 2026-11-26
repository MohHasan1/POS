import config from '@payload-config'
import { getPayload } from 'payload'

import type { ShopSetting } from '@/payload-types'
import {
  getMarketProfile,
  isCountryCode,
  marketLocale,
  type MarketProfile,
  type SecondaryLanguage,
} from '@/lib/market'
import type { Locale } from '@/lib/localization'
import type { LockScreenIdentity } from '@/lib/pos-access'

export type BusinessLogoFile = {
  data: Buffer
  mimetype: string
  name: string
  size: number
}

export type ShopSettingsInput = Pick<
  ShopSetting,
  | 'businessAddress'
  | 'autoTranslateProducts'
  | 'binNumber'
  | 'countryCode'
  | 'additionalTelephone'
  | 'crNumber'
  | 'defaultPriceIncludesVat'
  | 'defaultEmployee'
  | 'displayName'
  | 'email'
  | 'logo'
  | 'mobile'
  | 'registrations'
  | 'secondaryLanguage'
  | 'sellerNameArabic'
  | 'sellerNameBangla'
  | 'sellerNameEnglish'
  | 'telephone'
  | 'tinNumber'
  | 'tradeLicenseNumber'
  | 'vatNumber'
>

export type MarketContext = {
  autoTranslateProducts: boolean
  configured: boolean
  profile: MarketProfile
  secondaryLanguage: SecondaryLanguage
}

export async function getShopSettings(): Promise<ShopSetting> {
  const payload = await getPayload({ config })
  return payload.findGlobal({ slug: 'shop-settings', depth: 1 })
}

export function lockScreenIdentity(
  settings: Partial<Pick<ShopSetting, 'countryCode' | 'displayName' | 'sellerNameEnglish'>>,
  locale: Locale,
  fallbackName: string,
): LockScreenIdentity {
  const profile = getMarketProfile(settings.countryCode)
  return {
    shopName: settings.displayName?.trim() || settings.sellerNameEnglish?.trim() || fallbackName,
    dateLocale: marketLocale(profile, locale),
    timeZone: profile.timeZone,
  }
}

export async function getLockScreenIdentity(locale: Locale, fallbackName: string) {
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({
    slug: 'shop-settings',
    depth: 0,
    select: { countryCode: true, displayName: true, sellerNameEnglish: true },
  })
  return lockScreenIdentity(settings, locale, fallbackName)
}

export async function updateShopSettings(data: Partial<ShopSettingsInput>): Promise<ShopSetting> {
  const payload = await getPayload({ config })
  return payload.updateGlobal({ slug: 'shop-settings', data })
}

export async function createBusinessLogo(file: BusinessLogoFile, alt: string) {
  const payload = await getPayload({ config })
  return payload.create({
    collection: 'media',
    data: { alt },
    file,
  })
}

export function marketContextFromSettings(settings: Partial<ShopSetting>): MarketContext {
  const legacySaudiConfiguration = Boolean(
    !settings.countryCode &&
      settings.sellerNameEnglish?.trim() &&
      settings.sellerNameArabic?.trim() &&
      settings.businessAddress?.trim() &&
      settings.vatNumber &&
      /^3\d{13}3$/.test(settings.vatNumber),
  )
  const configured = isCountryCode(settings.countryCode) || legacySaudiConfiguration
  const profile = getMarketProfile(settings.countryCode)
  const selected = settings.secondaryLanguage
  const secondaryLanguage: SecondaryLanguage =
    selected === 'ar' || selected === 'bn' || selected === 'none'
      ? selected
      : profile.defaultSecondaryLanguage
  return {
    autoTranslateProducts: settings.autoTranslateProducts !== false,
    configured,
    profile,
    secondaryLanguage,
  }
}

export async function getMarketContext(): Promise<MarketContext> {
  return marketContextFromSettings(await getShopSettings())
}

export async function isCountryLocked(): Promise<boolean> {
  const payload = await getPayload({ config })
  const [invoices, vouchers, payrollEntries, expenses, moneyAccounts] = await Promise.all([
    payload.count({ collection: 'invoices' }),
    payload.count({ collection: 'receipt-vouchers' }),
    payload.count({ collection: 'employee-payroll-entries' }),
    payload.count({ collection: 'expenses', where: { status: { equals: 'confirmed' } } }),
    payload.count({ collection: 'money-accounts', where: { status: { equals: 'confirmed' } } }),
  ])
  return invoices.totalDocs > 0 || vouchers.totalDocs > 0 ||
    payrollEntries.totalDocs > 0 || expenses.totalDocs > 0 || moneyAccounts.totalDocs > 0
}

export function areShopSettingsComplete(settings: Partial<ShopSetting>): boolean {
  if (!settings.countryCode) return marketContextFromSettings(settings).configured
  if (!isCountryCode(settings.countryCode)) return false
  if (!settings.sellerNameEnglish?.trim() || !settings.businessAddress?.trim()) return false
  if (settings.countryCode === 'BD') return true
  return Boolean(
    settings.sellerNameArabic?.trim() &&
      settings.vatNumber &&
      /^3\d{13}3$/.test(settings.vatNumber),
  )
}
