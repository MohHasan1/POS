import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Invoices } from './collections/Invoices'
import { Media } from './collections/Media'
import { Products } from './collections/Products'
import { Users } from './collections/Users'
import { ShopSettings } from './globals/ShopSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const databaseURL = process.env.DATABASE_URL || 'file:./pos.db'
const payloadSecret = process.env.PAYLOAD_SECRET

if (!payloadSecret) {
  throw new Error('PAYLOAD_SECRET is required.')
}

const db =
  process.env.DATABASE_ADAPTER === 'mongodb'
    ? mongooseAdapter({ url: databaseURL })
    : sqliteAdapter({
        busyTimeout: 5000,
        client: { url: databaseURL },
        migrationDir: path.resolve(dirname, 'migrations'),
        transactionOptions: { behavior: 'immediate' },
        wal: { journalSizeLimit: 67_108_864, synchronous: 'FULL' },
      })

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Products, Invoices, Media],
  globals: [ShopSettings],
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db,
  plugins: [],
  upload: {
    requestSizeLimit: 2_200_000,
    safeFileNames: true,
  },
})
