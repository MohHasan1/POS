import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const columns = await db.run(sql`PRAGMA table_info('invoices');`)
  if (!columns.rows.some(({ name }) => name === 'cash_account')) {
    await db.run(sql`ALTER TABLE invoices ADD COLUMN cash_account text;`)
  }
  if (!columns.rows.some(({ name }) => name === 'bank_pending')) {
    await db.run(sql`ALTER TABLE invoices ADD COLUMN bank_pending integer;`)
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS cash_ledger_source_idx ON cash_ledger (source);`)

  // Legacy payment dates have day precision. Posting at their saved day boundary
  // includes them in a morning opening and keeps them outside a later counted balance.
  // Existing postings (including void reversals) already carry their original times.
  await db.run(sql`
    WITH payments AS (
      SELECT 'payment:' || id AS source, 'payment' AS kind, payment_date AS effective_at,
        payment_method AS method, CASE WHEN direction = 'owedToUs' THEN amount_minor ELSE -amount_minor END AS amount,
        country_code, currency_code, person_snapshot_name AS note
      FROM money_payments
      WHERE status = 'confirmed' AND payment_method IN ('cash', 'bank_transfer') AND amount_minor > 0
      UNION ALL
      SELECT 'expense:' || id, 'expense', COALESCE(paid_at, bill_date), payment_method, -total_minor,
        country_code, currency_code, name
      FROM expenses
      WHERE status = 'confirmed' AND payment_status = 'paid' AND payment_method IN ('cash', 'bank')
        AND total_minor > 0 AND cash_payment_id IS NULL
      UNION ALL
      SELECT 'payroll:' || id, 'payroll', entry_date, payment_method, -amount_minor,
        country_code, currency_code, employee_snapshot_name
      FROM employee_payroll_entries
      WHERE entry_type = 'payout' AND payment_method IN ('cash', 'bank') AND amount_minor > 0
    )
    INSERT INTO cash_ledger (id, source, active_source, kind, effective_at, cash_minor, bank_minor, country_code, currency_code, note)
    SELECT 'legacy:' || source, source, source, kind, effective_at,
      CASE WHEN method = 'cash' THEN amount ELSE 0 END,
      CASE WHEN method = 'cash' THEN 0 ELSE amount END,
      country_code, currency_code, note
    FROM payments
    WHERE NOT EXISTS (SELECT 1 FROM cash_ledger WHERE cash_ledger.source = payments.source);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS cash_ledger_source_idx;`)
  await db.run(sql`ALTER TABLE invoices DROP COLUMN cash_account;`)
  await db.run(sql`ALTER TABLE invoices DROP COLUMN bank_pending;`)
}
