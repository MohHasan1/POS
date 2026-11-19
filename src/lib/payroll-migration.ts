import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

type MigrationDatabase = MigrateUpArgs['db']

async function hasColumn(db: MigrationDatabase, table: string, column: string): Promise<boolean> {
  const result = await db.run(sql.raw(`PRAGMA table_info('${table.replaceAll("'", "''")}');`))
  return result.rows.some((row) => String(row.name) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await hasColumn(db, 'employees', 'compensation_type'))) {
    await db.run(sql`ALTER TABLE employees ADD compensation_type text DEFAULT 'unconfigured' NOT NULL;`)
  }
  if (!(await hasColumn(db, 'employees', 'monthly_salary_minor'))) {
    await db.run(sql`ALTER TABLE employees ADD monthly_salary_minor numeric;`)
  }
  await db.run(sql`UPDATE employees SET compensation_type = 'unconfigured' WHERE compensation_type IS NULL;`)

  if (!(await hasColumn(db, 'invoices_items', 'commission_rate_bps'))) {
    await db.run(sql`ALTER TABLE invoices_items ADD commission_rate_bps numeric;`)
  }
  if (!(await hasColumn(db, 'invoices_items', 'commission_basis_minor'))) {
    await db.run(sql`ALTER TABLE invoices_items ADD commission_basis_minor numeric;`)
  }
  if (!(await hasColumn(db, 'invoices_items', 'commission_amount_minor'))) {
    await db.run(sql`ALTER TABLE invoices_items ADD commission_amount_minor numeric;`)
  }

  await db.run(sql`CREATE TABLE IF NOT EXISTS employee_commission_rates (
    id text PRIMARY KEY NOT NULL,
    employee_id text NOT NULL,
    product_id text NOT NULL,
    rate_bps numeric NOT NULL,
    active integer DEFAULT true NOT NULL,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_commission_rates_employee_idx ON employee_commission_rates (employee_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_commission_rates_product_idx ON employee_commission_rates (product_id);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS employee_commission_rates_employee_product_idx ON employee_commission_rates (employee_id, product_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_commission_rates_updated_at_idx ON employee_commission_rates (updated_at);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_commission_rates_created_at_idx ON employee_commission_rates (created_at);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS employee_payroll_entries (
    id text PRIMARY KEY NOT NULL,
    idempotency_key text NOT NULL,
    employee_id text NOT NULL,
    employee_snapshot_name text NOT NULL,
    entry_type text NOT NULL,
    entry_date text NOT NULL,
    salary_month text,
    amount_minor numeric NOT NULL,
    country_code text NOT NULL,
    currency_code text NOT NULL,
    currency_minor_unit_digits numeric NOT NULL,
    time_zone text NOT NULL,
    payment_method text,
    reference text,
    note text,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS employee_payroll_entries_idempotency_key_idx ON employee_payroll_entries (idempotency_key);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_payroll_entries_employee_idx ON employee_payroll_entries (employee_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_payroll_entries_entry_type_idx ON employee_payroll_entries (entry_type);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_payroll_entries_entry_date_idx ON employee_payroll_entries (entry_date);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_payroll_entries_salary_month_idx ON employee_payroll_entries (salary_month);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS employee_payroll_entries_monthly_unique_idx ON employee_payroll_entries (employee_id, salary_month) WHERE entry_type = 'monthlySalary';`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_payroll_entries_updated_at_idx ON employee_payroll_entries (updated_at);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_payroll_entries_created_at_idx ON employee_payroll_entries (created_at);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS employee_commission_overrides (
    id text PRIMARY KEY NOT NULL,
    invoice_id text NOT NULL,
    invoice_item_id text NOT NULL,
    employee_id text NOT NULL,
    employee_snapshot_name text NOT NULL,
    corrected_amount_minor numeric NOT NULL,
    note text,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_commission_overrides_invoice_idx ON employee_commission_overrides (invoice_id);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS employee_commission_overrides_invoice_item_id_idx ON employee_commission_overrides (invoice_item_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_commission_overrides_employee_idx ON employee_commission_overrides (employee_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_commission_overrides_updated_at_idx ON employee_commission_overrides (updated_at);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS employee_commission_overrides_created_at_idx ON employee_commission_overrides (created_at);`)

  for (const [column, target] of [
    ['employee_commission_rates_id', 'employee_commission_rates'],
    ['employee_commission_overrides_id', 'employee_commission_overrides'],
    ['employee_payroll_entries_id', 'employee_payroll_entries'],
  ] as const) {
    if (!(await hasColumn(db, 'payload_locked_documents_rels', column))) {
      await db.run(sql.raw(`ALTER TABLE \`payload_locked_documents_rels\` ADD \`${column}\` text REFERENCES ${target}(id);`))
    }
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_employee_commission_rates__idx ON payload_locked_documents_rels (employee_commission_rates_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_employee_commission_overri_idx ON payload_locked_documents_rels (employee_commission_overrides_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_employee_payroll_entries_i_idx ON payload_locked_documents_rels (employee_payroll_entries_id);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS employee_commission_overrides;`)
  await db.run(sql`DROP TABLE IF EXISTS employee_payroll_entries;`)
  await db.run(sql`DROP TABLE IF EXISTS employee_commission_rates;`)
}
