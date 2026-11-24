import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

type MigrationDatabase = MigrateUpArgs['db']

async function hasColumn(db: MigrationDatabase, column: string): Promise<boolean> {
  const result = await db.run(sql`PRAGMA table_info('money_accounts_products');`)
  return result.rows.some((row) => String(row.name) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await hasColumn(db, 'unit_price_minor'))) {
    await db.run(sql`ALTER TABLE \`money_accounts_products\` ADD \`unit_price_minor\` numeric;`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  if (await hasColumn(db, 'unit_price_minor')) {
    await db.run(sql`ALTER TABLE \`money_accounts_products\` DROP COLUMN \`unit_price_minor\`;`)
  }
}
