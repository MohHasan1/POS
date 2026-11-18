import type { GlobalConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const ShopSettings: GlobalConfig = {
  slug: 'shop-settings',
  label: 'Business Information',
  access: {
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      name: 'countryCode',
      type: 'select',
      options: [
        { label: 'Saudi Arabia', value: 'SA' },
        { label: 'Bangladesh', value: 'BD' },
      ],
    },
    {
      name: 'secondaryLanguage',
      type: 'select',
      options: [
        { label: 'Arabic', value: 'ar' },
        { label: 'Bangla', value: 'bn' },
        { label: 'None', value: 'none' },
      ],
    },
    { name: 'autoTranslateProducts', type: 'checkbox', defaultValue: true },
    {
      name: 'displayName',
      type: 'text',
      admin: {
        description:
          'The shop name shown in the POS interface. Legal invoice names are stored separately.',
      },
    },
    { name: 'sellerNameArabic', type: 'text' },
    { name: 'sellerNameBangla', type: 'text' },
    { name: 'sellerNameEnglish', type: 'text', required: true },
    { name: 'crNumber', type: 'text', maxLength: 50 },
    {
      name: 'vatNumber',
      type: 'text',
      validate: (value: null | string | undefined) =>
        !value || /^3\d{13}3$/.test(value)
          ? true
          : 'Enter a valid 15-digit Saudi VAT number beginning and ending with 3.',
    },
    { name: 'tradeLicenseNumber', type: 'text', maxLength: 50 },
    { name: 'tinNumber', type: 'text', maxLength: 50 },
    { name: 'binNumber', type: 'text', maxLength: 50 },
    {
      name: 'registrations',
      type: 'array',
      fields: [
        { name: 'type', type: 'text', required: true, maxLength: 40 },
        { name: 'value', type: 'text', required: true, maxLength: 80 },
      ],
    },
    { name: 'businessAddress', type: 'textarea', required: true },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional business logo used on non-tax business documents.' },
    },
    { name: 'telephone', type: 'text', maxLength: 40 },
    { name: 'additionalTelephone', type: 'text', maxLength: 40 },
    { name: 'mobile', type: 'text', maxLength: 40 },
    {
      name: 'email',
      type: 'email',
      validate: (value: null | string | undefined) =>
        !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? true : 'Enter a valid email address.',
    },
    { name: 'defaultPriceIncludesVat', type: 'checkbox', defaultValue: false, required: true },
  ],
}
