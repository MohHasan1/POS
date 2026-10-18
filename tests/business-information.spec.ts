import config from '@payload-config'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { getPayload } from 'payload'

import {
  BUSINESS_LOGO_MAX_BYTES,
  createBusinessInformationSnapshot,
  isBusinessLogoMimeType,
} from '@/lib/business-information'
import type { ShopSetting } from '@/payload-types'
import { createBusinessLogo, updateShopSettings } from '@/services/settings'

function settings(overrides: Partial<ShopSetting> = {}): ShopSetting {
  return {
    id: 1,
    businessAddress: 'Riyadh',
    defaultPriceIncludesVat: true,
    sellerNameArabic: 'متجر',
    sellerNameEnglish: 'Shop',
    vatNumber: '310000000000003',
    ...overrides,
  }
}

describe('business information', () => {
  it('builds a stable document snapshot and omits empty optional fields', () => {
    const snapshot = createBusinessInformationSnapshot(
      settings({
        crNumber: ' 1010123456 ',
        email: ' ',
        mobile: '+966 50 123 4567',
        telephone: '',
      }),
    )

    assert.deepEqual(snapshot, {
      businessAddress: 'Riyadh',
      crNumber: '1010123456',
      mobile: '+966 50 123 4567',
      sellerNameArabic: 'متجر',
      sellerNameEnglish: 'Shop',
    })
  })

  it('captures populated immutable logo details', () => {
    const snapshot = createBusinessInformationSnapshot(
      settings({
        logo: {
          id: 7,
          alt: 'Shop logo',
          createdAt: '2026-10-18T00:00:00.000Z',
          updatedAt: '2026-10-18T00:00:00.000Z',
          filename: 'shop.png',
          height: 120,
          mimeType: 'image/png',
          url: '/api/media/file/shop.png',
          width: 240,
        },
      }),
    )

    assert.deepEqual(snapshot.logo, {
      filename: 'shop.png',
      height: 120,
      id: 7,
      mimeType: 'image/png',
      url: '/api/media/file/shop.png',
      width: 240,
    })
  })

  it('allows only the configured raster formats and caps logos at 2 MB', () => {
    assert.equal(BUSINESS_LOGO_MAX_BYTES, 2_097_152)
    assert.equal(isBusinessLogoMimeType('image/jpeg'), true)
    assert.equal(isBusinessLogoMimeType('image/png'), true)
    assert.equal(isBusinessLogoMimeType('image/webp'), true)
    assert.equal(isBusinessLogoMimeType('image/svg+xml'), false)
  })

  it('persists a logo through Payload media and relates it to the existing Global', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const logo = await createBusinessLogo(
      { data: png, mimetype: 'image/png', name: 'test-logo.png', size: png.length },
      'Test business logo',
    )

    await updateShopSettings({
      additionalTelephone: '+966 11 000 0001',
      businessAddress: 'Riyadh',
      crNumber: '1010123456',
      defaultPriceIncludesVat: true,
      displayName: 'Test Shop',
      email: 'accounts@example.com',
      logo: logo.id,
      mobile: '+966 50 123 4567',
      sellerNameArabic: 'متجر الاختبار',
      sellerNameEnglish: 'Test Shop',
      telephone: '+966 11 000 0000',
      vatNumber: '310000000000003',
    })

    const payload = await getPayload({ config })
    const saved = await payload.findGlobal({ slug: 'shop-settings', depth: 1 })
    const savedLogo = saved.logo && typeof saved.logo === 'object' ? saved.logo : undefined
    const mediaDirectory = path.resolve(process.env.QUICKPOS_MEDIA_DIR || './test-media')

    assert.equal(saved.crNumber, '1010123456')
    assert.equal(saved.telephone, '+966 11 000 0000')
    assert.equal(saved.additionalTelephone, '+966 11 000 0001')
    assert.equal(saved.mobile, '+966 50 123 4567')
    assert.equal(saved.email, 'accounts@example.com')
    assert.equal(savedLogo?.id, logo.id)
    assert.ok(savedLogo?.filename)
    assert.ok(existsSync(path.join(mediaDirectory, savedLogo.filename)))
    assert.deepEqual(readFileSync(path.join(mediaDirectory, savedLogo.filename)), png)

    await updateShopSettings({ logo: null })
    await payload.delete({ collection: 'media', id: logo.id })
  })
})
