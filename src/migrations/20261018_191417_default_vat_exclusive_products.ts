import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
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
  await db.run(
    sql`INSERT INTO \`__new_shop_settings\`("id", "display_name", "seller_name_arabic", "seller_name_english", "cr_number", "vat_number", "business_address", "logo_id", "telephone", "additional_telephone", "mobile", "email", "default_price_includes_vat", "updated_at", "created_at") SELECT "id", "display_name", "seller_name_arabic", "seller_name_english", "cr_number", "vat_number", "business_address", "logo_id", "telephone", "additional_telephone", "mobile", "email", "default_price_includes_vat", "updated_at", "created_at" FROM \`shop_settings\`;`,
  )
  await db.run(sql`DROP TABLE \`shop_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_shop_settings\` RENAME TO \`shop_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`shop_settings_logo_idx\` ON \`shop_settings\` (\`logo_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
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
    \`default_price_includes_vat\` integer DEFAULT true NOT NULL,
    \`updated_at\` text,
    \`created_at\` text,
    FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(
    sql`INSERT INTO \`__new_shop_settings\`("id", "display_name", "seller_name_arabic", "seller_name_english", "cr_number", "vat_number", "business_address", "logo_id", "telephone", "additional_telephone", "mobile", "email", "default_price_includes_vat", "updated_at", "created_at") SELECT "id", "display_name", "seller_name_arabic", "seller_name_english", "cr_number", "vat_number", "business_address", "logo_id", "telephone", "additional_telephone", "mobile", "email", "default_price_includes_vat", "updated_at", "created_at" FROM \`shop_settings\`;`,
  )
  await db.run(sql`DROP TABLE \`shop_settings\`;`)
  await db.run(sql`ALTER TABLE \`__new_shop_settings\` RENAME TO \`shop_settings\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`shop_settings_logo_idx\` ON \`shop_settings\` (\`logo_id\`);`)
}
