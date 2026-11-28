import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'

import { cashKinds } from '@/lib/cash'

const deny = () => false

export const CashLedger: CollectionConfig = {
  slug: 'cash-ledger',
  admin: { hidden: true },
  access: { create: deny, read: deny, update: deny, delete: deny },
  fields: [
    { name: 'id', type: 'text', required: true, defaultValue: randomUUID },
    { name: 'kind', type: 'select', required: true, options: [...cashKinds] },
    { name: 'effectiveAt', type: 'date', required: true, index: true },
    { name: 'cashMinor', type: 'number', required: true },
    { name: 'bankMinor', type: 'number', required: true },
    { name: 'countryCode', type: 'text', required: true },
    { name: 'currencyCode', type: 'text', required: true },
    { name: 'note', type: 'textarea', maxLength: 500 },
    { name: 'source', type: 'text', index: true },
    { name: 'activeSource', type: 'text', unique: true },
  ],
}
