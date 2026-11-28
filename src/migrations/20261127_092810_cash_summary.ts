import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`cash_ledger\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`kind\` text NOT NULL,
    \`effective_at\` text NOT NULL,
    \`cash_minor\` numeric NOT NULL,
    \`bank_minor\` numeric NOT NULL,
    \`country_code\` text NOT NULL,
    \`currency_code\` text NOT NULL,
    \`note\` text,
    \`source\` text,
    \`active_source\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`cash_ledger_effective_at_idx\` ON \`cash_ledger\` (\`effective_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`cash_ledger_active_source_idx\` ON \`cash_ledger\` (\`active_source\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`cash_ledger_updated_at_idx\` ON \`cash_ledger\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`cash_ledger_created_at_idx\` ON \`cash_ledger\` (\`created_at\`);`)
  const expenses = await db.run(sql`PRAGMA table_info('expenses');`)
  if (!expenses.rows.some(({ name }) => name === 'cash_payment_id')) {
    await db.run(sql`ALTER TABLE expenses ADD COLUMN cash_payment_id text REFERENCES money_payments(id) ON DELETE SET NULL;`)
  }
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS expenses_cash_payment_idx ON expenses (cash_payment_id);`)
  const locks = await db.run(sql`PRAGMA table_info('payload_locked_documents_rels');`)
  if (!locks.rows.some(({ name }) => name === 'cash_ledger_id')) {
    await db.run(sql`ALTER TABLE payload_locked_documents_rels ADD COLUMN cash_ledger_id text REFERENCES cash_ledger(id) ON DELETE CASCADE;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_cash_ledger_id_idx ON payload_locked_documents_rels (cash_ledger_id);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS expenses_cash_payment_idx;`)
  await db.run(sql`ALTER TABLE expenses DROP COLUMN cash_payment_id;`)
  await db.run(sql`DROP INDEX IF EXISTS payload_locked_documents_rels_cash_ledger_id_idx;`)
  await db.run(sql`ALTER TABLE payload_locked_documents_rels DROP COLUMN cash_ledger_id;`)
  await db.run(sql`DROP TABLE cash_ledger;`)
}
