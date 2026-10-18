import config from '@payload-config'
import { sql, type MigrateUpArgs } from '@payloadcms/db-sqlite'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPayload } from 'payload'

import { up as addBusinessInformation } from '@/migrations/20261017_215421_business_information'
import { up as addBusinessContactsAndLogo } from '@/migrations/20261018_135207_business_contacts_and_logo'
import { up as addReceiptVouchers } from '@/migrations/20261018_140414_receipt_vouchers'

describe('SQLite migration reconciliation', () => {
  it('safely reconciles a schema that Payload already pushed in development', async () => {
    const payload = await getPayload({ config })
    const db = (payload.db as unknown as { drizzle: MigrateUpArgs['db'] }).drizzle
    const args = { db } as MigrateUpArgs

    await addBusinessInformation(args)
    await addBusinessContactsAndLogo(args)
    await addReceiptVouchers(args)

    const { rows } = await db.run(sql`PRAGMA table_info('payload_locked_documents_rels');`)
    const columns = new Set(
      rows.map((row) => String((row as unknown as { name: unknown }).name)),
    )
    assert.equal(columns.has('media_id'), true)
    assert.equal(columns.has('receipt_vouchers_id'), true)
  })
})
