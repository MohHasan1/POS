import type { CollectionConfig } from 'payload'
import { randomUUID } from 'node:crypto'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const Invoices: CollectionConfig = {
  slug: 'invoices',
  admin: {
    defaultColumns: ['invoiceNumber', 'invoiceType', 'issuedAt', 'totalMinor'],
    useAsTitle: 'invoiceNumber',
  },
  access: {
    create: authenticated,
    delete: () => false,
    read: authenticated,
    update: () => false,
  },
  fields: [
    { name: 'id', type: 'text', required: true, defaultValue: () => randomUUID() },
    { name: 'invoiceNumber', type: 'text', required: true, unique: true, index: true },
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true },
    {
      name: 'invoiceType',
      type: 'select',
      required: true,
      options: [
        { label: 'Sales Invoice', value: 'sales' },
        { label: 'Simplified Tax Invoice', value: 'simplified' },
        { label: 'Standard Tax Invoice', value: 'standard' },
      ],
    },
    { name: 'countryCode', type: 'text', defaultValue: 'SA' },
    { name: 'currencyCode', type: 'text', defaultValue: 'SAR' },
    { name: 'currencyMinorUnitDigits', type: 'number', defaultValue: 2 },
    { name: 'timeZone', type: 'text', defaultValue: 'Asia/Riyadh' },
    { name: 'taxMode', type: 'text', defaultValue: 'saudiVat' },
    { name: 'documentLanguage', type: 'text', defaultValue: 'ar' },
    { name: 'secondaryLanguage', type: 'text', defaultValue: 'ar' },
    {
      name: 'salesChannel',
      type: 'select',
      defaultValue: 'checkout',
      required: true,
      options: [
        { label: 'Checkout', value: 'checkout' },
        { label: 'Service Board', value: 'serviceBoard' },
      ],
    },
    { name: 'issuedAt', type: 'date', required: true, index: true },
    {
      name: 'seller',
      type: 'group',
      fields: [
        { name: 'nameArabic', type: 'text' },
        { name: 'nameBangla', type: 'text' },
        { name: 'nameEnglish', type: 'text', required: true },
        { name: 'vatNumber', type: 'text' },
        { name: 'address', type: 'textarea', required: true },
        {
          name: 'registrations',
          type: 'array',
          fields: [
            { name: 'type', type: 'text', required: true },
            { name: 'value', type: 'text', required: true },
          ],
        },
      ],
    },
    {
      name: 'buyer',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'address', type: 'textarea' },
        { name: 'vatNumber', type: 'text' },
        { name: 'identification', type: 'text' },
      ],
    },
    {
      name: 'serviceBoardDetails',
      type: 'group',
      fields: [
        { name: 'customerName', type: 'text', maxLength: 160 },
        { name: 'customerPhone', type: 'text', maxLength: 40 },
        { name: 'note', type: 'textarea', maxLength: 500 },
      ],
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products' },
        { name: 'descriptionEnglish', type: 'text', required: true },
        { name: 'descriptionBangla', type: 'text' },
        { name: 'descriptionArabic', type: 'text' },
        {
          name: 'translations',
          type: 'array',
          fields: [
            { name: 'language', type: 'text', required: true },
            { name: 'name', type: 'text', required: true },
          ],
        },
        { name: 'quantityMilliunits', type: 'number', required: true, min: 1 },
        { name: 'unitPriceMinor', type: 'number', required: true, min: 0 },
        { name: 'priceIncludesVat', type: 'checkbox', required: true },
        {
          name: 'vatCategory',
          type: 'select',
          required: true,
          options: [
            { label: 'Standard rated', value: 'standard' },
            { label: 'Zero rated', value: 'zero' },
            { label: 'Exempt', value: 'exempt' },
          ],
        },
        { name: 'vatRateBps', type: 'number', required: true, min: 0 },
        { name: 'netMinor', type: 'number', required: true, min: 0 },
        { name: 'vatMinor', type: 'number', required: true, min: 0 },
        { name: 'totalMinor', type: 'number', required: true, min: 0 },
      ],
    },
    { name: 'subtotalMinor', type: 'number', required: true, min: 0 },
    { name: 'vatMinor', type: 'number', required: true, min: 0 },
    { name: 'totalMinor', type: 'number', required: true, min: 0 },
    { name: 'qrPayload', type: 'textarea' },
  ],
}
