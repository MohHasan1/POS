import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const { rows } = await db.run(sql`PRAGMA table_info('supply_usages');`)
  if (!rows.some(({ name }) => name === 'vendor')) {
    await db.run(sql`ALTER TABLE supply_usages ADD COLUMN vendor text;`)
  }
  if (!rows.some(({ name }) => name === 'notes')) {
    await db.run(sql`ALTER TABLE supply_usages ADD COLUMN notes text;`)
  }
  // Backfill only when adding the column so intentionally blank estimates survive reconciliation.
  if (!rows.some(({ name }) => name === 'expected_lifespan_days')) {
    await db.run(sql`ALTER TABLE supply_usages ADD COLUMN expected_lifespan_days numeric;`)
    await db.run(sql`
      UPDATE supply_usages
      SET expected_lifespan_days = (
        SELECT supplies.expected_lifespan_days FROM supplies WHERE supplies.id = supply_usages.supply_id
      )
      WHERE finished_on IS NULL;
    `)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`supply_usages\` DROP COLUMN \`vendor\`;`)
  await db.run(sql`ALTER TABLE \`supply_usages\` DROP COLUMN \`notes\`;`)
  await db.run(sql`ALTER TABLE \`supply_usages\` DROP COLUMN \`expected_lifespan_days\`;`)
}
