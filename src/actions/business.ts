'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { ActionResult } from './products'
import { BUSINESS_LOGO_MAX_BYTES, isBusinessLogoMimeType } from '@/lib/business-information'
import { createBusinessLogo, updateShopSettings } from '@/services/settings'

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null)

const businessInformationSchema = z.object({
  displayName: z.string().trim().min(1, 'Shop display name is required.').max(120),
  sellerNameArabic: z.string().trim().min(1, 'Arabic seller name is required.').max(160),
  sellerNameEnglish: z.string().trim().min(1, 'English seller name is required.').max(160),
  crNumber: optionalText(50),
  vatNumber: z
    .string()
    .trim()
    .regex(/^3\d{13}3$/, 'Enter a valid 15-digit Saudi VAT number beginning and ending with 3.'),
  businessAddress: z.string().trim().min(1, 'Business address is required.').max(500),
  telephone: optionalText(40),
  additionalTelephone: optionalText(40),
  mobile: optionalText(40),
  email: z
    .union([z.literal(''), z.string().trim().email('Enter a valid email address.').max(254)])
    .transform((value) => value || null),
})

export type BusinessInformationActionInput = z.input<typeof businessInformationSchema>

export async function updateBusinessInformationAction(formData: FormData): Promise<ActionResult> {
  const parsed = businessInformationSchema.safeParse({
    displayName: String(formData.get('displayName') || ''),
    sellerNameEnglish: String(formData.get('sellerNameEnglish') || ''),
    sellerNameArabic: String(formData.get('sellerNameArabic') || ''),
    crNumber: String(formData.get('crNumber') || ''),
    vatNumber: String(formData.get('vatNumber') || ''),
    businessAddress: String(formData.get('businessAddress') || ''),
    telephone: String(formData.get('telephone') || ''),
    additionalTelephone: String(formData.get('additionalTelephone') || ''),
    mobile: String(formData.get('mobile') || ''),
    email: String(formData.get('email') || ''),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  try {
    const logoEntry = formData.get('logo')
    let logo: number | null | undefined

    if (logoEntry && typeof logoEntry !== 'string' && logoEntry.size > 0) {
      if (logoEntry.size > BUSINESS_LOGO_MAX_BYTES) {
        return { ok: false, error: 'Business logos must be 2 MB or smaller.' }
      }
      if (!isBusinessLogoMimeType(logoEntry.type)) {
        return { ok: false, error: 'Use a JPEG, PNG, or WebP image for the business logo.' }
      }

      const extension =
        logoEntry.type === 'image/jpeg' ? 'jpg' : logoEntry.type === 'image/png' ? 'png' : 'webp'

      const uploadedLogo = await createBusinessLogo(
        {
          data: Buffer.from(await logoEntry.arrayBuffer()),
          mimetype: logoEntry.type,
          name: `business-logo-${randomUUID()}.${extension}`,
          size: logoEntry.size,
        },
        `${parsed.data.displayName} logo`,
      )
      logo = uploadedLogo.id
    } else if (formData.get('removeLogo') === 'true') {
      logo = null
    }

    await updateShopSettings({
      ...parsed.data,
      ...(logo !== undefined ? { logo } : {}),
    })
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to save business information.',
    }
  }
}
