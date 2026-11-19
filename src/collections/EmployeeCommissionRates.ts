import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const EmployeeCommissionRates: CollectionConfig = {
  slug: 'employee-commission-rates',
  admin: {
    defaultColumns: ['employee', 'product', 'rateBps', 'active'],
  },
  access: {
    create: authenticated,
    delete: () => false,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    { name: 'id', type: 'text', required: true, defaultValue: () => randomUUID() },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
      index: true,
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    { name: 'rateBps', type: 'number', required: true, min: 0, max: 10_000 },
    { name: 'active', type: 'checkbox', required: true, defaultValue: true },
  ],
}
