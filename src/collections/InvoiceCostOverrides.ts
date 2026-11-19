import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const InvoiceCostOverrides: CollectionConfig = {
  slug: 'invoice-cost-overrides',
  admin: {
    defaultColumns: ['invoice', 'invoiceItemId', 'unitCostMinor', 'totalCostMinor'],
  },
  access: {
    create: authenticated,
    delete: () => false,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    { name: 'id', type: 'text', required: true, defaultValue: () => randomUUID() },
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', required: true, index: true },
    { name: 'invoiceItemId', type: 'text', required: true, unique: true, index: true },
    { name: 'product', type: 'relationship', relationTo: 'products', index: true },
    { name: 'unitCostMinor', type: 'number', required: true, min: 0 },
    { name: 'totalCostMinor', type: 'number', required: true, min: 0 },
    { name: 'note', type: 'textarea', maxLength: 500 },
  ],
}
