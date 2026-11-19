import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

type MigrationDatabase = MigrateUpArgs['db']

async function hasColumn(db: MigrationDatabase, table: string, column: string): Promise<boolean> {
  const result = await db.run(sql.raw(`PRAGMA table_info('${table.replaceAll("'", "''")}');`))
  return result.rows.some((row) => String(row.name) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS expense_categories (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    description text,
    active integer DEFAULT true NOT NULL,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );`)
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_name_idx ON expense_categories (name);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS expense_categories_updated_at_idx ON expense_categories (updated_at);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS expense_categories_created_at_idx ON expense_categories (created_at);`,
  )

  await db.run(sql`CREATE TABLE IF NOT EXISTS expense_templates (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    category_id text NOT NULL,
    vendor text,
    default_total_minor numeric NOT NULL,
    default_vat_minor numeric DEFAULT 0 NOT NULL,
    frequency text NOT NULL,
    weekly_day numeric,
    monthly_day numeric,
    yearly_month numeric,
    yearly_day numeric,
    start_date text NOT NULL,
    end_date text,
    note text,
    active integer DEFAULT true NOT NULL,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS expense_templates_category_idx ON expense_templates (category_id);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS expense_templates_start_date_idx ON expense_templates (start_date);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS expense_templates_end_date_idx ON expense_templates (end_date);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS expense_templates_updated_at_idx ON expense_templates (updated_at);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS expense_templates_created_at_idx ON expense_templates (created_at);`,
  )

  await db.run(sql`CREATE TABLE IF NOT EXISTS expenses (
    id text PRIMARY KEY NOT NULL,
    idempotency_key text NOT NULL,
    record_type text NOT NULL,
    status text DEFAULT 'confirmed' NOT NULL,
    template_id text,
    occurrence_key text,
    category_id text,
    category_snapshot_name text NOT NULL,
    name text NOT NULL,
    vendor text,
    bill_date text NOT NULL,
    total_minor numeric NOT NULL,
    vat_minor numeric DEFAULT 0 NOT NULL,
    net_minor numeric NOT NULL,
    payment_status text DEFAULT 'unpaid' NOT NULL,
    paid_at text,
    payment_method text,
    reference text,
    note text,
    void_reason text,
    country_code text NOT NULL,
    currency_code text NOT NULL,
    currency_minor_unit_digits numeric NOT NULL,
    time_zone text NOT NULL,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (template_id) REFERENCES expense_templates(id) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS expenses_idempotency_key_idx ON expenses (idempotency_key);`,
  )
  await db.run(sql`CREATE INDEX IF NOT EXISTS expenses_record_type_idx ON expenses (record_type);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses (status);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS expenses_template_idx ON expenses (template_id);`)
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS expenses_occurrence_key_idx ON expenses (occurrence_key);`,
  )
  await db.run(sql`CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses (category_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS expenses_bill_date_idx ON expenses (bill_date);`)
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS expenses_payment_status_idx ON expenses (payment_status);`,
  )
  await db.run(sql`CREATE INDEX IF NOT EXISTS expenses_paid_at_idx ON expenses (paid_at);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS expenses_updated_at_idx ON expenses (updated_at);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS expenses_created_at_idx ON expenses (created_at);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS invoice_cost_overrides (
    id text PRIMARY KEY NOT NULL,
    invoice_id text NOT NULL,
    invoice_item_id text NOT NULL,
    product_id text,
    unit_cost_minor numeric NOT NULL,
    total_cost_minor numeric NOT NULL,
    note text,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS invoice_cost_overrides_invoice_idx ON invoice_cost_overrides (invoice_id);`,
  )
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS invoice_cost_overrides_invoice_item_id_idx ON invoice_cost_overrides (invoice_item_id);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS invoice_cost_overrides_product_idx ON invoice_cost_overrides (product_id);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS invoice_cost_overrides_updated_at_idx ON invoice_cost_overrides (updated_at);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS invoice_cost_overrides_created_at_idx ON invoice_cost_overrides (created_at);`,
  )

  if (!(await hasColumn(db, 'products', 'unit_cost_minor'))) {
    await db.run(sql`ALTER TABLE products ADD unit_cost_minor numeric;`)
  }
  if (!(await hasColumn(db, 'invoices_items', 'cost_unit_cost_minor'))) {
    await db.run(sql`ALTER TABLE invoices_items ADD cost_unit_cost_minor numeric;`)
  }
  if (!(await hasColumn(db, 'invoices_items', 'cost_total_cost_minor'))) {
    await db.run(sql`ALTER TABLE invoices_items ADD cost_total_cost_minor numeric;`)
  }

  for (const [column, target] of [
    ['expense_categories_id', 'expense_categories'],
    ['expense_templates_id', 'expense_templates'],
    ['expenses_id', 'expenses'],
    ['invoice_cost_overrides_id', 'invoice_cost_overrides'],
  ] as const) {
    if (!(await hasColumn(db, 'payload_locked_documents_rels', column))) {
      await db.run(
        sql.raw(
          `ALTER TABLE \`payload_locked_documents_rels\` ADD \`${column}\` text REFERENCES ${target}(id);`,
        ),
      )
    }
  }
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_expense_categories_id_idx ON payload_locked_documents_rels (expense_categories_id);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_expense_templates_id_idx ON payload_locked_documents_rels (expense_templates_id);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_expenses_id_idx ON payload_locked_documents_rels (expenses_id);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_invoice_cost_overrides_id_idx ON payload_locked_documents_rels (invoice_cost_overrides_id);`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS invoice_cost_overrides;`)
  await db.run(sql`DROP TABLE IF EXISTS expenses;`)
  await db.run(sql`DROP TABLE IF EXISTS expense_templates;`)
  await db.run(sql`DROP TABLE IF EXISTS expense_categories;`)
}
