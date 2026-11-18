import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

type MigrationDatabase = MigrateUpArgs['db']

async function hasColumn(db: MigrationDatabase, column: string): Promise<boolean> {
  const result = await db.run(sql`PRAGMA table_info('invoices');`)
  return result.rows.some((row) => String(row.name) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await hasColumn(db, 'entry_source'))) {
    await db.run(sql`ALTER TABLE \`invoices\` ADD \`entry_source\` text DEFAULT 'live' NOT NULL;`)
  }
  if (!(await hasColumn(db, 'external_reference'))) {
    await db.run(sql`ALTER TABLE \`invoices\` ADD \`external_reference\` text;`)
  }
  if (!(await hasColumn(db, 'issued_at_precision'))) {
    await db.run(sql`ALTER TABLE \`invoices\` ADD \`issued_at_precision\` text DEFAULT 'exact' NOT NULL;`)
  }
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`invoices_external_reference_idx\` ON \`invoices\` (\`external_reference\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS \`invoices_external_reference_idx\`;`)
  if (await hasColumn(db, 'entry_source')) {
    await db.run(sql`ALTER TABLE \`invoices\` DROP COLUMN \`entry_source\`;`)
  }
  if (await hasColumn(db, 'external_reference')) {
    await db.run(sql`ALTER TABLE \`invoices\` DROP COLUMN \`external_reference\`;`)
  }
  if (await hasColumn(db, 'issued_at_precision')) {
    await db.run(sql`ALTER TABLE \`invoices\` DROP COLUMN \`issued_at_precision\`;`)
  }
}
