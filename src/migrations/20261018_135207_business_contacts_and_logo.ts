import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`media\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`alt\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric
  );
  `)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS \`media_filename_idx\` ON \`media\` (\`filename\`);`)

  const lockResult = await db.run(sql`PRAGMA table_info('payload_locked_documents_rels');`)
  const lockColumns = new Set(
    lockResult.rows.map((row) => String((row as unknown as { name: unknown }).name)),
  )
  if (!lockColumns.has('media_id')) {
    await db.run(
      sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`media_id\` integer REFERENCES media(id);`,
    )
  }
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`,
  )

  const settingsResult = await db.run(sql`PRAGMA table_info('shop_settings');`)
  const settingsColumns = new Set(
    settingsResult.rows.map((row) => String((row as unknown as { name: unknown }).name)),
  )
  if (!settingsColumns.has('cr_number')) {
    await db.run(sql`ALTER TABLE \`shop_settings\` ADD \`cr_number\` text;`)
  }
  if (!settingsColumns.has('logo_id')) {
    await db.run(sql`ALTER TABLE \`shop_settings\` ADD \`logo_id\` integer REFERENCES media(id);`)
  }
  if (!settingsColumns.has('telephone')) {
    await db.run(sql`ALTER TABLE \`shop_settings\` ADD \`telephone\` text;`)
  }
  if (!settingsColumns.has('additional_telephone')) {
    await db.run(sql`ALTER TABLE \`shop_settings\` ADD \`additional_telephone\` text;`)
  }
  if (!settingsColumns.has('mobile')) {
    await db.run(sql`ALTER TABLE \`shop_settings\` ADD \`mobile\` text;`)
  }
  if (!settingsColumns.has('email')) {
    await db.run(sql`ALTER TABLE \`shop_settings\` ADD \`email\` text;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`shop_settings_logo_idx\` ON \`shop_settings\` (\`logo_id\`);`)
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
  	\`invoices_id\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`invoices_id\`) REFERENCES \`invoices\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "products_id", "invoices_id") SELECT "id", "order", "parent_id", "path", "users_id", "products_id", "invoices_id" FROM \`payload_locked_documents_rels\`;`,
  )
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(
    sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_invoices_id_idx\` ON \`payload_locked_documents_rels\` (\`invoices_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`__new_shop_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`display_name\` text,
  	\`seller_name_arabic\` text NOT NULL,
  	\`seller_name_english\` text NOT NULL,
  	\`vat_number\` text NOT NULL,
  	\`business_address\` text NOT NULL,
  	\`default_price_includes_vat\` integer DEFAULT true NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_shop_settings\`("id", "display_name", "seller_name_arabic", "seller_name_english", "vat_number", "business_address", "default_price_includes_vat", "updated_at", "created_at") SELECT "id", "display_name", "seller_name_arabic", "seller_name_english", "vat_number", "business_address", "default_price_includes_vat", "updated_at", "created_at" FROM \`shop_settings\`;`,
  )
  await db.run(sql`DROP TABLE \`shop_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_shop_settings\` RENAME TO \`shop_settings\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
}
