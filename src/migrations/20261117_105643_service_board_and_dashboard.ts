import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`service_board_settings_columns\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
	\`product_id\` text,
  	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`service_board_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`CREATE INDEX \`service_board_settings_columns_order_idx\` ON \`service_board_settings_columns\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`service_board_settings_columns_parent_id_idx\` ON \`service_board_settings_columns\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`service_board_settings_columns_product_idx\` ON \`service_board_settings_columns\` (\`product_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`service_board_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`ALTER TABLE \`invoices_items\` ADD \`product_id\` text REFERENCES products(id);`)
  await db.run(
    sql`CREATE INDEX \`invoices_items_product_idx\` ON \`invoices_items\` (\`product_id\`);`,
  )
  await db.run(
    sql`ALTER TABLE \`invoices\` ADD \`sales_channel\` text DEFAULT 'checkout' NOT NULL;`,
  )
  await db.run(sql`ALTER TABLE \`invoices\` ADD \`service_board_details_customer_name\` text;`)
  await db.run(sql`ALTER TABLE \`invoices\` ADD \`service_board_details_customer_phone\` text;`)
  await db.run(sql`ALTER TABLE \`invoices\` ADD \`service_board_details_note\` text;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`service_board_settings_columns\`;`)
  await db.run(sql`DROP TABLE \`service_board_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_invoices_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
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
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`invoices\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_invoices_items\`("_order", "_parent_id", "id", "description_english", "description_bangla", "description_arabic", "quantity_milliunits", "unit_price_minor", "price_includes_vat", "vat_category", "vat_rate_bps", "net_minor", "vat_minor", "total_minor") SELECT "_order", "_parent_id", "id", "description_english", "description_bangla", "description_arabic", "quantity_milliunits", "unit_price_minor", "price_includes_vat", "vat_category", "vat_rate_bps", "net_minor", "vat_minor", "total_minor" FROM \`invoices_items\`;`,
  )
  await db.run(sql`DROP TABLE \`invoices_items\`;`)
  await db.run(sql`ALTER TABLE \`__new_invoices_items\` RENAME TO \`invoices_items\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`invoices_items_order_idx\` ON \`invoices_items\` (\`_order\`);`)
  await db.run(
    sql`CREATE INDEX \`invoices_items_parent_id_idx\` ON \`invoices_items\` (\`_parent_id\`);`,
  )
  await db.run(sql`ALTER TABLE \`invoices\` DROP COLUMN \`sales_channel\`;`)
  await db.run(sql`ALTER TABLE \`invoices\` DROP COLUMN \`service_board_details_customer_name\`;`)
  await db.run(sql`ALTER TABLE \`invoices\` DROP COLUMN \`service_board_details_customer_phone\`;`)
  await db.run(sql`ALTER TABLE \`invoices\` DROP COLUMN \`service_board_details_note\`;`)
}
