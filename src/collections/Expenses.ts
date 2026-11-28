import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'
import { postCashExpense } from '@/services/cash-postings'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const Expenses: CollectionConfig = {
  slug: 'expenses',
  hooks: { afterChange: [postCashExpense] },
  admin: {
    defaultColumns: ['name', 'recordType', 'billDate', 'netMinor', 'paymentStatus', 'status'],
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
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true },
    {
      name: 'recordType',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Fixed recurring bill', value: 'fixed' },
        { label: 'Variable bill', value: 'variable' },
        { label: 'Capital / setup cost', value: 'capital' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'confirmed',
      index: true,
      options: [
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Voided', value: 'voided' },
        { label: 'Skipped', value: 'skipped' },
      ],
    },
    { name: 'template', type: 'relationship', relationTo: 'expense-templates', index: true },
    { name: 'occurrenceKey', type: 'text', unique: true, index: true, maxLength: 220 },
    { name: 'category', type: 'relationship', relationTo: 'expense-categories', index: true },
    {
      name: 'categorySnapshot',
      type: 'group',
      fields: [{ name: 'name', type: 'text', required: true, maxLength: 100 }],
    },
    { name: 'name', type: 'text', required: true, maxLength: 160 },
    { name: 'vendor', type: 'text', maxLength: 160 },
    { name: 'billDate', type: 'date', required: true, index: true },
    { name: 'totalMinor', type: 'number', required: true, min: 0 },
    { name: 'vatMinor', type: 'number', required: true, defaultValue: 0, min: 0 },
    { name: 'netMinor', type: 'number', required: true, min: 0 },
    {
      name: 'paymentStatus',
      type: 'select',
      required: true,
      defaultValue: 'unpaid',
      index: true,
      options: [
        { label: 'Unpaid', value: 'unpaid' },
        { label: 'Paid', value: 'paid' },
      ],
    },
    { name: 'paidAt', type: 'date', index: true },
    { name: 'cashPayment', type: 'relationship', relationTo: 'money-payments', unique: true },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Bank', value: 'bank' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'reference', type: 'text', maxLength: 120 },
    { name: 'note', type: 'textarea', maxLength: 500 },
    { name: 'voidReason', type: 'textarea', maxLength: 500 },
    { name: 'countryCode', type: 'text', required: true },
    { name: 'currencyCode', type: 'text', required: true },
    { name: 'currencyMinorUnitDigits', type: 'number', required: true },
    { name: 'timeZone', type: 'text', required: true },
  ],
}
