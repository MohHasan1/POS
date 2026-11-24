import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const MoneyAccounts: CollectionConfig = {
  slug: 'money-accounts',
  admin: {
    defaultColumns: ['recordNumber', 'direction', 'person', 'recordDate', 'originalAmountMinor'],
    useAsTitle: 'recordNumber',
  },
  access: {
    create: authenticated,
    delete: () => false,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    { name: 'id', type: 'text', required: true, defaultValue: () => randomUUID() },
    { name: 'recordNumber', type: 'text', required: true, unique: true, index: true },
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true },
    {
      name: 'direction',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Owed to us', value: 'owedToUs' },
        { label: 'We owe', value: 'weOwe' },
      ],
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Unpaid invoice', value: 'unpaidInvoice' },
        { label: 'Money lent', value: 'moneyLent' },
        { label: 'Supplier credit', value: 'supplierCredit' },
        { label: 'Borrowed money', value: 'borrowedMoney' },
        { label: 'Other', value: 'other' },
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
      ],
    },
    { name: 'person', type: 'relationship', relationTo: 'money-people', required: true, index: true },
    {
      name: 'personSnapshot',
      type: 'group',
      fields: [
        { name: 'name', type: 'text', required: true, maxLength: 160 },
        { name: 'phone', type: 'text', maxLength: 40 },
      ],
    },
    { name: 'recordDate', type: 'date', required: true, index: true },
    { name: 'dueDate', type: 'date', index: true },
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', unique: true, index: true },
    {
      name: 'products',
      type: 'array',
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        {
          name: 'productSnapshot',
          type: 'group',
          fields: [{ name: 'name', type: 'text', required: true, maxLength: 160 }],
        },
        { name: 'quantityMilliunits', type: 'number', required: true, min: 1 },
        { name: 'unitPriceMinor', type: 'number', min: 0 },
      ],
    },
    { name: 'originalAmountMinor', type: 'number', required: true, min: 1 },
    { name: 'reference', type: 'text', maxLength: 120, index: true },
    { name: 'note', type: 'textarea', maxLength: 500 },
    { name: 'countryCode', type: 'text', required: true },
    { name: 'currencyCode', type: 'text', required: true },
    { name: 'currencyMinorUnitDigits', type: 'number', required: true },
    { name: 'timeZone', type: 'text', required: true },
    { name: 'voidReason', type: 'textarea', maxLength: 500 },
    { name: 'voidedAt', type: 'date' },
  ],
}
