import type { GlobalConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const ShopSettings: GlobalConfig = {
  slug: 'shop-settings',
  access: {
    read: authenticated,
    update: authenticated,
  },
  fields: [
    { name: 'sellerNameArabic', type: 'text', required: true },
    { name: 'sellerNameEnglish', type: 'text', required: true },
    {
      name: 'vatNumber',
      type: 'text',
      required: true,
      validate: (value: null | string | undefined) =>
        !value || /^3\d{13}3$/.test(value)
          ? true
          : 'Enter a valid 15-digit Saudi VAT number beginning and ending with 3.',
    },
    { name: 'businessAddress', type: 'textarea', required: true },
    { name: 'defaultPriceIncludesVat', type: 'checkbox', defaultValue: true, required: true },
  ],
}
