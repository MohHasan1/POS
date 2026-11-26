import { Forbidden, type CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || req.user) return data
        // Payload's first-user registration bypasses collection access checks.
        const { getPosAccessStatus, POS_SESSION_COOKIE } = await import('@/services/pos-access')
        const key = `${POS_SESSION_COOKIE}=`
        const token = req.headers.get('cookie')?.split(';').map((cookie) => cookie.trim())
          .find((cookie) => cookie.startsWith(key))?.slice(key.length)
        if (!(await getPosAccessStatus(token, Date.now(), req)).unlocked) {
          throw new Forbidden(req.t)
        }
        return data
      },
    ],
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
