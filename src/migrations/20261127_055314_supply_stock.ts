import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`supply_purchases\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`supply_id\` text NOT NULL,
    \`name\` text NOT NULL,
    \`purchased_on\` text NOT NULL,
    \`quantity\` numeric NOT NULL,
    \`remaining_quantity\` numeric NOT NULL,
    \`unit_cost_minor\` numeric,
    \`cost_currency_code\` text,
    \`vendor\` text,
    \`notes\` text,
    \`expense_id\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`supply_id\`) REFERENCES \`supplies\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`expense_id\`) REFERENCES \`expenses\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`supply_purchases_supply_idx\` ON \`supply_purchases\` (\`supply_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`supply_purchases_purchased_on_idx\` ON \`supply_purchases\` (\`purchased_on\`);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`supply_purchases_expense_idx\` ON \`supply_purchases\` (\`expense_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`supply_purchases_updated_at_idx\` ON \`supply_purchases\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`supply_purchases_created_at_idx\` ON \`supply_purchases\` (\`created_at\`);`)
  const usageColumns = await db.run(sql`PRAGMA table_info('supply_usages');`)
  if (!usageColumns.rows.some(({ name }) => name === 'purchase_id')) {
    await db.run(sql`ALTER TABLE supply_usages ADD COLUMN purchase_id text REFERENCES supply_purchases(id) ON DELETE SET NULL;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`supply_usages_purchase_idx\` ON \`supply_usages\` (\`purchase_id\`);`)
  const lockedDocColumns = await db.run(sql`PRAGMA table_info('payload_locked_documents_rels');`)
  if (!lockedDocColumns.rows.some(({ name }) => name === 'supply_purchases_id')) {
    await db.run(sql`ALTER TABLE payload_locked_documents_rels ADD COLUMN supply_purchases_id text REFERENCES supply_purchases(id) ON DELETE CASCADE;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_supply_purchases_id_idx\` ON \`payload_locked_documents_rels\` (\`supply_purchases_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS payload_locked_documents_rels_supply_purchases_id_idx;`)
  await db.run(sql`ALTER TABLE payload_locked_documents_rels DROP COLUMN supply_purchases_id;`)
  await db.run(sql`DROP INDEX IF EXISTS supply_usages_purchase_idx;`)
  await db.run(sql`ALTER TABLE supply_usages DROP COLUMN purchase_id;`)
  await db.run(sql`DROP TABLE supply_purchases;`)
}
