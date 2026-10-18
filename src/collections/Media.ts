import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { APIError, type CollectionConfig } from 'payload'

import { BUSINESS_LOGO_MAX_BYTES, BUSINESS_LOGO_MIME_TYPES } from '@/lib/business-information'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const staticDir = process.env.QUICKPOS_MEDIA_DIR
  ? path.resolve(process.env.QUICKPOS_MEDIA_DIR)
  : path.resolve(dirname, '../../media')

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    defaultColumns: ['filename', 'mimeType', 'filesize', 'createdAt'],
    useAsTitle: 'filename',
  },
  access: {
    create: authenticated,
    delete: () => false,
    read: () => true,
    update: () => false,
  },
  hooks: {
    beforeOperation: [
      ({ operation, req }) => {
        if (
          (operation === 'create' || operation === 'update') &&
          req.file &&
          req.file.size > BUSINESS_LOGO_MAX_BYTES
        ) {
          throw new APIError('Business logos must be 2 MB or smaller.', 400)
        }
      },
    ],
  },
  upload: {
    bulkUpload: false,
    crop: false,
    displayPreview: true,
    focalPoint: false,
    mimeTypes: [...BUSINESS_LOGO_MIME_TYPES],
    pasteURL: false,
    staticDir,
  },
  fields: [{ name: 'alt', type: 'text', required: true, maxLength: 160 }],
}
