import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const ReceiptVouchers: CollectionConfig = {
  slug: 'receipt-vouchers',
  admin: {
    defaultColumns: ['voucherNumber', 'voucherDate', 'receivedFrom', 'amountMinor', 'status'],
    useAsTitle: 'voucherNumber',
  },
  access: {
    create: authenticated,
    delete: () => false,
    read: authenticated,
    update: () => false,
  },
  fields: [
    { name: 'id', type: 'text', required: true, defaultValue: () => randomUUID() },
    { name: 'voucherNumber', type: 'text', required: true, unique: true, index: true },
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true },
    { name: 'voucherDate', type: 'date', required: true, index: true },
    { name: 'issuedAt', type: 'date', index: true },
    { name: 'receivedFrom', type: 'text', required: true },
    { name: 'amountMinor', type: 'number', required: true, min: 1 },
    { name: 'amountWordsEnglish', type: 'textarea', required: true },
    { name: 'amountWordsArabic', type: 'textarea', required: true },
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
        { name: 'bankName', type: 'text' },
        { name: 'transactionReference', type: 'text' },
        { name: 'transferDate', type: 'date' },
        { name: 'chequeNumber', type: 'text' },
        { name: 'chequeDate', type: 'date' },
        { name: 'otherDescription', type: 'text' },
        { name: 'otherReference', type: 'text' },
      ],
    },
    { name: 'purpose', type: 'textarea', required: true },
    { name: 'notes', type: 'textarea' },
    {
      name: 'business',
      type: 'group',
      fields: [
        { name: 'displayName', type: 'text' },
        { name: 'sellerNameArabic', type: 'text', required: true },
        { name: 'sellerNameEnglish', type: 'text', required: true },
        { name: 'crNumber', type: 'text' },
        { name: 'businessAddress', type: 'textarea', required: true },
        { name: 'telephone', type: 'text' },
        { name: 'additionalTelephone', type: 'text' },
        { name: 'mobile', type: 'text' },
        { name: 'email', type: 'email' },
        {
          name: 'logo',
          type: 'group',
          fields: [
            { name: 'mediaId', type: 'number' },
            { name: 'url', type: 'text' },
            { name: 'filename', type: 'text' },
            { name: 'mimeType', type: 'text' },
            { name: 'width', type: 'number' },
            { name: 'height', type: 'number' },
          ],
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Issued', value: 'issued' },
        { label: 'Voided', value: 'voided' },
      ],
    },
    { name: 'voidReason', type: 'textarea' },
    { name: 'voidedAt', type: 'date' },
  ],
}
