import config from '@payload-config'
import { getPayload } from 'payload'

import type { ShopSetting } from '@/payload-types'

export type ShopSettingsInput = Pick<
  ShopSetting,
  | 'businessAddress'
  | 'defaultPriceIncludesVat'
  | 'sellerNameArabic'
  | 'sellerNameEnglish'
  | 'vatNumber'
>

export async function getShopSettings(): Promise<ShopSetting> {
  const payload = await getPayload({ config })
  return payload.findGlobal({ slug: 'shop-settings' })
}

export async function updateShopSettings(data: ShopSettingsInput): Promise<ShopSetting> {
  const payload = await getPayload({ config })
  return payload.updateGlobal({ slug: 'shop-settings', data })
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
