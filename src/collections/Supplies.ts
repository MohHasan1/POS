import type { CollectionConfig } from 'payload'

import {
  SUPPLY_LABEL_LIMIT,
  SUPPLY_NAME_LIMIT,
  SUPPLY_NOTES_LIMIT,
  SUPPLY_VENDOR_LIMIT,
} from '@/lib/supplies'

const deny = () => false
const internal = { create: deny, read: deny, update: deny, delete: deny }

export const Supplies: CollectionConfig = {
  slug: 'supplies',
  admin: { hidden: true },
  access: internal,
  fields: [
    { name: 'id', type: 'text', required: true },
    { name: 'name', type: 'text', required: true, maxLength: SUPPLY_NAME_LIMIT },
    { name: 'archived', type: 'checkbox', defaultValue: false, required: true, index: true },
    { name: 'expectedLifespanDays', type: 'number', min: 1 },
    { name: 'defaultUnitCostMinor', type: 'number', min: 0 },
  ],
}

export const SupplyUsages: CollectionConfig = {
  slug: 'supply-usages',
  admin: { hidden: true },
  access: internal,
  fields: [
    { name: 'id', type: 'text', required: true },
    { name: 'supply', type: 'relationship', relationTo: 'supplies', required: true, index: true },
    { name: 'purchase', type: 'relationship', relationTo: 'supply-purchases', index: true },
    { name: 'label', type: 'text', maxLength: SUPPLY_LABEL_LIMIT },
    { name: 'startedOn', type: 'text', required: true },
    { name: 'finishedOn', type: 'text', index: true },
    { name: 'vendor', type: 'text', maxLength: SUPPLY_VENDOR_LIMIT },
    { name: 'notes', type: 'textarea', maxLength: SUPPLY_NOTES_LIMIT },
    { name: 'expectedLifespanDays', type: 'number', min: 1 },
    { name: 'unitCostMinor', type: 'number', min: 0 },
    { name: 'costCurrencyCode', type: 'select', options: ['SAR', 'BDT'] },
  ],
}

export const SupplyPurchases: CollectionConfig = {
  slug: 'supply-purchases',
  admin: { hidden: true },
  access: internal,
  fields: [
    { name: 'id', type: 'text', required: true },
    { name: 'supply', type: 'relationship', relationTo: 'supplies', required: true, index: true },
    { name: 'name', type: 'text', required: true, maxLength: SUPPLY_LABEL_LIMIT },
    { name: 'purchasedOn', type: 'text', required: true, index: true },
    { name: 'quantity', type: 'number', required: true, min: 1 },
    { name: 'remainingQuantity', type: 'number', required: true, min: 0 },
    { name: 'unitCostMinor', type: 'number', min: 0 },
    { name: 'costCurrencyCode', type: 'select', options: ['SAR', 'BDT'] },
    { name: 'vendor', type: 'text', maxLength: SUPPLY_VENDOR_LIMIT },
    { name: 'notes', type: 'textarea', maxLength: SUPPLY_NOTES_LIMIT },
    { name: 'expense', type: 'relationship', relationTo: 'expenses', unique: true },
  ],
}
