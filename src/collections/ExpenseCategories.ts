import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const ExpenseCategories: CollectionConfig = {
  slug: 'expense-categories',
  admin: {
    defaultColumns: ['name', 'active'],
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
    { name: 'name', type: 'text', required: true, unique: true, index: true, maxLength: 100 },
    { name: 'description', type: 'textarea', maxLength: 300 },
    { name: 'active', type: 'checkbox', defaultValue: true, required: true },
  ],
}
