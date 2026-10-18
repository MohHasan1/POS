import config from '@payload-config'
import { createClient } from '@libsql/client'
import { sql, type MigrateUpArgs } from '@payloadcms/db-sqlite'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { drizzle } from 'drizzle-orm/libsql'
import { getPayload } from 'payload'

import { up as addBusinessInformation } from '@/migrations/20261017_215421_business_information'
import { up as addBusinessContactsAndLogo } from '@/migrations/20261018_135207_business_contacts_and_logo'
import { up as addReceiptVouchers } from '@/migrations/20261018_140414_receipt_vouchers'
import { up as addReceiptVoucherStatusWorkflow } from '@/migrations/20261018_143226_receipt_voucher_status_workflow'

describe('SQLite migration reconciliation', () => {
  it('safely reconciles a schema that Payload already pushed in development', async () => {
    const payload = await getPayload({ config })
    const db = (payload.db as unknown as { drizzle: MigrateUpArgs['db'] }).drizzle
    const args = { db } as MigrateUpArgs

    await addBusinessInformation(args)
    await addBusinessContactsAndLogo(args)
    await addReceiptVouchers(args)

    const { rows } = await db.run(sql`PRAGMA table_info('payload_locked_documents_rels');`)
    const columns = new Set(rows.map((row) => String((row as unknown as { name: unknown }).name)))
    assert.equal(columns.has('media_id'), true)
    assert.equal(columns.has('receipt_vouchers_id'), true)
  })

  it('migrates legacy Active and Void vouchers without changing document data', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'quickpos-voucher-migration-'))
    const client = createClient({ url: `file:${path.join(directory, 'legacy.db')}` })
    const database = drizzle(client)
    const db = database as unknown as MigrateUpArgs['db']
    const args = { db } as MigrateUpArgs

    try {
      await db.run(sql`CREATE TABLE \`receipt_vouchers\` (
        \`id\` text PRIMARY KEY NOT NULL, \`voucher_number\` text NOT NULL,
        \`idempotency_key\` text NOT NULL, \`issued_at\` text NOT NULL, \`received_from\` text NOT NULL,
        \`amount_minor\` numeric NOT NULL, \`amount_words_english\` text NOT NULL,
        \`amount_words_arabic\` text NOT NULL, \`payment_method\` text NOT NULL,
        \`payment_details_bank_name\` text, \`payment_details_transaction_reference\` text,
        \`payment_details_transfer_date\` text, \`payment_details_cheque_number\` text,
        \`payment_details_cheque_date\` text, \`payment_details_other_description\` text,
        \`payment_details_other_reference\` text, \`purpose\` text NOT NULL, \`notes\` text,
        \`business_display_name\` text, \`business_seller_name_arabic\` text NOT NULL,
        \`business_seller_name_english\` text NOT NULL, \`business_cr_number\` text,
        \`business_business_address\` text NOT NULL, \`business_telephone\` text,
        \`business_additional_telephone\` text, \`business_mobile\` text, \`business_email\` text,
        \`business_logo_media_id\` numeric, \`business_logo_url\` text, \`business_logo_filename\` text,
        \`business_logo_mime_type\` text, \`business_logo_width\` numeric, \`business_logo_height\` numeric,
        \`status\` text DEFAULT 'active' NOT NULL, \`void_reason\` text, \`voided_at\` text,
        \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
        \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
      );`)
      await db.run(sql`INSERT INTO \`receipt_vouchers\` (
      \`id\`, \`voucher_number\`, \`idempotency_key\`, \`issued_at\`, \`received_from\`,
      \`amount_minor\`, \`amount_words_english\`, \`amount_words_arabic\`, \`payment_method\`,
      \`purpose\`, \`business_seller_name_arabic\`, \`business_seller_name_english\`,
      \`business_business_address\`, \`status\`
    ) VALUES
      ('migration-active', 'RV-900001', '10000000-0000-4000-8000-000000000001', '2026-10-17T21:00:00.000Z', 'Active Customer', 10000, 'One Hundred Riyals Only', 'فقط مائة ريال لا غير', 'cash', 'Migration test', 'متجر', 'Shop', 'Riyadh', 'active'),
      ('migration-void', 'RV-900002', '10000000-0000-4000-8000-000000000002', '2026-10-17T21:00:00.000Z', 'Void Customer', 20000, 'Two Hundred Riyals Only', 'فقط مائتا ريال لا غير', 'cash', 'Migration test', 'متجر', 'Shop', 'Riyadh', 'void');`)
      await db.run(sql`PRAGMA foreign_keys=ON;`)
      await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
        \`id\` integer PRIMARY KEY NOT NULL,
        \`receipt_vouchers_id\` text REFERENCES \`receipt_vouchers\`(\`id\`) ON DELETE no action
      );`)
      await db.run(sql`INSERT INTO \`payload_locked_documents_rels\` (\`id\`, \`receipt_vouchers_id\`)
        VALUES (1, 'migration-active');`)

      await database.transaction(async (transaction) => {
        await addReceiptVoucherStatusWorkflow({
          db: transaction as unknown as MigrateUpArgs['db'],
        } as MigrateUpArgs)
      })
      await addReceiptVoucherStatusWorkflow(args)

      const { rows } =
        await db.run(sql`SELECT \`id\`, \`voucher_number\`, \`voucher_date\`, \`issued_at\`, \`status\`
      FROM \`receipt_vouchers\` WHERE \`id\` IN ('migration-active', 'migration-void') ORDER BY \`id\`;`)
      const migrated = rows as unknown as Array<{
        id: string
        issued_at: string
        status: string
        voucher_date: string
        voucher_number: string
      }>

      assert.deepEqual(
        migrated.map(({ id, status }) => ({ id, status })),
        [
          { id: 'migration-active', status: 'issued' },
          { id: 'migration-void', status: 'voided' },
        ],
      )
      assert.ok(migrated.every((voucher) => voucher.voucher_date === '2026-10-17T21:00:00.000Z'))
      assert.ok(migrated.every((voucher) => voucher.issued_at === '2026-10-17T21:00:00.000Z'))
      assert.deepEqual(
        migrated.map(({ voucher_number }) => voucher_number),
        ['RV-900001', 'RV-900002'],
      )
      const reference = await db.run(
        sql`SELECT \`receipt_vouchers_id\` FROM \`payload_locked_documents_rels\`;`,
      )
      assert.equal(reference.rows[0]?.receipt_vouchers_id, 'migration-active')
    } finally {
      client.close()
      rmSync(directory, { force: true, recursive: true })
    }
  })
})
