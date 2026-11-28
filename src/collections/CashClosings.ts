import type { CollectionConfig } from 'payload'

const deny = () => false

export const CashClosings: CollectionConfig = {
  slug: 'cash-closings',
  admin: { hidden: true },
  access: { create: deny, read: deny, update: deny, delete: deny },
  fields: [
    { name: 'id', type: 'text', required: true },
    { name: 'requestId', type: 'text', required: true },
    { name: 'lastEditRequestId', type: 'text' },
    { name: 'businessDate', type: 'text', required: true },
    { name: 'closedAt', type: 'date', required: true },
    { name: 'expectedCashMinor', type: 'number', required: true },
    { name: 'actualCashMinor', type: 'number', required: true, min: 0 },
    { name: 'ownerPickupMinor', type: 'number', required: true, min: 0 },
    { name: 'nextDayCashMinor', type: 'number', min: 0 },
    { name: 'expectedBankMinor', type: 'number' },
    { name: 'actualBankMinor', type: 'number' },
    { name: 'bankPickupMinor', type: 'number', min: 0 },
    { name: 'note', type: 'textarea', maxLength: 500 },
    { name: 'countryCode', type: 'text', required: true },
    { name: 'currencyCode', type: 'text', required: true },
    { name: 'timeZone', type: 'text', required: true },
  ],
}
