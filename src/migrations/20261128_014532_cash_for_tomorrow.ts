import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const columns = await db.run(sql`PRAGMA table_info('cash_closings');`)
  if (!columns.rows.some(({ name }) => name === 'next_day_cash_minor')) {
    await db.run(sql`ALTER TABLE cash_closings ADD COLUMN next_day_cash_minor numeric;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const closings = await db.run(sql`SELECT 1 FROM cash_closings WHERE next_day_cash_minor IS NOT NULL LIMIT 1;`)
  if (closings.rows.length) throw new Error('Cash for tomorrow has been recorded. Keep this migration to retain the closing history.')
  await db.run(sql`ALTER TABLE cash_closings DROP COLUMN next_day_cash_minor;`)
}
