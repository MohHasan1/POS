import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

const createCurrentTable = sql`CREATE TABLE \`__new_receipt_vouchers\` (
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
);`

async function createCurrentIndexes(db: MigrateUpArgs['db']): Promise<void> {
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS \`receipt_vouchers_voucher_number_idx\` ON \`receipt_vouchers\` (\`voucher_number\`);`,
  )
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS \`receipt_vouchers_idempotency_key_idx\` ON \`receipt_vouchers\` (\`idempotency_key\`);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_voucher_date_idx\` ON \`receipt_vouchers\` (\`voucher_date\`);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_issued_at_idx\` ON \`receipt_vouchers\` (\`issued_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_status_idx\` ON \`receipt_vouchers\` (\`status\`);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_updated_at_idx\` ON \`receipt_vouchers\` (\`updated_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_created_at_idx\` ON \`receipt_vouchers\` (\`created_at\`);`,
  )
}

async function detachLockedVoucherReferences(db: MigrateUpArgs['db']): Promise<boolean> {
  const { rows } = await db.run(sql`PRAGMA table_info('payload_locked_documents_rels');`)
  const hasReceiptVoucherReference = rows.some((row) => String(row.name) === 'receipt_vouchers_id')
  if (!hasReceiptVoucherReference) return false

  await db.run(sql`CREATE TEMP TABLE IF NOT EXISTS \`__receipt_voucher_locked_refs\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`receipt_vouchers_id\` text NOT NULL
  );`)
  await db.run(sql`DELETE FROM \`__receipt_voucher_locked_refs\`;`)
  await db.run(sql`INSERT INTO \`__receipt_voucher_locked_refs\` (\`id\`, \`receipt_vouchers_id\`)
    SELECT \`id\`, \`receipt_vouchers_id\` FROM \`payload_locked_documents_rels\`
    WHERE \`receipt_vouchers_id\` IS NOT NULL;`)
  await db.run(sql`UPDATE \`payload_locked_documents_rels\` SET \`receipt_vouchers_id\` = NULL
    WHERE \`receipt_vouchers_id\` IS NOT NULL;`)
  return true
}

