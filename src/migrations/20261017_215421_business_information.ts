import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const { rows } = await db.run(sql`PRAGMA table_info('shop_settings');`)
  const columns = new Set(
    rows.map((row) => String((row as unknown as { name: unknown }).name)),
  )
  if (!columns.has('display_name')) {
    await db.run(sql`ALTER TABLE \`shop_settings\` ADD \`display_name\` text;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`shop_settings\` DROP COLUMN \`display_name\`;`)
}
