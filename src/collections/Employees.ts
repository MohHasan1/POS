import type { CollectionConfig } from 'payload'
import { randomUUID } from 'node:crypto'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const Employees: CollectionConfig = {
  slug: 'employees',
  admin: {
    defaultColumns: ['name', 'employeeCode', 'role', 'active'],
    useAsTitle: 'name',
  },
  access: {
    create: authenticated,
    delete: () => false,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    { name: 'id', type: 'text', required: true, defaultValue: () => randomUUID() },
    { name: 'name', type: 'text', required: true, maxLength: 160 },
    {
      name: 'employeeCode',
      type: 'text',
      unique: true,
      index: true,
      maxLength: 40,
      defaultValue: () =>
        `EMP-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`,
    },
    { name: 'phone', type: 'text', maxLength: 40 },
    { name: 'email', type: 'email' },
    { name: 'role', type: 'text', maxLength: 100 },
    { name: 'address', type: 'textarea', maxLength: 500 },
    { name: 'notes', type: 'textarea', maxLength: 500 },
    { name: 'active', type: 'checkbox', defaultValue: true, required: true },
  ],
}
