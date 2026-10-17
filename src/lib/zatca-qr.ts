const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export type ZatcaQrFields = {
  sellerName: string
  vatNumber: string
  timestamp: string
  total: string
  vatTotal: string
}

function encodeField(tag: number, value: string): Uint8Array {
  const bytes = textEncoder.encode(value)
  if (bytes.length > 255) {
    throw new Error(`ZATCA QR field ${tag} exceeds the Phase 1 TLV length limit.`)
  }

  return Uint8Array.from([tag, bytes.length, ...bytes])
}

export function encodeZatcaQr(fields: ZatcaQrFields): string {
  const values = [
    fields.sellerName,
    fields.vatNumber,
    fields.timestamp,
    fields.total,
    fields.vatTotal,
  ]
  const encoded = values.map((value, index) => encodeField(index + 1, value))
  return Buffer.from(encoded.flatMap((value) => [...value])).toString('base64')
}

export function decodeZatcaQr(payload: string): ZatcaQrFields {
  const bytes = Uint8Array.from(Buffer.from(payload, 'base64'))
  const values = new Map<number, string>()
  let offset = 0

  while (offset < bytes.length) {
    const tag = bytes[offset]
    const length = bytes[offset + 1]
    const start = offset + 2
    const end = start + length
    if (!tag || length === undefined || end > bytes.length) {
      throw new Error('Invalid ZATCA TLV payload.')
    }
    values.set(tag, textDecoder.decode(bytes.slice(start, end)))
    offset = end
  }

  const required = [1, 2, 3, 4, 5].map((tag) => values.get(tag))
  if (required.some((value) => value === undefined)) {
    throw new Error('ZATCA TLV payload is missing a required field.')
  }

  return {
    sellerName: required[0]!,
    vatNumber: required[1]!,
    timestamp: required[2]!,
    total: required[3]!,
    vatTotal: required[4]!,
  }
}
