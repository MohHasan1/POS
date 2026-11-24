import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

type MigrationDatabase = MigrateUpArgs['db']

async function hasColumn(db: MigrationDatabase, table: string, column: string): Promise<boolean> {
  const result = await db.run(sql.raw(`PRAGMA table_info('${table.replaceAll("'", "''")}');`))
  return result.rows.some((row) => String(row.name) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS money_people (
    id text PRIMARY KEY NOT NULL, name text NOT NULL, phone text, note text,
    active integer DEFAULT true NOT NULL,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_people_name_idx ON money_people (name);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_people_phone_idx ON money_people (phone);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_people_active_idx ON money_people (active);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_people_updated_at_idx ON money_people (updated_at);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_people_created_at_idx ON money_people (created_at);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS money_accounts (
    id text PRIMARY KEY NOT NULL, record_number text NOT NULL, idempotency_key text NOT NULL,
    direction text NOT NULL, kind text NOT NULL, status text DEFAULT 'confirmed' NOT NULL,
    person_id text NOT NULL, person_snapshot_name text NOT NULL, person_snapshot_phone text,
    record_date text NOT NULL, due_date text, invoice_id text, original_amount_minor numeric NOT NULL,
    reference text, note text, country_code text NOT NULL, currency_code text NOT NULL,
    currency_minor_unit_digits numeric NOT NULL, time_zone text NOT NULL, void_reason text, voided_at text,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (person_id) REFERENCES money_people(id) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS money_accounts_record_number_idx ON money_accounts (record_number);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS money_accounts_idempotency_key_idx ON money_accounts (idempotency_key);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_direction_idx ON money_accounts (direction);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_kind_idx ON money_accounts (kind);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_status_idx ON money_accounts (status);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_person_idx ON money_accounts (person_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_record_date_idx ON money_accounts (record_date);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_due_date_idx ON money_accounts (due_date);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS money_accounts_invoice_idx ON money_accounts (invoice_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_reference_idx ON money_accounts (reference);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_updated_at_idx ON money_accounts (updated_at);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_created_at_idx ON money_accounts (created_at);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS money_accounts_products (
    _order integer NOT NULL, _parent_id text NOT NULL, id text PRIMARY KEY NOT NULL,
    product_id text NOT NULL, product_snapshot_name text NOT NULL, quantity_milliunits numeric NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (_parent_id) REFERENCES money_accounts(id) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_products_order_idx ON money_accounts_products (_order);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_products_parent_id_idx ON money_accounts_products (_parent_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_accounts_products_product_idx ON money_accounts_products (product_id);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS money_payments (
    id text PRIMARY KEY NOT NULL, idempotency_key text NOT NULL, account_id text NOT NULL,
    direction text NOT NULL, person_snapshot_name text NOT NULL, status text DEFAULT 'confirmed' NOT NULL,
    payment_date text NOT NULL, amount_minor numeric NOT NULL, payment_method text NOT NULL,
    payment_details_bank_name text, payment_details_transaction_reference text,
    payment_details_transfer_date text, payment_details_cheque_number text,
    payment_details_cheque_date text, payment_details_other_description text,
    payment_details_other_reference text, reference text, note text, receipt_voucher_id text,
    country_code text NOT NULL, currency_code text NOT NULL, currency_minor_unit_digits numeric NOT NULL,
    time_zone text NOT NULL, void_reason text, voided_at text,
    updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (account_id) REFERENCES money_accounts(id) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (receipt_voucher_id) REFERENCES receipt_vouchers(id) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS money_payments_idempotency_key_idx ON money_payments (idempotency_key);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_payments_account_idx ON money_payments (account_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_payments_direction_idx ON money_payments (direction);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_payments_status_idx ON money_payments (status);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_payments_payment_date_idx ON money_payments (payment_date);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS money_payments_receipt_voucher_idx ON money_payments (receipt_voucher_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_payments_updated_at_idx ON money_payments (updated_at);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS money_payments_created_at_idx ON money_payments (created_at);`)

  for (const [column, target] of [
    ['money_people_id', 'money_people'],
    ['money_accounts_id', 'money_accounts'],
    ['money_payments_id', 'money_payments'],
  ] as const) {
    if (!(await hasColumn(db, 'payload_locked_documents_rels', column))) {
      await db.run(sql.raw(`ALTER TABLE \`payload_locked_documents_rels\` ADD \`${column}\` text REFERENCES ${target}(id);`))
    }
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_money_people_id_idx ON payload_locked_documents_rels (money_people_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_money_accounts_id_idx ON payload_locked_documents_rels (money_accounts_id);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_money_payments_id_idx ON payload_locked_documents_rels (money_payments_id);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS money_payments;`)
  await db.run(sql`DROP TABLE IF EXISTS money_accounts_products;`)
  await db.run(sql`DROP TABLE IF EXISTS money_accounts;`)
  await db.run(sql`DROP TABLE IF EXISTS money_people;`)
}
