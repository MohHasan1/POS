import type { Media, ShopSetting } from '@/payload-types'

export const BUSINESS_LOGO_MAX_BYTES = 2 * 1024 * 1024
export const BUSINESS_LOGO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type BusinessLogoSnapshot = {
  filename: string
  id: number
  mimeType: string
  url: string
  height?: number | null
  width?: number | null
}

export type BusinessInformationSnapshot = {
  businessAddress: string
  sellerNameArabic: string
  sellerNameEnglish: string
  additionalTelephone?: string
  crNumber?: string
  displayName?: string
  email?: string
  logo?: BusinessLogoSnapshot
  mobile?: string
  telephone?: string
}

function optionalValue(value: null | string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function getBusinessLogo(settings: Pick<ShopSetting, 'logo'>): Media | undefined {
  return settings.logo && typeof settings.logo === 'object' ? settings.logo : undefined
}

export function isBusinessLogoMimeType(value: string): boolean {
  return (BUSINESS_LOGO_MIME_TYPES as readonly string[]).includes(value)
}

/**
 * Produces the immutable business-details shape that finalized business documents should store.
 * Optional empty values are deliberately omitted so document headers can render only available data.
 */
export function createBusinessInformationSnapshot(
  settings: ShopSetting,
): BusinessInformationSnapshot {
  const logo = getBusinessLogo(settings)
  const additionalTelephone = optionalValue(settings.additionalTelephone)
  const crNumber = optionalValue(settings.crNumber)
  const displayName = optionalValue(settings.displayName)
  const email = optionalValue(settings.email)
  const mobile = optionalValue(settings.mobile)
  const telephone = optionalValue(settings.telephone)

  return {
    businessAddress: settings.businessAddress,
    sellerNameArabic: settings.sellerNameArabic,
    sellerNameEnglish: settings.sellerNameEnglish,
    ...(additionalTelephone && { additionalTelephone }),
    ...(crNumber && { crNumber }),
    ...(displayName && { displayName }),
    ...(email && { email }),
    ...(logo?.url && logo.filename && logo.mimeType
      ? {
          logo: {
            filename: logo.filename,
            height: logo.height,
            id: logo.id,
            mimeType: logo.mimeType,
            url: logo.url,
            width: logo.width,
          },
        }
      : {}),
    ...(mobile && { mobile }),
    ...(telephone && { telephone }),
  }
}
