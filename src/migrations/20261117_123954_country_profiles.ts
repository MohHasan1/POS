import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'
import { randomUUID } from 'node:crypto'

async function backfillLocalizedData(db: MigrateUpArgs['db']) {
  const legacyProducts = await db.run(sql`SELECT "id", "name_arabic", "name_bangla" FROM \`products\`;`)
  for (const row of legacyProducts.rows) {
    const product = row as unknown as { id: string; name_arabic?: null | string; name_bangla?: null | string }
    for (const [order, language, name] of [
      [1, 'ar', product.name_arabic],
      [2, 'bn', product.name_bangla],
    ] as const) {
      if (!name?.trim()) continue
      await db.run(sql`INSERT INTO \`products_translations\`("_order", "_parent_id", "id", "language", "name") SELECT ${order}, ${product.id}, ${randomUUID()}, ${language}, ${name} WHERE NOT EXISTS (SELECT 1 FROM \`products_translations\` WHERE "_parent_id" = ${product.id} AND "language" = ${language});`)
    }
  }
  const legacyItems = await db.run(sql`SELECT "id", "description_arabic", "description_bangla" FROM \`invoices_items\`;`)
  for (const row of legacyItems.rows) {
    const item = row as unknown as { id: string; description_arabic?: null | string; description_bangla?: null | string }
    for (const [order, language, name] of [
      [1, 'ar', item.description_arabic],
      [2, 'bn', item.description_bangla],
    ] as const) {
      if (!name?.trim()) continue
      await db.run(sql`INSERT INTO \`invoices_items_translations\`("_order", "_parent_id", "id", "language", "name") SELECT ${order}, ${item.id}, ${randomUUID()}, ${language}, ${name} WHERE NOT EXISTS (SELECT 1 FROM \`invoices_items_translations\` WHERE "_parent_id" = ${item.id} AND "language" = ${language});`)
    }
  }
}

