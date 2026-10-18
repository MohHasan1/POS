import config from '@payload-config'
import { getPayload } from 'payload'

import type { ShopSetting } from '@/payload-types'

export type BusinessLogoFile = {
  data: Buffer
  mimetype: string
  name: string
  size: number
}

export type ShopSettingsInput = Pick<
  ShopSetting,
  | 'businessAddress'
  | 'additionalTelephone'
  | 'crNumber'
  | 'defaultPriceIncludesVat'
  | 'displayName'
  | 'email'
  | 'logo'
  | 'mobile'
  | 'sellerNameArabic'
  | 'sellerNameEnglish'
  | 'telephone'
  | 'vatNumber'
>

export async function getShopSettings(): Promise<ShopSetting> {
  const payload = await getPayload({ config })
  return payload.findGlobal({ slug: 'shop-settings', depth: 1 })
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

export function areShopSettingsComplete(settings: Partial<ShopSetting>): boolean {
  return Boolean(
    settings.sellerNameArabic?.trim() &&
    settings.sellerNameEnglish?.trim() &&
    settings.businessAddress?.trim() &&
    settings.vatNumber &&
    /^3\d{13}3$/.test(settings.vatNumber),
  )
}
