import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

type MigrationDatabase = MigrateUpArgs['db']

async function hasColumn(db: MigrationDatabase, column: string): Promise<boolean> {
  const result = await db.run(sql`PRAGMA table_info('money_people');`)
  return result.rows.some((row) => String(row.name) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await hasColumn(db, 'email'))) {
    await db.run(sql`ALTER TABLE \`money_people\` ADD \`email\` text;`)
  }
  if (!(await hasColumn(db, 'address'))) {
    await db.run(sql`ALTER TABLE \`money_people\` ADD \`address\` text;`)
  }
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`money_people_email_idx\` ON \`money_people\` (\`email\`);`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS \`money_people_email_idx\`;`)
  if (await hasColumn(db, 'email')) {
    await db.run(sql`ALTER TABLE \`money_people\` DROP COLUMN \`email\`;`)
  }
  if (await hasColumn(db, 'address')) {
    await db.run(sql`ALTER TABLE \`money_people\` DROP COLUMN \`address\`;`)
  }
}
