import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS cash_closings (
      id text PRIMARY KEY NOT NULL,
      request_id text NOT NULL,
      business_date text NOT NULL,
      closed_at text NOT NULL,
      expected_cash_minor numeric NOT NULL,
      actual_cash_minor numeric NOT NULL,
      owner_pickup_minor numeric NOT NULL,
      note text,
      country_code text NOT NULL,
      currency_code text NOT NULL,
      time_zone text NOT NULL,
      updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS cash_closings_updated_at_idx ON cash_closings (updated_at);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS cash_closings_created_at_idx ON cash_closings (created_at);`)

  const locks = await db.run(sql`PRAGMA table_info('payload_locked_documents_rels');`)
  if (!locks.rows.some(({ name }) => name === 'cash_closings_id')) {
    await db.run(sql`ALTER TABLE payload_locked_documents_rels ADD COLUMN cash_closings_id text REFERENCES cash_closings(id) ON DELETE CASCADE;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_cash_closings_id_idx ON payload_locked_documents_rels (cash_closings_id);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const closings = await db.run(sql`SELECT 1 FROM cash_closings LIMIT 1;`)
  if (closings.rows.length) throw new Error('Daily cash closings exist. Keep this migration to retain the closing history.')
  await db.run(sql`DROP INDEX IF EXISTS payload_locked_documents_rels_cash_closings_id_idx;`)
  await db.run(sql`ALTER TABLE payload_locked_documents_rels DROP COLUMN cash_closings_id;`)
  await db.run(sql`DROP TABLE cash_closings;`)
}
