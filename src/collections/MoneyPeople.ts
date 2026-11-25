import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const MoneyPeople: CollectionConfig = {
  slug: 'money-people',
  admin: {
    defaultColumns: ['name', 'phone', 'email', 'active'],
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
    { name: 'name', type: 'text', required: true, maxLength: 160, index: true },
    { name: 'phone', type: 'text', maxLength: 40, index: true },
    { name: 'email', type: 'email', index: true },
    { name: 'address', type: 'textarea', maxLength: 300 },
    { name: 'note', type: 'textarea', maxLength: 500 },
    { name: 'active', type: 'checkbox', required: true, defaultValue: true, index: true },
  ],
}
