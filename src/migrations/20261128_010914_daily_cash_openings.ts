import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-sqlite'

import { getPeriodBounds, todayDateInput } from '@/lib/calendar'
import { getMarketProfile } from '@/lib/market'
import { dailyOpeningSource } from '@/services/cash-opening'

const bankColumns = ['expected_bank_minor', 'actual_bank_minor', 'bank_pickup_minor']

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const columns = await db.run(sql`PRAGMA table_info('cash_closings');`)
  for (const column of bankColumns) {
    if (!columns.rows.some(({ name }) => name === column)) {
      await db.run(sql`ALTER TABLE cash_closings ADD COLUMN ${sql.identifier(column)} numeric;`)
    }
  }

  const root = await db.run(sql`SELECT country_code FROM cash_ledger WHERE id = 'opening' AND source IS NULL;`)
  const opening = root.rows[0]
  if (opening) {
    const market = getMarketProfile(opening.country_code)
    // Keep the installation's in-progress day on its original basis.
    const fromDate = todayDateInput(market, getPeriodBounds(market).nextDayStart)
    await db.run(sql`UPDATE cash_ledger SET source = ${dailyOpeningSource(fromDate)} WHERE id = 'opening';`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const closings = await db.run(sql`SELECT 1 FROM cash_closings WHERE actual_bank_minor IS NOT NULL LIMIT 1;`)
  const openings = await db.run(sql`SELECT 1 FROM cash_ledger WHERE kind = 'opening' AND id <> 'opening' LIMIT 1;`)
  if (closings.rows.length || openings.rows.length) {
    throw new Error('Daily opening balances or bank closings exist. Keep this migration to retain those records.')
  }
  await db.run(sql`UPDATE cash_ledger SET source = NULL WHERE id = 'opening' AND source LIKE 'daily-openings:%';`)
  for (const column of bankColumns) {
    await db.run(sql`ALTER TABLE cash_closings DROP COLUMN ${sql.identifier(column)};`)
  }
}
