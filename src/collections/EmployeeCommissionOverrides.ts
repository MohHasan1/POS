import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const EmployeeCommissionOverrides: CollectionConfig = {
  slug: 'employee-commission-overrides',
  admin: {
    defaultColumns: ['employee', 'invoice', 'correctedAmountMinor'],
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
      name: 'invoice',
      type: 'relationship',
      relationTo: 'invoices',
      required: true,
      index: true,
    },
    { name: 'invoiceItemId', type: 'text', required: true, unique: true, index: true },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
      index: true,
    },
    {
      name: 'employeeSnapshot',
      type: 'group',
      fields: [{ name: 'name', type: 'text', required: true, maxLength: 160 }],
    },
    { name: 'correctedAmountMinor', type: 'number', required: true, min: 0 },
    { name: 'note', type: 'textarea', maxLength: 500 },
  ],
}
