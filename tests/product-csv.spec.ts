import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parseProductsCsv,
  ProductCsvError,
  serializeProductsCsv,
} from '@/lib/product-csv'

describe('product CSV transfer', () => {
  it('round-trips multilingual product data and quoted values', () => {
    const products = [
      {
        active: true,
        nameArabic: 'زيت الطبخ',
        nameBangla: 'রান্নার তেল',
        nameEnglish: 'Cooking Oil, "Large"',
        priceIncludesVat: true,
        priceMinor: 2_575,
        sku: 'OIL-1',
        vatCategory: 'standard' as const,
      },
    ]

    const csv = serializeProductsCsv(products)
    assert.equal(csv.startsWith('\uFEFFnameEnglish,nameArabic'), true)
    assert.deepEqual(parseProductsCsv(csv), products)
  })

  it('accepts reordered columns and common boolean values', () => {
    const csv = [
      'sku,active,nameEnglish,nameArabic,nameBangla,price,vatCategory,priceIncludesVat',
      'TEA-1,yes,Tea,شاي,,10.50,zero,1',
    ].join('\n')

    assert.deepEqual(parseProductsCsv(csv), [
      {
        active: true,
        nameArabic: 'شاي',
        nameBangla: undefined,
        nameEnglish: 'Tea',
        priceIncludesVat: true,
        priceMinor: 1_050,
        sku: 'TEA-1',
        vatCategory: 'zero',
      },
    ])
  })

  it('rejects duplicate SKUs before any database writes', () => {
    const csv = [
      'nameEnglish,nameArabic,nameBangla,sku,price,vatCategory,priceIncludesVat,active',
      'Tea,شاي,,TEA-1,10,standard,true,true',
      'Tea 2,شاي ٢,,TEA-1,12,standard,true,true',
    ].join('\n')

    assert.throws(
      () => parseProductsCsv(csv),
      (error) => error instanceof ProductCsvError && error.message.includes('duplicate SKU'),
    )
  })

  it('reports the row containing invalid product data', () => {
    const csv = [
      'nameEnglish,nameArabic,nameBangla,sku,price,vatCategory,priceIncludesVat,active',
      'Tea,شاي,,TEA-1,10.999,standard,true,true',
    ].join('\n')

    assert.throws(
      () => parseProductsCsv(csv),
      (error) => error instanceof ProductCsvError && error.message.startsWith('Row 2:'),
    )
  })

  it('rejects files with missing required columns', () => {
    assert.throws(
      () => parseProductsCsv('nameEnglish,nameArabic\nTea,شاي'),
      (error) =>
        error instanceof ProductCsvError && error.message.includes('Missing required column'),
    )
  })
})
