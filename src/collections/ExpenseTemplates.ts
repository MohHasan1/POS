import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const ExpenseTemplates: CollectionConfig = {
  slug: 'expense-templates',
  admin: {
    defaultColumns: ['name', 'category', 'frequency', 'active'],
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
      name: 'category',
      type: 'relationship',
      relationTo: 'expense-categories',
      required: true,
      index: true,
    },
    { name: 'vendor', type: 'text', maxLength: 160 },
    { name: 'defaultTotalMinor', type: 'number', required: true, min: 1 },
    { name: 'defaultVatMinor', type: 'number', defaultValue: 0, required: true, min: 0 },
    {
      name: 'frequency',
      type: 'select',
      required: true,
      options: [
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' },
      ],
    },
    { name: 'weeklyDay', type: 'number', min: 0, max: 6 },
    { name: 'monthlyDay', type: 'number', min: 1, max: 31 },
    { name: 'yearlyMonth', type: 'number', min: 1, max: 12 },
    { name: 'yearlyDay', type: 'number', min: 1, max: 31 },
    { name: 'startDate', type: 'date', required: true, index: true },
    { name: 'endDate', type: 'date', index: true },
    { name: 'note', type: 'textarea', maxLength: 500 },
    { name: 'active', type: 'checkbox', defaultValue: true, required: true },
  ],
}
