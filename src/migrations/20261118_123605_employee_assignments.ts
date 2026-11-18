import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

type MigrationDatabase = MigrateUpArgs['db']

async function hasColumn(db: MigrationDatabase, table: string, column: string): Promise<boolean> {
  const result = await db.run(sql.raw(`PRAGMA table_info('${table.replaceAll("'", "''")}');`))
  return result.rows.some((row) => String(row.name) === column)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`employees\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`employee_code\` text,
  	\`phone\` text,
  	\`email\` text,
  	\`role\` text,
  	\`address\` text,
  	\`notes\` text,
  	\`active\` integer DEFAULT true NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`employees_employee_code_idx\` ON \`employees\` (\`employee_code\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`employees_updated_at_idx\` ON \`employees\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`employees_created_at_idx\` ON \`employees\` (\`created_at\`);`)
  if (!(await hasColumn(db, 'invoices', 'employee_id'))) {
    await db.run(sql`ALTER TABLE \`invoices\` ADD \`employee_id\` text REFERENCES employees(id);`)
  }
  if (!(await hasColumn(db, 'invoices', 'employee_snapshot_name'))) {
    await db.run(sql`ALTER TABLE \`invoices\` ADD \`employee_snapshot_name\` text;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`invoices_employee_idx\` ON \`invoices\` (\`employee_id\`);`)
  if (!(await hasColumn(db, 'payload_locked_documents_rels', 'employees_id'))) {
    await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`employees_id\` text REFERENCES employees(id);`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_employees_id_idx\` ON \`payload_locked_documents_rels\` (\`employees_id\`);`)
  if (!(await hasColumn(db, 'shop_settings', 'default_employee_id'))) {
    await db.run(sql`ALTER TABLE \`shop_settings\` ADD \`default_employee_id\` text REFERENCES employees(id);`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`shop_settings_default_employee_idx\` ON \`shop_settings\` (\`default_employee_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_invoices\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`invoice_number\` text NOT NULL,
  	\`idempotency_key\` text NOT NULL,
  	\`invoice_type\` text NOT NULL,
  	\`country_code\` text DEFAULT 'SA',
  	\`currency_code\` text DEFAULT 'SAR',
  	\`currency_minor_unit_digits\` numeric DEFAULT 2,
  	\`time_zone\` text DEFAULT 'Asia/Riyadh',
  	\`tax_mode\` text DEFAULT 'saudiVat',
  	\`document_language\` text DEFAULT 'ar',
  	\`secondary_language\` text DEFAULT 'ar',
  	\`sales_channel\` text DEFAULT 'checkout' NOT NULL,
  	\`issued_at\` text NOT NULL,
  	\`seller_name_arabic\` text,
  	\`seller_name_bangla\` text,
  	\`seller_name_english\` text NOT NULL,
  	\`seller_vat_number\` text,
  	\`seller_address\` text NOT NULL,
  	\`buyer_name\` text,
  	\`buyer_address\` text,
  	\`buyer_vat_number\` text,
  	\`buyer_identification\` text,
  	\`service_board_details_customer_name\` text,
  	\`service_board_details_customer_phone\` text,
  	\`service_board_details_note\` text,
  	\`subtotal_minor\` numeric NOT NULL,
  	\`vat_minor\` numeric NOT NULL,
  	\`total_minor\` numeric NOT NULL,
  	\`qr_payload\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`INSERT INTO \`__new_invoices\`("id", "invoice_number", "idempotency_key", "invoice_type", "country_code", "currency_code", "currency_minor_unit_digits", "time_zone", "tax_mode", "document_language", "secondary_language", "sales_channel", "issued_at", "seller_name_arabic", "seller_name_bangla", "seller_name_english", "seller_vat_number", "seller_address", "buyer_name", "buyer_address", "buyer_vat_number", "buyer_identification", "service_board_details_customer_name", "service_board_details_customer_phone", "service_board_details_note", "subtotal_minor", "vat_minor", "total_minor", "qr_payload", "updated_at", "created_at") SELECT "id", "invoice_number", "idempotency_key", "invoice_type", "country_code", "currency_code", "currency_minor_unit_digits", "time_zone", "tax_mode", "document_language", "secondary_language", "sales_channel", "issued_at", "seller_name_arabic", "seller_name_bangla", "seller_name_english", "seller_vat_number", "seller_address", "buyer_name", "buyer_address", "buyer_vat_number", "buyer_identification", "service_board_details_customer_name", "service_board_details_customer_phone", "service_board_details_note", "subtotal_minor", "vat_minor", "total_minor", "qr_payload", "updated_at", "created_at" FROM \`invoices\`;`)
  await db.run(sql`DROP TABLE \`invoices\`;`)
  await db.run(sql`ALTER TABLE \`__new_invoices\` RENAME TO \`invoices\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`invoices_invoice_number_idx\` ON \`invoices\` (\`invoice_number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`invoices_idempotency_key_idx\` ON \`invoices\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`invoices_issued_at_idx\` ON \`invoices\` (\`issued_at\`);`)
  await db.run(sql`CREATE INDEX \`invoices_updated_at_idx\` ON \`invoices\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`invoices_created_at_idx\` ON \`invoices\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`products_id\` text,
  	\`invoices_id\` text,
  	\`receipt_vouchers_id\` text,
  	\`media_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`invoices_id\`) REFERENCES \`invoices\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`receipt_vouchers_id\`) REFERENCES \`receipt_vouchers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "products_id", "invoices_id", "receipt_vouchers_id", "media_id") SELECT "id", "order", "parent_id", "path", "users_id", "products_id", "invoices_id", "receipt_vouchers_id", "media_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_invoices_id_idx\` ON \`payload_locked_documents_rels\` (\`invoices_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_receipt_vouchers_id_idx\` ON \`payload_locked_documents_rels\` (\`receipt_vouchers_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_shop_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`country_code\` text,
  	\`secondary_language\` text,
  	\`auto_translate_products\` integer DEFAULT true,
  	\`display_name\` text,
  	\`seller_name_arabic\` text,
  	\`seller_name_bangla\` text,
  	\`seller_name_english\` text NOT NULL,
  	\`cr_number\` text,
  	\`vat_number\` text,
  	\`trade_license_number\` text,
  	\`tin_number\` text,
  	\`bin_number\` text,
  	\`business_address\` text NOT NULL,
  	\`logo_id\` integer,
  	\`telephone\` text,
  	\`additional_telephone\` text,
  	\`mobile\` text,
  	\`email\` text,
  	\`default_price_includes_vat\` integer DEFAULT false NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_shop_settings\`("id", "country_code", "secondary_language", "auto_translate_products", "display_name", "seller_name_arabic", "seller_name_bangla", "seller_name_english", "cr_number", "vat_number", "trade_license_number", "tin_number", "bin_number", "business_address", "logo_id", "telephone", "additional_telephone", "mobile", "email", "default_price_includes_vat", "updated_at", "created_at") SELECT "id", "country_code", "secondary_language", "auto_translate_products", "display_name", "seller_name_arabic", "seller_name_bangla", "seller_name_english", "cr_number", "vat_number", "trade_license_number", "tin_number", "bin_number", "business_address", "logo_id", "telephone", "additional_telephone", "mobile", "email", "default_price_includes_vat", "updated_at", "created_at" FROM \`shop_settings\`;`)
  await db.run(sql`DROP TABLE \`shop_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_shop_settings\` RENAME TO \`shop_settings\`;`)
  await db.run(sql`CREATE INDEX \`shop_settings_logo_idx\` ON \`shop_settings\` (\`logo_id\`);`)
  await db.run(sql`DROP TABLE IF EXISTS \`employees\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
}
