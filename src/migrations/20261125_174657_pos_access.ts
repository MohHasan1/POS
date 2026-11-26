import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pos_security\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`password_hash\` text NOT NULL,
    \`recovery_hash\` text NOT NULL,
    \`generation\` text NOT NULL,
    \`timeout_minutes\` numeric DEFAULT 5 NOT NULL,
    \`failed_unlocks\` numeric DEFAULT 0 NOT NULL,
    \`unlock_blocked_until\` text,
    \`failed_recoveries\` numeric DEFAULT 0 NOT NULL,
    \`recovery_blocked_until\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pos_security_updated_at_idx\` ON \`pos_security\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pos_security_created_at_idx\` ON \`pos_security\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pos_sessions\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`generation\` text NOT NULL,
    \`last_activity_at\` text NOT NULL,
    \`expires_at\` text NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pos_sessions_last_activity_at_idx\` ON \`pos_sessions\` (\`last_activity_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pos_sessions_updated_at_idx\` ON \`pos_sessions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pos_sessions_created_at_idx\` ON \`pos_sessions\` (\`created_at\`);`)
  const rels = await db.run(sql`PRAGMA table_info('payload_locked_documents_rels');`)
  if (!rels.rows.some(({ name }) => name === 'pos_security_id')) {
    await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`pos_security_id\` text REFERENCES pos_security(id) ON DELETE CASCADE;`)
  }
  if (!rels.rows.some(({ name }) => name === 'pos_sessions_id')) {
    await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`pos_sessions_id\` text REFERENCES pos_sessions(id) ON DELETE CASCADE;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_pos_security_id_idx\` ON \`payload_locked_documents_rels\` (\`pos_security_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_pos_sessions_id_idx\` ON \`payload_locked_documents_rels\` (\`pos_sessions_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` integer NOT NULL,
    \`path\` text NOT NULL,
    \`users_id\` integer,
    \`products_id\` text,
    \`employees_id\` text,
    \`employee_commission_rates_id\` text,
    \`invoices_id\` text,
    \`employee_commission_overrides_id\` text,
    \`employee_payroll_entries_id\` text,
    \`expense_categories_id\` text,
    \`expense_templates_id\` text,
    \`expenses_id\` text,
    \`money_people_id\` text,
    \`money_accounts_id\` text,
    \`money_payments_id\` text,
    \`invoice_cost_overrides_id\` text,
    \`receipt_vouchers_id\` text,
    \`media_id\` integer,
    FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`employees_id\`) REFERENCES \`employees\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`employee_commission_rates_id\`) REFERENCES \`employee_commission_rates\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`invoices_id\`) REFERENCES \`invoices\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`employee_commission_overrides_id\`) REFERENCES \`employee_commission_overrides\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`employee_payroll_entries_id\`) REFERENCES \`employee_payroll_entries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`expense_categories_id\`) REFERENCES \`expense_categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`expense_templates_id\`) REFERENCES \`expense_templates\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`expenses_id\`) REFERENCES \`expenses\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`money_people_id\`) REFERENCES \`money_people\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`money_accounts_id\`) REFERENCES \`money_accounts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`money_payments_id\`) REFERENCES \`money_payments\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`invoice_cost_overrides_id\`) REFERENCES \`invoice_cost_overrides\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`receipt_vouchers_id\`) REFERENCES \`receipt_vouchers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "products_id", "employees_id", "employee_commission_rates_id", "invoices_id", "employee_commission_overrides_id", "employee_payroll_entries_id", "expense_categories_id", "expense_templates_id", "expenses_id", "money_people_id", "money_accounts_id", "money_payments_id", "invoice_cost_overrides_id", "receipt_vouchers_id", "media_id") SELECT "id", "order", "parent_id", "path", "users_id", "products_id", "employees_id", "employee_commission_rates_id", "invoices_id", "employee_commission_overrides_id", "employee_payroll_entries_id", "expense_categories_id", "expense_templates_id", "expenses_id", "money_people_id", "money_accounts_id", "money_payments_id", "invoice_cost_overrides_id", "receipt_vouchers_id", "media_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_employees_id_idx\` ON \`payload_locked_documents_rels\` (\`employees_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_employee_commission_rates__idx\` ON \`payload_locked_documents_rels\` (\`employee_commission_rates_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_invoices_id_idx\` ON \`payload_locked_documents_rels\` (\`invoices_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_employee_commission_overri_idx\` ON \`payload_locked_documents_rels\` (\`employee_commission_overrides_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_employee_payroll_entries_i_idx\` ON \`payload_locked_documents_rels\` (\`employee_payroll_entries_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_expense_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`expense_categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_expense_templates_id_idx\` ON \`payload_locked_documents_rels\` (\`expense_templates_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_expenses_id_idx\` ON \`payload_locked_documents_rels\` (\`expenses_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_money_people_id_idx\` ON \`payload_locked_documents_rels\` (\`money_people_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_money_accounts_id_idx\` ON \`payload_locked_documents_rels\` (\`money_accounts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_money_payments_id_idx\` ON \`payload_locked_documents_rels\` (\`money_payments_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_invoice_cost_overrides_id_idx\` ON \`payload_locked_documents_rels\` (\`invoice_cost_overrides_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_receipt_vouchers_id_idx\` ON \`payload_locked_documents_rels\` (\`receipt_vouchers_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`DROP TABLE \`pos_sessions\`;`)
  await db.run(sql`DROP TABLE \`pos_security\`;`)
}
