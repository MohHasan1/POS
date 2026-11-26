import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const supplies = await db.run(sql`PRAGMA table_info('supplies');`)
  if (!supplies.rows.some(({ name }) => name === 'default_unit_cost_minor')) {
    await db.run(sql`ALTER TABLE supplies ADD COLUMN default_unit_cost_minor numeric;`)
  }
  const usages = await db.run(sql`PRAGMA table_info('supply_usages');`)
  if (!usages.rows.some(({ name }) => name === 'unit_cost_minor')) {
    await db.run(sql`ALTER TABLE supply_usages ADD COLUMN unit_cost_minor numeric;`)
  }
  if (!usages.rows.some(({ name }) => name === 'cost_currency_code')) {
    await db.run(sql`ALTER TABLE supply_usages ADD COLUMN cost_currency_code text;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`supplies\` DROP COLUMN \`default_unit_cost_minor\`;`)
  await db.run(sql`ALTER TABLE \`supply_usages\` DROP COLUMN \`unit_cost_minor\`;`)
  await db.run(sql`ALTER TABLE \`supply_usages\` DROP COLUMN \`cost_currency_code\`;`)
}
