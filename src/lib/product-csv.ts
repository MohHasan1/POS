import { decimalToMinor, minorToDecimal } from '@/lib/money'

export const productCsvHeaders = [
  'nameEnglish',
  'nameArabic',
  'nameBangla',
  'sku',
  'price',
  'vatCategory',
  'priceIncludesVat',
  'active',
] as const

export type ProductCsvRow = {
  active: boolean
  nameArabic: string
  nameBangla?: null | string
  nameEnglish: string
  priceIncludesVat: boolean
  priceMinor: number
  sku?: null | string
  vatCategory: 'exempt' | 'standard' | 'zero'
}

export class ProductCsvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProductCsvError'
  }
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function serializeProductsCsv(products: readonly ProductCsvRow[]): string {
  const rows = products.map((product) =>
    [
      product.nameEnglish,
      product.nameArabic,
      product.nameBangla || '',
      product.sku || '',
      minorToDecimal(product.priceMinor),
      product.vatCategory,
      String(product.priceIncludesVat),
      String(product.active),
    ]
      .map(escapeCsvField)
      .join(','),
  )

  return `\uFEFF${productCsvHeaders.join(',')}\r\n${rows.join('\r\n')}${rows.length ? '\r\n' : ''}`
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false
  let quoteClosed = false

  function finishField() {
    record.push(field)
    field = ''
    quoteClosed = false
  }

  function finishRecord() {
    finishField()
    if (record.some((value) => value.trim())) records.push(record)
    record = []
  }

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]

    if (inQuotes) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
          quoteClosed = true
        }
      } else {
        field += character
      }
      continue
    }

    if (quoteClosed && character !== ',' && character !== '\n' && character !== '\r') {
      throw new ProductCsvError('The CSV contains text after a closing quote.')
    }

    if (character === '"') {
      if (field) throw new ProductCsvError('The CSV contains an unexpected quote.')
      inQuotes = true
    } else if (character === ',') {
      finishField()
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index += 1
      finishRecord()
    } else {
      field += character
    }
  }

  if (inQuotes) throw new ProductCsvError('The CSV contains an unclosed quoted value.')
  if (field || record.length) finishRecord()

  return records
}

function requiredText(value: string, label: string, rowNumber: number): string {
  const result = value.trim()
  if (!result) throw new ProductCsvError(`Row ${rowNumber}: ${label} is required.`)
  if (result.length > 160) {
    throw new ProductCsvError(`Row ${rowNumber}: ${label} must be 160 characters or fewer.`)
  }
  return result
}

function optionalText(value: string, label: string, rowNumber: number): string | undefined {
  const result = value.trim()
  if (result.length > 160) {
    throw new ProductCsvError(`Row ${rowNumber}: ${label} must be 160 characters or fewer.`)
  }
  return result || undefined
}

function parseBoolean(value: string, label: string, rowNumber: number): boolean {
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes'].includes(normalized)) return true
  if (['0', 'false', 'no'].includes(normalized)) return false
  throw new ProductCsvError(`Row ${rowNumber}: ${label} must be true or false.`)
}

function parseVatCategory(value: string, rowNumber: number): ProductCsvRow['vatCategory'] {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'standard' || normalized === 'zero' || normalized === 'exempt') {
    return normalized
  }
  throw new ProductCsvError(
    `Row ${rowNumber}: vatCategory must be standard, zero, or exempt.`,
  )
}

export function parseProductsCsv(csv: string, maxRows = 2_500): ProductCsvRow[] {
  const records = parseCsvRecords(csv)
  if (!records.length) throw new ProductCsvError('The CSV file is empty.')

  const headers = records[0].map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim(),
  )
  if (new Set(headers).size !== headers.length) {
    throw new ProductCsvError('The CSV contains duplicate column names.')
  }

  for (const requiredHeader of productCsvHeaders) {
    if (!headers.includes(requiredHeader)) {
      throw new ProductCsvError(`Missing required column: ${requiredHeader}.`)
    }
  }

  const dataRecords = records.slice(1)
  if (!dataRecords.length) throw new ProductCsvError('The CSV contains no product rows.')
  if (dataRecords.length > maxRows) {
    throw new ProductCsvError(`The CSV can contain at most ${maxRows} products.`)
  }

  const headerIndexes = new Map(headers.map((header, index) => [header, index]))
  const seenSkus = new Set<string>()

  return dataRecords.map((record, index) => {
    const rowNumber = index + 2
    if (record.length !== headers.length) {
      throw new ProductCsvError(`Row ${rowNumber}: the number of values does not match the header.`)
    }

    const value = (header: (typeof productCsvHeaders)[number]) =>
      record[headerIndexes.get(header)!]
    const sku = optionalText(value('sku'), 'sku', rowNumber)
    if (sku && seenSkus.has(sku)) {
      throw new ProductCsvError(`Row ${rowNumber}: duplicate SKU ${sku}.`)
    }
    if (sku) seenSkus.add(sku)

    const priceMinor = decimalToMinor(value('price'))
    if (priceMinor === null || priceMinor > 100_000_000) {
      throw new ProductCsvError(
        `Row ${rowNumber}: price must be between 0 and 1000000 with up to two decimals.`,
      )
    }

    return {
      active: parseBoolean(value('active'), 'active', rowNumber),
      nameArabic: requiredText(value('nameArabic'), 'nameArabic', rowNumber),
      nameBangla: optionalText(value('nameBangla'), 'nameBangla', rowNumber),
      nameEnglish: requiredText(value('nameEnglish'), 'nameEnglish', rowNumber),
      priceIncludesVat: parseBoolean(
        value('priceIncludesVat'),
        'priceIncludesVat',
        rowNumber,
      ),
      priceMinor,
      sku,
      vatCategory: parseVatCategory(value('vatCategory'), rowNumber),
    }
  })
}
