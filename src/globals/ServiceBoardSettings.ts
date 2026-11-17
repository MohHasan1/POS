import type { GlobalConfig } from 'payload'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const ServiceBoardSettings: GlobalConfig = {
  slug: 'service-board-settings',
  label: 'Service Board',
  access: {
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      name: 'columns',
      type: 'array',
      labels: {
        singular: 'Service column',
        plural: 'Service columns',
      },
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
        },
      ],
    },
  ],
}
