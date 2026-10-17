import type { CollectionConfig } from 'payload'
import { randomUUID } from 'node:crypto'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    defaultColumns: ['nameEnglish', 'sku', 'priceMinor', 'vatCategory', 'active'],
    useAsTitle: 'nameEnglish',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    { name: 'id', type: 'text', required: true, defaultValue: () => randomUUID() },
    { name: 'nameEnglish', type: 'text', required: true },
    { name: 'nameBangla', type: 'text' },
    { name: 'nameArabic', type: 'text', required: true },
    { name: 'sku', type: 'text', unique: true },
    {
      name: 'priceMinor',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Selling price in halalas.' },
    },
    {
      name: 'vatCategory',
      type: 'select',
      defaultValue: 'standard',
      required: true,
      options: [
        { label: 'Standard rated (15%)', value: 'standard' },
        { label: 'Zero rated', value: 'zero' },
        { label: 'Exempt', value: 'exempt' },
      ],
    },
    { name: 'priceIncludesVat', type: 'checkbox', defaultValue: true, required: true },
    { name: 'active', type: 'checkbox', defaultValue: true, required: true },
  ],
}
