import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'
import { postCashPayment } from '@/services/cash-postings'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const MoneyPayments: CollectionConfig = {
  slug: 'money-payments',
  hooks: { afterChange: [postCashPayment] },
  admin: {
    defaultColumns: ['account', 'direction', 'paymentDate', 'amountMinor', 'status'],
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
      name: 'account',
      type: 'relationship',
      relationTo: 'money-accounts',
      required: true,
      index: true,
    },
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
      name: 'personSnapshot',
      type: 'group',
      fields: [{ name: 'name', type: 'text', required: true, maxLength: 160 }],
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
    { name: 'paymentDate', type: 'date', required: true, index: true },
    { name: 'amountMinor', type: 'number', required: true, min: 1 },
    {
      name: 'paymentMethod',
      type: 'select',
      required: true,
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Bank transfer', value: 'bank_transfer' },
        { label: 'Cheque', value: 'cheque' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'paymentDetails',
      type: 'group',
      fields: [
        { name: 'bankName', type: 'text', maxLength: 200 },
        { name: 'transactionReference', type: 'text', maxLength: 200 },
        { name: 'transferDate', type: 'date' },
        { name: 'chequeNumber', type: 'text', maxLength: 200 },
        { name: 'chequeDate', type: 'date' },
        { name: 'otherDescription', type: 'text', maxLength: 500 },
        { name: 'otherReference', type: 'text', maxLength: 200 },
      ],
    },
    { name: 'reference', type: 'text', maxLength: 120 },
    { name: 'note', type: 'textarea', maxLength: 500 },
    { name: 'receiptVoucher', type: 'relationship', relationTo: 'receipt-vouchers', unique: true, index: true },
    { name: 'countryCode', type: 'text', required: true },
    { name: 'currencyCode', type: 'text', required: true },
    { name: 'currencyMinorUnitDigits', type: 'number', required: true },
    { name: 'timeZone', type: 'text', required: true },
    { name: 'voidReason', type: 'textarea', maxLength: 500 },
    { name: 'voidedAt', type: 'date' },
  ],
}
