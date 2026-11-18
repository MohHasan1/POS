export type ServiceCardAccent = {
  dark: string
  light: string
  slot: number
}

// Four tone bands across 64 evenly spaced hues provide 256 exact variants.
// Hash collisions use deterministic linear probing, so every invoice visible
// on the same board receives a unique slot while repeated lines from one
// invoice continue to share one color.
export const SERVICE_CARD_COLOR_CAPACITY = 256

const toneBands = [
  { darkLightness: 18, darkSaturation: 62, lightness: 94, saturation: 78 },
  { darkLightness: 22, darkSaturation: 72, lightness: 90, saturation: 86 },
  { darkLightness: 15, darkSaturation: 54, lightness: 96, saturation: 66 },
  { darkLightness: 25, darkSaturation: 80, lightness: 92, saturation: 72 },
] as const

function hashInvoiceId(invoiceId: string): number {
  let hash = 2166136261
  for (const character of invoiceId) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function accentForSlot(slot: number): ServiceCardAccent {
  const hueSlot = slot % 64
  const band = toneBands[Math.floor(slot / 64)]
  // Multiplication by 37 permutes all 64 hue slots and keeps neighboring
  // collision slots visually far apart.
  const hue = ((hueSlot * 37) % 64) * (360 / 64)

  return {
    dark: `hsl(${hue} ${band.darkSaturation}% ${band.darkLightness}%)`,
    light: `hsl(${hue} ${band.saturation}% ${band.lightness}%)`,
    slot,
  }
}

export function buildServiceCardAccents(invoiceIds: Iterable<string>): Map<string, ServiceCardAccent> {
  const uniqueInvoiceIds = [...new Set(invoiceIds)].sort()
  if (uniqueInvoiceIds.length > SERVICE_CARD_COLOR_CAPACITY) {
    throw new Error(
      `Service Board supports up to ${SERVICE_CARD_COLOR_CAPACITY} distinct invoice colors per day.`,
    )
  }

  const accents = new Map<string, ServiceCardAccent>()
  const usedSlots = new Set<number>()

  for (const invoiceId of uniqueInvoiceIds) {
    const startingSlot = hashInvoiceId(invoiceId) % SERVICE_CARD_COLOR_CAPACITY
    let slot = startingSlot
    while (usedSlots.has(slot)) slot = (slot + 1) % SERVICE_CARD_COLOR_CAPACITY
    usedSlots.add(slot)
    accents.set(invoiceId, accentForSlot(slot))
  }

  return accents
}