async function restoreLockedVoucherReferences(
  db: MigrateUpArgs['db'],
  detached: boolean,
): Promise<void> {
  if (!detached) return
  await db.run(sql`UPDATE \`payload_locked_documents_rels\`
    SET \`receipt_vouchers_id\` = (
      SELECT \`receipt_vouchers_id\` FROM \`__receipt_voucher_locked_refs\`
      WHERE \`__receipt_voucher_locked_refs\`.\`id\` = \`payload_locked_documents_rels\`.\`id\`
    )
    WHERE \`id\` IN (SELECT \`id\` FROM \`__receipt_voucher_locked_refs\`);`)
  await db.run(sql`DROP TABLE \`__receipt_voucher_locked_refs\`;`)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const { rows } = await db.run(sql`PRAGMA table_info('receipt_vouchers');`)
  const voucherDateColumn = rows.find((row) => String(row.name) === 'voucher_date')
  const issuedAtColumn = rows.find((row) => String(row.name) === 'issued_at')
  const currentSchema = Boolean(voucherDateColumn) && Number(issuedAtColumn?.notnull) === 0

  if (currentSchema) {
    await db.run(sql`UPDATE \`receipt_vouchers\` SET \`status\` = CASE
      WHEN \`status\` = 'active' THEN 'issued'
      WHEN \`status\` = 'void' THEN 'voided'
      ELSE \`status\`
    END WHERE \`status\` IN ('active', 'void');`)
    await createCurrentIndexes(db)
    return
  }

  await db.run(sql`PRAGMA defer_foreign_keys=ON;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  const detachedLockedReferences = await detachLockedVoucherReferences(db)
  await db.run(createCurrentTable)

  if (voucherDateColumn) {
    await db.run(sql`INSERT INTO \`__new_receipt_vouchers\`(
      "id", "voucher_number", "idempotency_key", "voucher_date", "issued_at", "received_from",
      "amount_minor", "amount_words_english", "amount_words_arabic", "payment_method",
      "payment_details_bank_name", "payment_details_transaction_reference", "payment_details_transfer_date",
      "payment_details_cheque_number", "payment_details_cheque_date", "payment_details_other_description",
      "payment_details_other_reference", "purpose", "notes", "business_display_name",
      "business_seller_name_arabic", "business_seller_name_english", "business_cr_number",
      "business_business_address", "business_telephone", "business_additional_telephone", "business_mobile",
      "business_email", "business_logo_media_id", "business_logo_url", "business_logo_filename",
      "business_logo_mime_type", "business_logo_width", "business_logo_height", "status", "void_reason",
      "voided_at", "updated_at", "created_at"
    ) SELECT
      "id", "voucher_number", "idempotency_key", COALESCE("voucher_date", "issued_at"), "issued_at", "received_from",
      "amount_minor", "amount_words_english", "amount_words_arabic", "payment_method",
      "payment_details_bank_name", "payment_details_transaction_reference", "payment_details_transfer_date",
      "payment_details_cheque_number", "payment_details_cheque_date", "payment_details_other_description",
      "payment_details_other_reference", "purpose", "notes", "business_display_name",
      "business_seller_name_arabic", "business_seller_name_english", "business_cr_number",
      "business_business_address", "business_telephone", "business_additional_telephone", "business_mobile",
      "business_email", "business_logo_media_id", "business_logo_url", "business_logo_filename",
      "business_logo_mime_type", "business_logo_width", "business_logo_height",
      CASE WHEN "status" = 'active' THEN 'issued' WHEN "status" = 'void' THEN 'voided' ELSE "status" END,
      "void_reason", "voided_at", "updated_at", "created_at"
    FROM \`receipt_vouchers\`;`)
  } else {
    await db.run(sql`INSERT INTO \`__new_receipt_vouchers\`(
      "id", "voucher_number", "idempotency_key", "voucher_date", "issued_at", "received_from",
      "amount_minor", "amount_words_english", "amount_words_arabic", "payment_method",
      "payment_details_bank_name", "payment_details_transaction_reference", "payment_details_transfer_date",
      "payment_details_cheque_number", "payment_details_cheque_date", "payment_details_other_description",
      "payment_details_other_reference", "purpose", "notes", "business_display_name",
      "business_seller_name_arabic", "business_seller_name_english", "business_cr_number",
      "business_business_address", "business_telephone", "business_additional_telephone", "business_mobile",
      "business_email", "business_logo_media_id", "business_logo_url", "business_logo_filename",
      "business_logo_mime_type", "business_logo_width", "business_logo_height", "status", "void_reason",
      "voided_at", "updated_at", "created_at"
    ) SELECT
      "id", "voucher_number", "idempotency_key", "issued_at", "issued_at", "received_from",
      "amount_minor", "amount_words_english", "amount_words_arabic", "payment_method",
      "payment_details_bank_name", "payment_details_transaction_reference", "payment_details_transfer_date",
      "payment_details_cheque_number", "payment_details_cheque_date", "payment_details_other_description",
      "payment_details_other_reference", "purpose", "notes", "business_display_name",
      "business_seller_name_arabic", "business_seller_name_english", "business_cr_number",
      "business_business_address", "business_telephone", "business_additional_telephone", "business_mobile",
      "business_email", "business_logo_media_id", "business_logo_url", "business_logo_filename",
      "business_logo_mime_type", "business_logo_width", "business_logo_height",
      CASE WHEN "status" = 'active' THEN 'issued' WHEN "status" = 'void' THEN 'voided' ELSE "status" END,
      "void_reason", "voided_at", "updated_at", "created_at"
    FROM \`receipt_vouchers\`;`)
  }

  await db.run(sql`DROP TABLE \`receipt_vouchers\`;`)
  await db.run(sql`ALTER TABLE \`__new_receipt_vouchers\` RENAME TO \`receipt_vouchers\`;`)
  await restoreLockedVoucherReferences(db, detachedLockedReferences)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await createCurrentIndexes(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const { rows } = await db.run(sql`PRAGMA table_info('receipt_vouchers');`)
  const hasVoucherDate = rows.some((row) => String(row.name) === 'voucher_date')
  if (!hasVoucherDate) return

  await db.run(sql`PRAGMA defer_foreign_keys=ON;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  const detachedLockedReferences = await detachLockedVoucherReferences(db)
  await db.run(sql`CREATE TABLE \`__new_receipt_vouchers\` (
    \`id\` text PRIMARY KEY NOT NULL, \`voucher_number\` text NOT NULL,
    \`idempotency_key\` text NOT NULL, \`issued_at\` text NOT NULL, \`received_from\` text NOT NULL,
    \`amount_minor\` numeric NOT NULL, \`amount_words_english\` text NOT NULL,
    \`amount_words_arabic\` text NOT NULL, \`payment_method\` text NOT NULL,
    \`payment_details_bank_name\` text, \`payment_details_transaction_reference\` text,
    \`payment_details_transfer_date\` text, \`payment_details_cheque_number\` text,
    \`payment_details_cheque_date\` text, \`payment_details_other_description\` text,
    \`payment_details_other_reference\` text, \`purpose\` text NOT NULL, \`notes\` text,
    \`business_display_name\` text, \`business_seller_name_arabic\` text NOT NULL,
    \`business_seller_name_english\` text NOT NULL, \`business_cr_number\` text,
    \`business_business_address\` text NOT NULL, \`business_telephone\` text,
    \`business_additional_telephone\` text, \`business_mobile\` text, \`business_email\` text,
    \`business_logo_media_id\` numeric, \`business_logo_url\` text, \`business_logo_filename\` text,
    \`business_logo_mime_type\` text, \`business_logo_width\` numeric, \`business_logo_height\` numeric,
    \`status\` text DEFAULT 'active' NOT NULL, \`void_reason\` text, \`voided_at\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );`)
  await db.run(sql`INSERT INTO \`__new_receipt_vouchers\`(
    "id", "voucher_number", "idempotency_key", "issued_at", "received_from", "amount_minor",
    "amount_words_english", "amount_words_arabic", "payment_method", "payment_details_bank_name",
    "payment_details_transaction_reference", "payment_details_transfer_date", "payment_details_cheque_number",
    "payment_details_cheque_date", "payment_details_other_description", "payment_details_other_reference",
    "purpose", "notes", "business_display_name", "business_seller_name_arabic", "business_seller_name_english",
    "business_cr_number", "business_business_address", "business_telephone", "business_additional_telephone",
    "business_mobile", "business_email", "business_logo_media_id", "business_logo_url",
    "business_logo_filename", "business_logo_mime_type", "business_logo_width", "business_logo_height",
    "status", "void_reason", "voided_at", "updated_at", "created_at"
  ) SELECT
    "id", "voucher_number", "idempotency_key", COALESCE("issued_at", "voucher_date"), "received_from",
    "amount_minor", "amount_words_english", "amount_words_arabic", "payment_method",
    "payment_details_bank_name", "payment_details_transaction_reference", "payment_details_transfer_date",
    "payment_details_cheque_number", "payment_details_cheque_date", "payment_details_other_description",
    "payment_details_other_reference", "purpose", "notes", "business_display_name",
    "business_seller_name_arabic", "business_seller_name_english", "business_cr_number",
    "business_business_address", "business_telephone", "business_additional_telephone", "business_mobile",
    "business_email", "business_logo_media_id", "business_logo_url", "business_logo_filename",
    "business_logo_mime_type", "business_logo_width", "business_logo_height",
    CASE WHEN "status" = 'voided' THEN 'void' ELSE 'active' END,
    "void_reason", "voided_at", "updated_at", "created_at"
  FROM \`receipt_vouchers\`;`)
  await db.run(sql`DROP TABLE \`receipt_vouchers\`;`)
  await db.run(sql`ALTER TABLE \`__new_receipt_vouchers\` RENAME TO \`receipt_vouchers\`;`)
  await restoreLockedVoucherReferences(db, detachedLockedReferences)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS \`receipt_vouchers_voucher_number_idx\` ON \`receipt_vouchers\` (\`voucher_number\`);`,
  )
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS \`receipt_vouchers_idempotency_key_idx\` ON \`receipt_vouchers\` (\`idempotency_key\`);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_issued_at_idx\` ON \`receipt_vouchers\` (\`issued_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_status_idx\` ON \`receipt_vouchers\` (\`status\`);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_updated_at_idx\` ON \`receipt_vouchers\` (\`updated_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`receipt_vouchers_created_at_idx\` ON \`receipt_vouchers\` (\`created_at\`);`,
  )
}