async function backfillRegistrations(db: MigrateUpArgs['db']) {
  await db.run(sql`INSERT INTO \`invoices_seller_registrations\`("_order", "_parent_id", "id", "type", "value") SELECT 1, "id", lower(hex(randomblob(16))), 'vat', "seller_vat_number" FROM \`invoices\` WHERE trim(coalesce("seller_vat_number", '')) <> '' AND NOT EXISTS (SELECT 1 FROM \`invoices_seller_registrations\` registration WHERE registration."_parent_id" = \`invoices\`."id" AND registration."type" = 'vat');`)
  await db.run(sql`INSERT INTO \`receipt_vouchers_business_registrations\`("_order", "_parent_id", "id", "type", "value") SELECT 1, "id", lower(hex(randomblob(16))), 'cr', "business_cr_number" FROM \`receipt_vouchers\` WHERE trim(coalesce("business_cr_number", '')) <> '' AND NOT EXISTS (SELECT 1 FROM \`receipt_vouchers_business_registrations\` registration WHERE registration."_parent_id" = \`receipt_vouchers\`."id" AND registration."type" = 'cr');`)
  await db.run(sql`INSERT INTO \`shop_settings_registrations\`("_order", "_parent_id", "id", "type", "value") SELECT 1, "id", lower(hex(randomblob(16))), 'cr', "cr_number" FROM \`shop_settings\` WHERE trim(coalesce("cr_number", '')) <> '' AND NOT EXISTS (SELECT 1 FROM \`shop_settings_registrations\` registration WHERE registration."_parent_id" = \`shop_settings\`."id" AND registration."type" = 'cr');`)
  await db.run(sql`INSERT INTO \`shop_settings_registrations\`("_order", "_parent_id", "id", "type", "value") SELECT 2, "id", lower(hex(randomblob(16))), 'vat', "vat_number" FROM \`shop_settings\` WHERE trim(coalesce("vat_number", '')) <> '' AND NOT EXISTS (SELECT 1 FROM \`shop_settings_registrations\` registration WHERE registration."_parent_id" = \`shop_settings\`."id" AND registration."type" = 'vat');`)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const shopColumns = await db.run(sql`PRAGMA table_info('shop_settings');`)
  const alreadyPushed = shopColumns.rows.some(
    (row) => String((row as unknown as { name: unknown }).name) === 'country_code',
  )
  if (alreadyPushed) {
    await db.run(sql`UPDATE \`shop_settings\` SET "country_code" = 'SA', "secondary_language" = coalesce("secondary_language", 'ar'), "auto_translate_products" = coalesce("auto_translate_products", true) WHERE "country_code" IS NULL AND trim(coalesce("seller_name_english", '')) <> '' AND trim(coalesce("seller_name_arabic", '')) <> '' AND trim(coalesce("business_address", '')) <> '' AND length(coalesce("vat_number", '')) = 15;`)
    await db.run(sql`UPDATE \`invoices\` SET "country_code" = coalesce("country_code", 'SA'), "currency_code" = coalesce("currency_code", 'SAR'), "currency_minor_unit_digits" = coalesce("currency_minor_unit_digits", 2), "time_zone" = coalesce("time_zone", 'Asia/Riyadh'), "tax_mode" = coalesce("tax_mode", 'saudiVat'), "document_language" = coalesce("document_language", 'ar'), "secondary_language" = coalesce("secondary_language", 'ar');`)
    await db.run(sql`UPDATE \`receipt_vouchers\` SET "country_code" = coalesce("country_code", 'SA'), "currency_code" = coalesce("currency_code", 'SAR'), "currency_minor_unit_digits" = coalesce("currency_minor_unit_digits", 2), "time_zone" = coalesce("time_zone", 'Asia/Riyadh'), "tax_mode" = coalesce("tax_mode", 'saudiVat'), "document_language" = coalesce("document_language", 'ar'), "secondary_language" = coalesce("secondary_language", 'ar');`)
    await backfillLocalizedData(db)
    await backfillRegistrations(db)
    return
  }

  const mainTables = await db.run(sql`SELECT "name" FROM \`sqlite_master\`
    WHERE "type" = 'table' AND "name" IN (
      'products', 'invoices_items', 'invoices', 'receipt_vouchers', 'shop_settings'
    );`)
  const mainTableNames = new Set(mainTables.rows.map((row) => String(row.name)))
  const requiredMainTables = [
    'products',
    'invoices_items',
    'invoices',
    'receipt_vouchers',
    'shop_settings',
  ]
  const missingMainTables = requiredMainTables.filter((name) => !mainTableNames.has(name))
  if (missingMainTables.length > 0) {
    throw new Error(
      `Cannot reconcile the country-profile migration because these source tables are missing: ${missingMainTables.join(', ')}`,
    )
  }

  // A cancelled development schema-push can leave these new child tables
  // and empty SQLite rebuild tables behind while every source table still
  // uses the legacy schema. The new application cannot initialize in that
  // state, so no application data can have been written to the child tables.
  await db.run(sql`DROP TABLE IF EXISTS \`__new_products\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__new_invoices_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__new_invoices\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__new_receipt_vouchers\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__new_shop_settings\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`products_translations\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`invoices_seller_registrations\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`invoices_items_translations\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`receipt_vouchers_business_registrations\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`shop_settings_registrations\`;`)

  // Payload wraps migrations in a transaction, where SQLite cannot change
  // PRAGMA foreign_keys. Preserve every dependent row explicitly before the
  // generated parent-table rebuilds trigger their normal delete actions.
  await db.run(sql`DROP TABLE IF EXISTS \`__country_invoice_items_backup\`;`)
  await db.run(sql`CREATE TEMP TABLE \`__country_invoice_items_backup\` AS
    SELECT "_order", "_parent_id", "id", "product_id", "description_english",
      "description_bangla", "description_arabic", "quantity_milliunits",
      "unit_price_minor", "price_includes_vat", "vat_category", "vat_rate_bps",
      "net_minor", "vat_minor", "total_minor"
    FROM \`invoices_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__country_board_products_backup\`;`)
  await db.run(sql`CREATE TEMP TABLE \`__country_board_products_backup\` AS
    SELECT "id", "product_id" FROM \`service_board_settings_columns\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__country_locked_refs_backup\`;`)
  await db.run(sql`CREATE TEMP TABLE \`__country_locked_refs_backup\` AS
    SELECT "id", "products_id", "invoices_id", "receipt_vouchers_id"
    FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`UPDATE \`payload_locked_documents_rels\`
    SET "products_id" = NULL, "invoices_id" = NULL, "receipt_vouchers_id" = NULL
    WHERE "products_id" IS NOT NULL OR "invoices_id" IS NOT NULL
      OR "receipt_vouchers_id" IS NOT NULL;`)

  await db.run(sql`CREATE TABLE \`products_translations\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`language\` text NOT NULL,
  	\`name\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`products_translations_order_idx\` ON \`products_translations\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_translations_parent_id_idx\` ON \`products_translations\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`invoices_seller_registrations\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`type\` text NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`invoices\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`invoices_seller_registrations_order_idx\` ON \`invoices_seller_registrations\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`invoices_seller_registrations_parent_id_idx\` ON \`invoices_seller_registrations\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`invoices_items_translations\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`language\` text NOT NULL,
  	\`name\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`invoices_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`invoices_items_translations_order_idx\` ON \`invoices_items_translations\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`invoices_items_translations_parent_id_idx\` ON \`invoices_items_translations\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`receipt_vouchers_business_registrations\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`type\` text NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`receipt_vouchers\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_business_registrations_order_idx\` ON \`receipt_vouchers_business_registrations\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_business_registrations_parent_id_idx\` ON \`receipt_vouchers_business_registrations\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`shop_settings_registrations\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`type\` text NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`shop_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`shop_settings_registrations_order_idx\` ON \`shop_settings_registrations\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`shop_settings_registrations_parent_id_idx\` ON \`shop_settings_registrations\` (\`_parent_id\`);`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_invoices_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`product_id\` text,
  	\`description_english\` text NOT NULL,
  	\`description_bangla\` text,
  	\`description_arabic\` text,
  	\`quantity_milliunits\` numeric NOT NULL,
  	\`unit_price_minor\` numeric NOT NULL,
  	\`price_includes_vat\` integer DEFAULT false NOT NULL,
  	\`vat_category\` text NOT NULL,
  	\`vat_rate_bps\` numeric NOT NULL,
  	\`net_minor\` numeric NOT NULL,
  	\`vat_minor\` numeric NOT NULL,
  	\`total_minor\` numeric NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`invoices\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_invoices_items\`("_order", "_parent_id", "id", "product_id", "description_english", "description_bangla", "description_arabic", "quantity_milliunits", "unit_price_minor", "price_includes_vat", "vat_category", "vat_rate_bps", "net_minor", "vat_minor", "total_minor") SELECT "_order", "_parent_id", "id", "product_id", "description_english", "description_bangla", "description_arabic", "quantity_milliunits", "unit_price_minor", "price_includes_vat", "vat_category", "vat_rate_bps", "net_minor", "vat_minor", "total_minor" FROM \`invoices_items\`;`)
  await db.run(sql`DROP TABLE \`invoices_items\`;`)
  await db.run(sql`ALTER TABLE \`__new_invoices_items\` RENAME TO \`invoices_items\`;`)
  await db.run(sql`CREATE INDEX \`invoices_items_order_idx\` ON \`invoices_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`invoices_items_parent_id_idx\` ON \`invoices_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`invoices_items_product_idx\` ON \`invoices_items\` (\`product_id\`);`)
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
  await db.run(sql`INSERT INTO \`__new_invoices\`("id", "invoice_number", "idempotency_key", "invoice_type", "country_code", "currency_code", "currency_minor_unit_digits", "time_zone", "tax_mode", "document_language", "secondary_language", "sales_channel", "issued_at", "seller_name_arabic", "seller_name_bangla", "seller_name_english", "seller_vat_number", "seller_address", "buyer_name", "buyer_address", "buyer_vat_number", "buyer_identification", "service_board_details_customer_name", "service_board_details_customer_phone", "service_board_details_note", "subtotal_minor", "vat_minor", "total_minor", "qr_payload", "updated_at", "created_at") SELECT "id", "invoice_number", "idempotency_key", "invoice_type", 'SA', 'SAR', 2, 'Asia/Riyadh', 'saudiVat', 'ar', 'ar', "sales_channel", "issued_at", "seller_name_arabic", NULL, "seller_name_english", "seller_vat_number", "seller_address", "buyer_name", "buyer_address", "buyer_vat_number", "buyer_identification", "service_board_details_customer_name", "service_board_details_customer_phone", "service_board_details_note", "subtotal_minor", "vat_minor", "total_minor", "qr_payload", "updated_at", "created_at" FROM \`invoices\`;`)
  await db.run(sql`DROP TABLE \`invoices\`;`)
  await db.run(sql`ALTER TABLE \`__new_invoices\` RENAME TO \`invoices\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`invoices_invoice_number_idx\` ON \`invoices\` (\`invoice_number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`invoices_idempotency_key_idx\` ON \`invoices\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`invoices_issued_at_idx\` ON \`invoices\` (\`issued_at\`);`)
  await db.run(sql`CREATE INDEX \`invoices_updated_at_idx\` ON \`invoices\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`invoices_created_at_idx\` ON \`invoices\` (\`created_at\`);`)
  await db.run(sql`DELETE FROM \`invoices_items\`;`)
  await db.run(sql`INSERT INTO \`invoices_items\`(
    "_order", "_parent_id", "id", "product_id", "description_english",
    "description_bangla", "description_arabic", "quantity_milliunits",
    "unit_price_minor", "price_includes_vat", "vat_category", "vat_rate_bps",
    "net_minor", "vat_minor", "total_minor"
  ) SELECT
    "_order", "_parent_id", "id", "product_id", "description_english",
    "description_bangla", "description_arabic", "quantity_milliunits",
    "unit_price_minor", "price_includes_vat", "vat_category", "vat_rate_bps",
    "net_minor", "vat_minor", "total_minor"
  FROM \`__country_invoice_items_backup\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE TABLE \`__new_receipt_vouchers\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`voucher_number\` text NOT NULL,
  	\`idempotency_key\` text NOT NULL,
  	\`country_code\` text DEFAULT 'SA',
  	\`currency_code\` text DEFAULT 'SAR',
  	\`currency_minor_unit_digits\` numeric DEFAULT 2,
  	\`time_zone\` text DEFAULT 'Asia/Riyadh',
  	\`tax_mode\` text DEFAULT 'saudiVat',
  	\`document_language\` text DEFAULT 'ar',
  	\`secondary_language\` text DEFAULT 'ar',
  	\`voucher_date\` text NOT NULL,
  	\`issued_at\` text,
  	\`received_from\` text NOT NULL,
  	\`amount_minor\` numeric NOT NULL,
  	\`amount_words_english\` text NOT NULL,
	\`amount_words_arabic\` text,
  	\`amount_words_bangla\` text,
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
  	\`business_seller_name_arabic\` text,
  	\`business_seller_name_bangla\` text,
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
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`void_reason\` text,
  	\`voided_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`INSERT INTO \`__new_receipt_vouchers\`("id", "voucher_number", "idempotency_key", "country_code", "currency_code", "currency_minor_unit_digits", "time_zone", "tax_mode", "document_language", "secondary_language", "voucher_date", "issued_at", "received_from", "amount_minor", "amount_words_english", "amount_words_arabic", "amount_words_bangla", "payment_method", "payment_details_bank_name", "payment_details_transaction_reference", "payment_details_transfer_date", "payment_details_cheque_number", "payment_details_cheque_date", "payment_details_other_description", "payment_details_other_reference", "purpose", "notes", "business_display_name", "business_seller_name_arabic", "business_seller_name_bangla", "business_seller_name_english", "business_cr_number", "business_business_address", "business_telephone", "business_additional_telephone", "business_mobile", "business_email", "business_logo_media_id", "business_logo_url", "business_logo_filename", "business_logo_mime_type", "business_logo_width", "business_logo_height", "status", "void_reason", "voided_at", "updated_at", "created_at") SELECT "id", "voucher_number", "idempotency_key", 'SA', 'SAR', 2, 'Asia/Riyadh', 'saudiVat', 'ar', 'ar', "voucher_date", "issued_at", "received_from", "amount_minor", "amount_words_english", "amount_words_arabic", NULL, "payment_method", "payment_details_bank_name", "payment_details_transaction_reference", "payment_details_transfer_date", "payment_details_cheque_number", "payment_details_cheque_date", "payment_details_other_description", "payment_details_other_reference", "purpose", "notes", "business_display_name", "business_seller_name_arabic", NULL, "business_seller_name_english", "business_cr_number", "business_business_address", "business_telephone", "business_additional_telephone", "business_mobile", "business_email", "business_logo_media_id", "business_logo_url", "business_logo_filename", "business_logo_mime_type", "business_logo_width", "business_logo_height", "status", "void_reason", "voided_at", "updated_at", "created_at" FROM \`receipt_vouchers\`;`)
  await db.run(sql`DROP TABLE \`receipt_vouchers\`;`)
  await db.run(sql`ALTER TABLE \`__new_receipt_vouchers\` RENAME TO \`receipt_vouchers\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`receipt_vouchers_voucher_number_idx\` ON \`receipt_vouchers\` (\`voucher_number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`receipt_vouchers_idempotency_key_idx\` ON \`receipt_vouchers\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_voucher_date_idx\` ON \`receipt_vouchers\` (\`voucher_date\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_issued_at_idx\` ON \`receipt_vouchers\` (\`issued_at\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_status_idx\` ON \`receipt_vouchers\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_updated_at_idx\` ON \`receipt_vouchers\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_created_at_idx\` ON \`receipt_vouchers\` (\`created_at\`);`)
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
  await db.run(sql`INSERT INTO \`__new_shop_settings\`("id", "country_code", "secondary_language", "auto_translate_products", "display_name", "seller_name_arabic", "seller_name_bangla", "seller_name_english", "cr_number", "vat_number", "trade_license_number", "tin_number", "bin_number", "business_address", "logo_id", "telephone", "additional_telephone", "mobile", "email", "default_price_includes_vat", "updated_at", "created_at") SELECT "id", 'SA', 'ar', true, "display_name", "seller_name_arabic", NULL, "seller_name_english", "cr_number", "vat_number", NULL, NULL, NULL, "business_address", "logo_id", "telephone", "additional_telephone", "mobile", "email", "default_price_includes_vat", "updated_at", "created_at" FROM \`shop_settings\`;`)
  await db.run(sql`DROP TABLE \`shop_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_shop_settings\` RENAME TO \`shop_settings\`;`)
  await db.run(sql`CREATE INDEX \`shop_settings_logo_idx\` ON \`shop_settings\` (\`logo_id\`);`)
  await db.run(sql`UPDATE \`service_board_settings_columns\`
    SET "product_id" = (
      SELECT "product_id" FROM \`__country_board_products_backup\` backup
      WHERE backup."id" = \`service_board_settings_columns\`."id"
    ) WHERE "id" IN (SELECT "id" FROM \`__country_board_products_backup\`);`)
  await db.run(sql`UPDATE \`payload_locked_documents_rels\`
    SET
      "products_id" = (
        SELECT "products_id" FROM \`__country_locked_refs_backup\` backup
        WHERE backup."id" = \`payload_locked_documents_rels\`."id"
      ),
      "invoices_id" = (
        SELECT "invoices_id" FROM \`__country_locked_refs_backup\` backup
        WHERE backup."id" = \`payload_locked_documents_rels\`."id"
      ),
      "receipt_vouchers_id" = (
        SELECT "receipt_vouchers_id" FROM \`__country_locked_refs_backup\` backup
        WHERE backup."id" = \`payload_locked_documents_rels\`."id"
      )
    WHERE "id" IN (SELECT "id" FROM \`__country_locked_refs_backup\`);`)
  await backfillLocalizedData(db)
  await backfillRegistrations(db)
  await db.run(sql`DROP TABLE \`__country_invoice_items_backup\`;`)
  await db.run(sql`DROP TABLE \`__country_board_products_backup\`;`)
  await db.run(sql`DROP TABLE \`__country_locked_refs_backup\`;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`products_translations\`;`)
  await db.run(sql`DROP TABLE \`invoices_seller_registrations\`;`)
  await db.run(sql`DROP TABLE \`invoices_items_translations\`;`)
  await db.run(sql`DROP TABLE \`receipt_vouchers_business_registrations\`;`)
  await db.run(sql`DROP TABLE \`shop_settings_registrations\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_products\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name_english\` text NOT NULL,
  	\`name_bangla\` text,
  	\`name_arabic\` text NOT NULL,
  	\`sku\` text,
  	\`price_minor\` numeric NOT NULL,
  	\`vat_category\` text DEFAULT 'standard' NOT NULL,
  	\`price_includes_vat\` integer DEFAULT true NOT NULL,
  	\`active\` integer DEFAULT true NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`INSERT INTO \`__new_products\`("id", "name_english", "name_bangla", "name_arabic", "sku", "price_minor", "vat_category", "price_includes_vat", "active", "updated_at", "created_at") SELECT "id", "name_english", "name_bangla", "name_arabic", "sku", "price_minor", "vat_category", "price_includes_vat", "active", "updated_at", "created_at" FROM \`products\`;`)
  await db.run(sql`DROP TABLE \`products\`;`)
  await db.run(sql`ALTER TABLE \`__new_products\` RENAME TO \`products\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`products_sku_idx\` ON \`products\` (\`sku\`);`)
  await db.run(sql`CREATE INDEX \`products_updated_at_idx\` ON \`products\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`products_created_at_idx\` ON \`products\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_invoices_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`product_id\` text,
  	\`description_english\` text NOT NULL,
  	\`description_bangla\` text,
  	\`description_arabic\` text NOT NULL,
  	\`quantity_milliunits\` numeric NOT NULL,
  	\`unit_price_minor\` numeric NOT NULL,
  	\`price_includes_vat\` integer DEFAULT false NOT NULL,
  	\`vat_category\` text NOT NULL,
  	\`vat_rate_bps\` numeric NOT NULL,
  	\`net_minor\` numeric NOT NULL,
  	\`vat_minor\` numeric NOT NULL,
  	\`total_minor\` numeric NOT NULL,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`invoices\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_invoices_items\`("_order", "_parent_id", "id", "product_id", "description_english", "description_bangla", "description_arabic", "quantity_milliunits", "unit_price_minor", "price_includes_vat", "vat_category", "vat_rate_bps", "net_minor", "vat_minor", "total_minor") SELECT "_order", "_parent_id", "id", "product_id", "description_english", "description_bangla", "description_arabic", "quantity_milliunits", "unit_price_minor", "price_includes_vat", "vat_category", "vat_rate_bps", "net_minor", "vat_minor", "total_minor" FROM \`invoices_items\`;`)
  await db.run(sql`DROP TABLE \`invoices_items\`;`)
  await db.run(sql`ALTER TABLE \`__new_invoices_items\` RENAME TO \`invoices_items\`;`)
  await db.run(sql`CREATE INDEX \`invoices_items_order_idx\` ON \`invoices_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`invoices_items_parent_id_idx\` ON \`invoices_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`invoices_items_product_idx\` ON \`invoices_items\` (\`product_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_invoices\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`invoice_number\` text NOT NULL,
  	\`idempotency_key\` text NOT NULL,
  	\`invoice_type\` text NOT NULL,
  	\`sales_channel\` text DEFAULT 'checkout' NOT NULL,
  	\`issued_at\` text NOT NULL,
  	\`seller_name_arabic\` text NOT NULL,
  	\`seller_name_english\` text NOT NULL,
  	\`seller_vat_number\` text NOT NULL,
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
  	\`qr_payload\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`INSERT INTO \`__new_invoices\`("id", "invoice_number", "idempotency_key", "invoice_type", "sales_channel", "issued_at", "seller_name_arabic", "seller_name_english", "seller_vat_number", "seller_address", "buyer_name", "buyer_address", "buyer_vat_number", "buyer_identification", "service_board_details_customer_name", "service_board_details_customer_phone", "service_board_details_note", "subtotal_minor", "vat_minor", "total_minor", "qr_payload", "updated_at", "created_at") SELECT "id", "invoice_number", "idempotency_key", "invoice_type", "sales_channel", "issued_at", "seller_name_arabic", "seller_name_english", "seller_vat_number", "seller_address", "buyer_name", "buyer_address", "buyer_vat_number", "buyer_identification", "service_board_details_customer_name", "service_board_details_customer_phone", "service_board_details_note", "subtotal_minor", "vat_minor", "total_minor", "qr_payload", "updated_at", "created_at" FROM \`invoices\`;`)
  await db.run(sql`DROP TABLE \`invoices\`;`)
  await db.run(sql`ALTER TABLE \`__new_invoices\` RENAME TO \`invoices\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`invoices_invoice_number_idx\` ON \`invoices\` (\`invoice_number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`invoices_idempotency_key_idx\` ON \`invoices\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`invoices_issued_at_idx\` ON \`invoices\` (\`issued_at\`);`)
  await db.run(sql`CREATE INDEX \`invoices_updated_at_idx\` ON \`invoices\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`invoices_created_at_idx\` ON \`invoices\` (\`created_at\`);`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE TABLE \`__new_receipt_vouchers\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`voucher_number\` text NOT NULL,
  	\`idempotency_key\` text NOT NULL,
  	\`voucher_date\` text NOT NULL,
  	\`issued_at\` text,
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
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`void_reason\` text,
  	\`voided_at\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`INSERT INTO \`__new_receipt_vouchers\`("id", "voucher_number", "idempotency_key", "voucher_date", "issued_at", "received_from", "amount_minor", "amount_words_english", "amount_words_arabic", "payment_method", "payment_details_bank_name", "payment_details_transaction_reference", "payment_details_transfer_date", "payment_details_cheque_number", "payment_details_cheque_date", "payment_details_other_description", "payment_details_other_reference", "purpose", "notes", "business_display_name", "business_seller_name_arabic", "business_seller_name_english", "business_cr_number", "business_business_address", "business_telephone", "business_additional_telephone", "business_mobile", "business_email", "business_logo_media_id", "business_logo_url", "business_logo_filename", "business_logo_mime_type", "business_logo_width", "business_logo_height", "status", "void_reason", "voided_at", "updated_at", "created_at") SELECT "id", "voucher_number", "idempotency_key", "voucher_date", "issued_at", "received_from", "amount_minor", "amount_words_english", "amount_words_arabic", "payment_method", "payment_details_bank_name", "payment_details_transaction_reference", "payment_details_transfer_date", "payment_details_cheque_number", "payment_details_cheque_date", "payment_details_other_description", "payment_details_other_reference", "purpose", "notes", "business_display_name", "business_seller_name_arabic", "business_seller_name_english", "business_cr_number", "business_business_address", "business_telephone", "business_additional_telephone", "business_mobile", "business_email", "business_logo_media_id", "business_logo_url", "business_logo_filename", "business_logo_mime_type", "business_logo_width", "business_logo_height", "status", "void_reason", "voided_at", "updated_at", "created_at" FROM \`receipt_vouchers\`;`)
  await db.run(sql`DROP TABLE \`receipt_vouchers\`;`)
  await db.run(sql`ALTER TABLE \`__new_receipt_vouchers\` RENAME TO \`receipt_vouchers\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`receipt_vouchers_voucher_number_idx\` ON \`receipt_vouchers\` (\`voucher_number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`receipt_vouchers_idempotency_key_idx\` ON \`receipt_vouchers\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_voucher_date_idx\` ON \`receipt_vouchers\` (\`voucher_date\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_issued_at_idx\` ON \`receipt_vouchers\` (\`issued_at\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_status_idx\` ON \`receipt_vouchers\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_updated_at_idx\` ON \`receipt_vouchers\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`receipt_vouchers_created_at_idx\` ON \`receipt_vouchers\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_shop_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`display_name\` text,
  	\`seller_name_arabic\` text NOT NULL,
  	\`seller_name_english\` text NOT NULL,
  	\`cr_number\` text,
  	\`vat_number\` text NOT NULL,
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
  await db.run(sql`INSERT INTO \`__new_shop_settings\`("id", "display_name", "seller_name_arabic", "seller_name_english", "cr_number", "vat_number", "business_address", "logo_id", "telephone", "additional_telephone", "mobile", "email", "default_price_includes_vat", "updated_at", "created_at") SELECT "id", "display_name", "seller_name_arabic", "seller_name_english", "cr_number", "vat_number", "business_address", "logo_id", "telephone", "additional_telephone", "mobile", "email", "default_price_includes_vat", "updated_at", "created_at" FROM \`shop_settings\`;`)
  await db.run(sql`DROP TABLE \`shop_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_shop_settings\` RENAME TO \`shop_settings\`;`)
  await db.run(sql`CREATE INDEX \`shop_settings_logo_idx\` ON \`shop_settings\` (\`logo_id\`);`)
}
