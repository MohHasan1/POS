import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`receipt_vouchers\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`voucher_number\` text NOT NULL,
  	\`idempotency_key\` text NOT NULL,
  	\`issued_at\` text NOT NULL,
  	\`received_from\` text NOT NULL,
  	\`amount_minor\` numeric NOT NULL,
  	\`amount_words_english\` text NOT NULL,
  	\`amount_words_arabic\` text NOT NULL,
  	\`payment_method\` text NOT NULL,
  	\`payment_details_bank_name\` text,
  	\`payment_details_transaction_reference\` text,
  	\`payment_details_transfer_date\` text,
  	\`payment_details_cheque_number\` text,
  	\`payment_details_cheque_date\` text,
  	\`payment_details_other_description\` text,
  	\`payment_details_other_reference\` text,
  	\`purpose\` text NOT NULL,
  	\`notes\` text,
  	\`business_display_name\` text,
  	\`business_seller_name_arabic\` text NOT NULL,
  	\`business_seller_name_english\` text NOT NULL,
  	\`business_cr_number\` text,
  	\`business_business_address\` text NOT NULL,
  	\`business_telephone\` text,
  	\`business_additional_telephone\` text,
  	\`business_mobile\` text,
  	\`business_email\` text,
  	\`business_logo_media_id\` numeric,
  	\`business_logo_url\` text,
  	\`business_logo_filename\` text,
  	\`business_logo_mime_type\` text,
  	\`business_logo_width\` numeric,
  	\`business_logo_height\` numeric,
  	\`status\` text DEFAULT 'active' NOT NULL,
  	\`void_reason\` text,
  	\`voided_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`receipt_vouchers_voucher_number_idx\` ON \`receipt_vouchers\` (\`voucher_number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`receipt_vouchers_idempotency_key_idx\` ON \`receipt_vouchers\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_issued_at_idx\` ON \`receipt_vouchers\` (\`issued_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_status_idx\` ON \`receipt_vouchers\` (\`status\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_updated_at_idx\` ON \`receipt_vouchers\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_created_at_idx\` ON \`receipt_vouchers\` (\`created_at\`);`)

  const { rows } = await db.run(sql`PRAGMA table_info('payload_locked_documents_rels');`)
  const columns = new Set(
    rows.map((row) => String((row as unknown as { name: unknown }).name)),
  )
  if (!columns.has('receipt_vouchers_id')) {
    await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`receipt_vouchers_id\` text REFERENCES receipt_vouchers(id);`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_receipt_vouchers_id_idx\` ON \`payload_locked_documents_rels\` (\`receipt_vouchers_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`receipt_vouchers\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`products_id\` text,
  	\`invoices_id\` text,
  	\`media_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`invoices_id\`) REFERENCES \`invoices\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "products_id", "invoices_id", "media_id") SELECT "id", "order", "parent_id", "path", "users_id", "products_id", "invoices_id", "media_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_invoices_id_idx\` ON \`payload_locked_documents_rels\` (\`invoices_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
}
