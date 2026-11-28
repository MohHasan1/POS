import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const columns = await db.run(sql`PRAGMA table_info('cash_closings');`)
  if (!columns.rows.some(({ name }) => name === 'last_edit_request_id')) {
    await db.run(sql`ALTER TABLE cash_closings ADD COLUMN last_edit_request_id text;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const edited = await db.run(sql`SELECT 1 FROM cash_closings WHERE last_edit_request_id IS NOT NULL LIMIT 1;`)
  if (edited.rows.length) throw new Error('Edited cash closings exist. Keep this migration to preserve their balance basis.')
  await db.run(sql`ALTER TABLE cash_closings DROP COLUMN last_edit_request_id;`)
}
