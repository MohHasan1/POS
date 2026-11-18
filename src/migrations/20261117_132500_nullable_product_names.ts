import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

type MigrationDatabase = MigrateUpArgs['db']

async function rebuildProducts(db: MigrationDatabase, arabicNameRequired: boolean): Promise<void> {
  const productColumns = await db.run(sql`PRAGMA table_info('products');`)
  const arabicNameColumn = productColumns.rows.find((row) => String(row.name) === 'name_arabic')
  if (!arabicNameColumn) throw new Error('Cannot migrate products because name_arabic is missing.')

  const currentlyRequired = Number(arabicNameColumn.notnull) === 1
  if (currentlyRequired === arabicNameRequired) return

  await db.run(sql`DROP TABLE IF EXISTS \`__new_products\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__product_translations_backup\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__product_invoice_refs_backup\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__product_board_refs_backup\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`__product_locked_refs_backup\`;`)

  await db.run(sql`CREATE TEMP TABLE \`__product_translations_backup\` AS
    SELECT "_order", "_parent_id", "id", "language", "name"
    FROM \`products_translations\`;`)
  await db.run(sql`CREATE TEMP TABLE \`__product_invoice_refs_backup\` AS
    SELECT "id", "product_id" FROM \`invoices_items\` WHERE "product_id" IS NOT NULL;`)
  await db.run(sql`CREATE TEMP TABLE \`__product_board_refs_backup\` AS
    SELECT "id", "product_id" FROM \`service_board_settings_columns\`
    WHERE "product_id" IS NOT NULL;`)
  await db.run(sql`CREATE TEMP TABLE \`__product_locked_refs_backup\` AS
    SELECT "id", "products_id" FROM \`payload_locked_documents_rels\`
    WHERE "products_id" IS NOT NULL;`)

  await db.run(sql`UPDATE \`invoices_items\` SET "product_id" = NULL
    WHERE "product_id" IS NOT NULL;`)
  await db.run(sql`UPDATE \`service_board_settings_columns\` SET "product_id" = NULL
    WHERE "product_id" IS NOT NULL;`)
  await db.run(sql`UPDATE \`payload_locked_documents_rels\` SET "products_id" = NULL
    WHERE "products_id" IS NOT NULL;`)
  await db.run(sql`DROP TABLE \`products_translations\`;`)

  if (arabicNameRequired) {
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
    );`)
    await db.run(sql`INSERT INTO \`__new_products\`(
      "id", "name_english", "name_bangla", "name_arabic", "sku", "price_minor",
      "vat_category", "price_includes_vat", "active", "updated_at", "created_at"
    ) SELECT
      "id", "name_english", "name_bangla", coalesce("name_arabic", ''), "sku",
      "price_minor", "vat_category", "price_includes_vat", "active", "updated_at", "created_at"
    FROM \`products\`;`)
  } else {
    await db.run(sql`CREATE TABLE \`__new_products\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`name_english\` text NOT NULL,
      \`name_bangla\` text,
      \`name_arabic\` text,
      \`sku\` text,
      \`price_minor\` numeric NOT NULL,
      \`vat_category\` text DEFAULT 'standard' NOT NULL,
      \`price_includes_vat\` integer DEFAULT true NOT NULL,
      \`active\` integer DEFAULT true NOT NULL,
      \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    );`)
    await db.run(sql`INSERT INTO \`__new_products\`(
      "id", "name_english", "name_bangla", "name_arabic", "sku", "price_minor",
      "vat_category", "price_includes_vat", "active", "updated_at", "created_at"
    ) SELECT
      "id", "name_english", "name_bangla", "name_arabic", "sku", "price_minor",
      "vat_category", "price_includes_vat", "active", "updated_at", "created_at"
    FROM \`products\`;`)
  }

  await db.run(sql`DROP TABLE \`products\`;`)
  await db.run(sql`ALTER TABLE \`__new_products\` RENAME TO \`products\`;`)
  await db.run(sql`CREATE UNIQUE INDEX \`products_sku_idx\` ON \`products\` (\`sku\`);`)
  await db.run(sql`CREATE INDEX \`products_updated_at_idx\` ON \`products\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`products_created_at_idx\` ON \`products\` (\`created_at\`);`)

  await db.run(sql`CREATE TABLE \`products_translations\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`language\` text NOT NULL,
    \`name\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX \`products_translations_order_idx\`
    ON \`products_translations\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`products_translations_parent_id_idx\`
    ON \`products_translations\` (\`_parent_id\`);`)
  await db.run(sql`INSERT INTO \`products_translations\`(
    "_order", "_parent_id", "id", "language", "name"
  ) SELECT "_order", "_parent_id", "id", "language", "name"
    FROM \`__product_translations_backup\`;`)

  await db.run(sql`UPDATE \`invoices_items\` SET "product_id" = (
    SELECT "product_id" FROM \`__product_invoice_refs_backup\` backup
    WHERE backup."id" = \`invoices_items\`."id"
  ) WHERE "id" IN (SELECT "id" FROM \`__product_invoice_refs_backup\`);`)
  await db.run(sql`UPDATE \`service_board_settings_columns\` SET "product_id" = (
    SELECT "product_id" FROM \`__product_board_refs_backup\` backup
    WHERE backup."id" = \`service_board_settings_columns\`."id"
  ) WHERE "id" IN (SELECT "id" FROM \`__product_board_refs_backup\`);`)
  await db.run(sql`UPDATE \`payload_locked_documents_rels\` SET "products_id" = (
    SELECT "products_id" FROM \`__product_locked_refs_backup\` backup
    WHERE backup."id" = \`payload_locked_documents_rels\`."id"
  ) WHERE "id" IN (SELECT "id" FROM \`__product_locked_refs_backup\`);`)

  await db.run(sql`DROP TABLE \`__product_translations_backup\`;`)
  await db.run(sql`DROP TABLE \`__product_invoice_refs_backup\`;`)
  await db.run(sql`DROP TABLE \`__product_board_refs_backup\`;`)
  await db.run(sql`DROP TABLE \`__product_locked_refs_backup\`;`)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await rebuildProducts(db, false)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await rebuildProducts(db, true)
}
