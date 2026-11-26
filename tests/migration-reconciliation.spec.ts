import config from '@payload-config'
import { createClient } from '@libsql/client'
import { sql, type MigrateUpArgs } from '@payloadcms/db-sqlite'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { drizzle } from 'drizzle-orm/libsql'
import { getPayload } from 'payload'

import { up as initialSchema } from '@/migrations/20261017_194746_initial'
import { up as addBusinessInformation } from '@/migrations/20261017_215421_business_information'
import { up as addBusinessContactsAndLogo } from '@/migrations/20261018_135207_business_contacts_and_logo'
import { up as addReceiptVouchers } from '@/migrations/20261018_140414_receipt_vouchers'
import { up as addReceiptVoucherStatusWorkflow } from '@/migrations/20261018_143226_receipt_voucher_status_workflow'
import { up as defaultVatExclusiveProducts } from '@/migrations/20261018_191417_default_vat_exclusive_products'
import { up as addServiceBoardAndDashboard } from '@/migrations/20261117_105643_service_board_and_dashboard'
import { up as addCountryProfiles } from '@/migrations/20261117_123954_country_profiles'
import { up as makeProductNamesNullable } from '@/migrations/20261117_132500_nullable_product_names'
import { up as addEmployeeAssignments } from '@/migrations/20261118_123605_employee_assignments'
import { up as addHistoricalSalesBackfill } from '@/migrations/20261118_130246_historical_sales_backfill'
import { up as addPeopleDetails } from '@/migrations/20261124_083113_people_details'
import { up as addPosAccess } from '@/migrations/20261125_174657_pos_access'
import { up as addSupplies } from '@/migrations/20261126_064130_supplies'
import { up as addSupplyUsageDetails } from '@/migrations/20261126_070707_supply_usage_details'
import { up as addSupplyCosts } from '@/migrations/20261126_080156_supply_costs'
import { up as addEmployeePayroll } from '@/lib/payroll-migration'
import { up as addBusinessReports } from '@/lib/business-reports-migration'
import { up as addMoneyOwed } from '@/lib/money-migration'

describe('SQLite migration reconciliation', () => {
  it('safely reconciles a schema that Payload already pushed in development', async () => {
    const payload = await getPayload({ config })
    const db = (payload.db as unknown as { drizzle: MigrateUpArgs['db'] }).drizzle
    const args = { db } as MigrateUpArgs

    await addBusinessInformation(args)
    await addBusinessContactsAndLogo(args)
    await addReceiptVouchers(args)
    await addCountryProfiles(args)
    await addCountryProfiles(args)
    await addEmployeeAssignments(args)
    await addEmployeeAssignments(args)
    await addHistoricalSalesBackfill(args)
    await addHistoricalSalesBackfill(args)
    await addEmployeePayroll(args)
    await addEmployeePayroll(args)
    await addBusinessReports(args)
    await addBusinessReports(args)
    await addMoneyOwed(args)
    await addMoneyOwed(args)
    await addPeopleDetails(args)
    await addPeopleDetails(args)
    await addPosAccess(args)
    await addPosAccess(args)
    await addSupplies(args)
    await addSupplies(args)
    await addSupplyUsageDetails(args)
    await addSupplyUsageDetails(args)
    await addSupplyCosts(args)
    await addSupplyCosts(args)

    const { rows } = await db.run(sql`PRAGMA table_info('payload_locked_documents_rels');`)
    const columns = new Set(rows.map((row) => String((row as unknown as { name: unknown }).name)))
    assert.equal(columns.has('media_id'), true)
    assert.equal(columns.has('receipt_vouchers_id'), true)
    assert.equal(columns.has('employees_id'), true)
    assert.equal(columns.has('employee_payroll_entries_id'), true)
    assert.equal(columns.has('expenses_id'), true)
    assert.equal(columns.has('invoice_cost_overrides_id'), true)
    assert.equal(columns.has('money_people_id'), true)
    assert.equal(columns.has('money_accounts_id'), true)
    assert.equal(columns.has('money_payments_id'), true)
    assert.equal(columns.has('pos_sessions_id'), true)
    assert.equal(columns.has('pos_security_id'), true)
    assert.equal(columns.has('supplies_id'), true)
    assert.equal(columns.has('supply_usages_id'), true)
    const invoiceColumns = await db.run(sql`PRAGMA table_info('invoices');`)
    const invoiceColumnNames = new Set(invoiceColumns.rows.map((row) => String(row.name)))
    assert.equal(invoiceColumnNames.has('entry_source'), true)
    assert.equal(invoiceColumnNames.has('external_reference'), true)
    assert.equal(invoiceColumnNames.has('issued_at_precision'), true)
    const productColumns = await db.run(sql`PRAGMA table_info('products');`)
    assert.equal(
      productColumns.rows.some((row) => row.name === 'unit_cost_minor'),
      true,
    )
    const itemColumns = await db.run(sql`PRAGMA table_info('invoices_items');`)
    assert.equal(
      itemColumns.rows.some((row) => row.name === 'cost_total_cost_minor'),
      true,
    )
    const personColumns = await db.run(sql`PRAGMA table_info('money_people');`)
    const personColumnNames = new Set(personColumns.rows.map((row) => String(row.name)))
    assert.equal(personColumnNames.has('email'), true)
    assert.equal(personColumnNames.has('address'), true)
  })

  it('copies default estimates to existing open supply cards once and preserves finished records', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'quickpos-usage-migration-'))
    const client = createClient({ url: `file:${path.join(directory, 'legacy.db')}` })
    const db = drizzle(client) as unknown as MigrateUpArgs['db']
    const args = { db } as MigrateUpArgs
    try {
      await db.run(sql`CREATE TABLE payload_locked_documents_rels (id integer PRIMARY KEY NOT NULL);`)
      await addSupplies(args)
      await db.run(sql`INSERT INTO supplies (id, name, expected_lifespan_days) VALUES ('blades', 'Blades', 10);`)
      await db.run(sql`INSERT INTO supply_usages (id, supply_id, label, started_on, finished_on) VALUES
        ('open', 'blades', 'Blue pack', '2026-11-20', NULL),
        ('finished', 'blades', 'Red pack', '2026-11-11', '2026-11-15');`)
      await addSupplyUsageDetails(args)
      await addSupplyCosts(args)

      const statement = sql`SELECT label, started_on, finished_on, vendor, notes, expected_lifespan_days
        FROM supply_usages ORDER BY id;`
      assert.deepEqual((await db.run(statement)).rows, [
        { label: 'Red pack', started_on: '2026-11-11', finished_on: '2026-11-15', vendor: null, notes: null, expected_lifespan_days: null },
        { label: 'Blue pack', started_on: '2026-11-20', finished_on: null, vendor: null, notes: null, expected_lifespan_days: 10 },
      ])
      const costs = await db.run(sql`SELECT unit_cost_minor, cost_currency_code FROM supply_usages;`)
      assert.deepEqual(costs.rows, [
        { unit_cost_minor: null, cost_currency_code: null },
        { unit_cost_minor: null, cost_currency_code: null },
      ])
      await db.run(sql`UPDATE supply_usages SET expected_lifespan_days = NULL WHERE id = 'open';`)
      await addSupplyUsageDetails(args)
      assert.equal((await db.run(statement)).rows[1].expected_lifespan_days, null)
    } finally {
      client.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('adds payroll tables and leaves existing employees and invoices unchanged', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'quickpos-payroll-migration-'))
    const client = createClient({ url: `file:${path.join(directory, 'legacy.db')}` })
    const database = drizzle(client)
    const db = database as unknown as MigrateUpArgs['db']
    const args = { db } as MigrateUpArgs

    try {
      await db.run(sql`CREATE TABLE employees (
        id text PRIMARY KEY NOT NULL, name text NOT NULL, active integer NOT NULL
      );`)
      await db.run(sql`CREATE TABLE products (id text PRIMARY KEY NOT NULL);`)
      await db.run(sql`CREATE TABLE invoices (id text PRIMARY KEY NOT NULL);`)
      await db.run(sql`CREATE TABLE invoices_items (
        _order integer NOT NULL, _parent_id text NOT NULL, id text PRIMARY KEY NOT NULL
      );`)
      await db.run(
        sql`CREATE TABLE payload_locked_documents_rels (id integer PRIMARY KEY NOT NULL);`,
      )
      await db.run(
        sql`INSERT INTO employees (id, name, active) VALUES ('legacy-employee', 'Legacy Employee', 1);`,
      )
      await db.run(sql`INSERT INTO invoices (id) VALUES ('legacy-invoice');`)
      await db.run(sql`INSERT INTO invoices_items (_order, _parent_id, id)
        VALUES (1, 'legacy-invoice', 'legacy-line');`)

      await addEmployeePayroll(args)
      await addEmployeePayroll(args)

      const employee = await db.run(sql`SELECT name, compensation_type, monthly_salary_minor
        FROM employees WHERE id = 'legacy-employee';`)
      assert.deepEqual(employee.rows[0], {
        compensation_type: 'unconfigured',
        monthly_salary_minor: null,
        name: 'Legacy Employee',
      })
      const line = await db.run(sql`SELECT commission_rate_bps, commission_basis_minor,
        commission_amount_minor FROM invoices_items WHERE id = 'legacy-line';`)
      assert.deepEqual(line.rows[0], {
        commission_amount_minor: null,
        commission_basis_minor: null,
        commission_rate_bps: null,
      })
      for (const table of [
        'employee_commission_rates',
        'employee_commission_overrides',
        'employee_payroll_entries',
      ]) {
        const found = await db.run(
          sql.raw(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}';`),
        )
        assert.equal(found.rows.length, 1)
      }
    } finally {
      client.close()
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('adds reporting and expense tables without changing legacy sales data', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'quickpos-reporting-migration-'))
    const client = createClient({ url: `file:${path.join(directory, 'legacy.db')}` })
    const database = drizzle(client)
    const db = database as unknown as MigrateUpArgs['db']
    const args = { db } as MigrateUpArgs

    try {
      await db.run(sql`CREATE TABLE products (
        id text PRIMARY KEY NOT NULL, name_english text NOT NULL, price_minor numeric NOT NULL
      );`)
      await db.run(sql`CREATE TABLE invoices (
        id text PRIMARY KEY NOT NULL, invoice_number text NOT NULL
      );`)
      await db.run(sql`CREATE TABLE invoices_items (
        _order integer NOT NULL, _parent_id text NOT NULL, id text PRIMARY KEY NOT NULL,
        description_english text NOT NULL
      );`)
      await db.run(
        sql`CREATE TABLE payload_locked_documents_rels (id integer PRIMARY KEY NOT NULL);`,
      )
      await db.run(sql`INSERT INTO products (id, name_english, price_minor)
        VALUES ('legacy-product', 'Legacy Product', 10000);`)
      await db.run(sql`INSERT INTO invoices (id, invoice_number)
        VALUES ('legacy-invoice', 'INV-LEGACY');`)
      await db.run(sql`INSERT INTO invoices_items (_order, _parent_id, id, description_english)
        VALUES (1, 'legacy-invoice', 'legacy-line', 'Legacy Product');`)

      await addBusinessReports(args)
      await addBusinessReports(args)

      const product = await db.run(sql`SELECT name_english, price_minor, unit_cost_minor
        FROM products WHERE id = 'legacy-product';`)
      assert.deepEqual(product.rows[0], {
        name_english: 'Legacy Product',
        price_minor: 10000,
        unit_cost_minor: null,
      })
      const line = await db.run(sql`SELECT description_english, cost_unit_cost_minor,
        cost_total_cost_minor FROM invoices_items WHERE id = 'legacy-line';`)
      assert.deepEqual(line.rows[0], {
        cost_total_cost_minor: null,
        cost_unit_cost_minor: null,
        description_english: 'Legacy Product',
      })
      for (const table of [
        'expense_categories',
        'expense_templates',
        'expenses',
        'invoice_cost_overrides',
      ]) {
        const found = await db.run(
          sql.raw(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}';`),
        )
        assert.equal(found.rows.length, 1)
      }
    } finally {
      client.close()
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('adds optional employee fields without changing legacy invoices', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'quickpos-employee-migration-'))
    const client = createClient({ url: `file:${path.join(directory, 'legacy.db')}` })
    const database = drizzle(client)
    const db = database as unknown as MigrateUpArgs['db']
    const args = { db } as MigrateUpArgs

    try {
      await db.run(sql`CREATE TABLE invoices (
        id text PRIMARY KEY NOT NULL,
        invoice_number text NOT NULL
      );`)
      await db.run(sql`CREATE TABLE payload_locked_documents_rels (
        id integer PRIMARY KEY NOT NULL
      );`)
      await db.run(sql`CREATE TABLE shop_settings (
        id integer PRIMARY KEY NOT NULL,
        seller_name_english text NOT NULL
      );`)
      await db.run(sql`INSERT INTO invoices (id, invoice_number)
        VALUES ('legacy-invoice', 'INV-LEGACY');`)
      await db.run(sql`INSERT INTO shop_settings (id, seller_name_english)
        VALUES (1, 'Legacy Shop');`)

      await addEmployeeAssignments(args)
      await addEmployeeAssignments(args)
      await addHistoricalSalesBackfill(args)
      await addHistoricalSalesBackfill(args)

      const invoice = await db.run(sql`SELECT invoice_number, employee_id,
        employee_snapshot_name, entry_source, external_reference, issued_at_precision
        FROM invoices WHERE id = 'legacy-invoice';`)
      const settings = await db.run(
        sql`SELECT default_employee_id FROM shop_settings WHERE id = 1;`,
      )
      const employeeTable = await db.run(sql`SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'employees';`)

      assert.deepEqual(invoice.rows[0], {
        employee_id: null,
        employee_snapshot_name: null,
        entry_source: 'live',
        external_reference: null,
        invoice_number: 'INV-LEGACY',
        issued_at_precision: 'exact',
      })
      assert.equal(settings.rows[0]?.default_employee_id, null)
      assert.equal(employeeTable.rows.length, 1)
    } finally {
      client.close()
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('migrates legacy Active and Void vouchers without changing document data', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'quickpos-voucher-migration-'))
    const client = createClient({ url: `file:${path.join(directory, 'legacy.db')}` })
    const database = drizzle(client)
    const db = database as unknown as MigrateUpArgs['db']
    const args = { db } as MigrateUpArgs

    try {
      await db.run(sql`CREATE TABLE \`receipt_vouchers\` (
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
      await db.run(sql`INSERT INTO \`receipt_vouchers\` (
      \`id\`, \`voucher_number\`, \`idempotency_key\`, \`issued_at\`, \`received_from\`,
      \`amount_minor\`, \`amount_words_english\`, \`amount_words_arabic\`, \`payment_method\`,
      \`purpose\`, \`business_seller_name_arabic\`, \`business_seller_name_english\`,
      \`business_business_address\`, \`status\`
    ) VALUES
      ('migration-active', 'RV-900001', '10000000-0000-4000-8000-000000000001', '2026-10-17T21:00:00.000Z', 'Active Customer', 10000, 'One Hundred Riyals Only', 'فقط مائة ريال لا غير', 'cash', 'Migration test', 'متجر', 'Shop', 'Riyadh', 'active'),
      ('migration-void', 'RV-900002', '10000000-0000-4000-8000-000000000002', '2026-10-17T21:00:00.000Z', 'Void Customer', 20000, 'Two Hundred Riyals Only', 'فقط مائتا ريال لا غير', 'cash', 'Migration test', 'متجر', 'Shop', 'Riyadh', 'void');`)
      await db.run(sql`PRAGMA foreign_keys=ON;`)
      await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
        \`id\` integer PRIMARY KEY NOT NULL,
        \`receipt_vouchers_id\` text REFERENCES \`receipt_vouchers\`(\`id\`) ON DELETE no action
      );`)
      await db.run(sql`INSERT INTO \`payload_locked_documents_rels\` (\`id\`, \`receipt_vouchers_id\`)
        VALUES (1, 'migration-active');`)

      await database.transaction(async (transaction) => {
        await addReceiptVoucherStatusWorkflow({
          db: transaction as unknown as MigrateUpArgs['db'],
        } as MigrateUpArgs)
      })
      await addReceiptVoucherStatusWorkflow(args)

      const { rows } =
        await db.run(sql`SELECT \`id\`, \`voucher_number\`, \`voucher_date\`, \`issued_at\`, \`status\`
      FROM \`receipt_vouchers\` WHERE \`id\` IN ('migration-active', 'migration-void') ORDER BY \`id\`;`)
      const migrated = rows as unknown as Array<{
        id: string
        issued_at: string
        status: string
        voucher_date: string
        voucher_number: string
      }>

      assert.deepEqual(
        migrated.map(({ id, status }) => ({ id, status })),
        [
          { id: 'migration-active', status: 'issued' },
          { id: 'migration-void', status: 'voided' },
        ],
      )
      assert.ok(migrated.every((voucher) => voucher.voucher_date === '2026-10-17T21:00:00.000Z'))
      assert.ok(migrated.every((voucher) => voucher.issued_at === '2026-10-17T21:00:00.000Z'))
      assert.deepEqual(
        migrated.map(({ voucher_number }) => voucher_number),
        ['RV-900001', 'RV-900002'],
      )
      const reference = await db.run(
        sql`SELECT \`receipt_vouchers_id\` FROM \`payload_locked_documents_rels\`;`,
      )
      assert.equal(reference.rows[0]?.receipt_vouchers_id, 'migration-active')
    } finally {
      client.close()
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('changes only the new-row VAT pricing default and preserves saved preferences', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'quickpos-vat-default-migration-'))
    const client = createClient({ url: `file:${path.join(directory, 'legacy.db')}` })
    const database = drizzle(client)
    const db = database as unknown as MigrateUpArgs['db']

    try {
      await db.run(sql`CREATE TABLE media (
        id integer PRIMARY KEY NOT NULL
      );`)
      await db.run(sql`CREATE TABLE shop_settings (
        id integer PRIMARY KEY NOT NULL,
        display_name text,
        seller_name_arabic text NOT NULL,
        seller_name_english text NOT NULL,
        cr_number text,
        vat_number text NOT NULL,
        business_address text NOT NULL,
        logo_id integer,
        telephone text,
        additional_telephone text,
        mobile text,
        email text,
        default_price_includes_vat integer DEFAULT true NOT NULL,
        updated_at text,
        created_at text
      );`)
      await db.run(sql`INSERT INTO shop_settings (
        id, seller_name_arabic, seller_name_english, vat_number,
        business_address, default_price_includes_vat
      ) VALUES (1, 'متجر', 'Shop', '310000000000003', 'Riyadh', true);`)

      await database.transaction(async (transaction) => {
        await defaultVatExclusiveProducts({
          db: transaction as unknown as MigrateUpArgs['db'],
        } as MigrateUpArgs)
      })
      await defaultVatExclusiveProducts({ db } as MigrateUpArgs)

      const existing = await db.run(
        sql`SELECT default_price_includes_vat FROM shop_settings WHERE id = 1;`,
      )
      assert.equal(existing.rows[0]?.default_price_includes_vat, 1)

      await db.run(sql`INSERT INTO shop_settings (
        id, seller_name_arabic, seller_name_english, vat_number, business_address
      ) VALUES (2, 'متجر جديد', 'New Shop', '310000000000003', 'Riyadh');`)
      const created = await db.run(
        sql`SELECT default_price_includes_vat FROM shop_settings WHERE id = 2;`,
      )
      assert.equal(created.rows[0]?.default_price_includes_vat, 0)
    } finally {
      client.close()
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('adds Service Board metadata without changing legacy invoice data', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'quickpos-service-board-migration-'))
    const client = createClient({ url: `file:${path.join(directory, 'legacy.db')}` })
    const database = drizzle(client)
    const db = database as unknown as MigrateUpArgs['db']

    try {
      await db.run(sql`CREATE TABLE products (id text PRIMARY KEY NOT NULL);`)
      await db.run(sql`CREATE TABLE invoices (
        id text PRIMARY KEY NOT NULL,
        invoice_number text NOT NULL
      );`)
      await db.run(sql`CREATE TABLE invoices_items (
        _order integer NOT NULL,
        _parent_id text NOT NULL,
        id text PRIMARY KEY NOT NULL,
        description_english text NOT NULL,
        FOREIGN KEY (_parent_id) REFERENCES invoices(id) ON DELETE cascade
      );`)
      await db.run(sql`INSERT INTO invoices (id, invoice_number) VALUES ('legacy', 'INV-LEGACY');`)
      await db.run(sql`INSERT INTO invoices_items (
        _order, _parent_id, id, description_english
      ) VALUES (1, 'legacy', 'legacy-line', 'Legacy service');`)

      await addServiceBoardAndDashboard({ db } as MigrateUpArgs)
      await addServiceBoardAndDashboard({ db } as MigrateUpArgs)

      const invoice = await db.run(
        sql`SELECT invoice_number, sales_channel FROM invoices WHERE id = 'legacy';`,
      )
      const item = await db.run(
        sql`SELECT description_english, product_id FROM invoices_items WHERE id = 'legacy-line';`,
      )
      const settingsTable = await db.run(
        sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'service_board_settings';`,
      )

      assert.equal(invoice.rows[0]?.invoice_number, 'INV-LEGACY')
      assert.equal(invoice.rows[0]?.sales_channel, 'checkout')
      assert.equal(item.rows[0]?.description_english, 'Legacy service')
      assert.equal(item.rows[0]?.product_id, null)
      assert.equal(settingsTable.rows.length, 1)
    } finally {
      client.close()
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('backfills legacy Saudi market snapshots and multilingual names', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'quickpos-country-profile-migration-'))
    const client = createClient({ url: `file:${path.join(directory, 'legacy.db')}` })
    const database = drizzle(client)
    const db = database as unknown as MigrateUpArgs['db']
    const args = { db } as MigrateUpArgs

    try {
      await initialSchema(args)
      await addBusinessInformation(args)
      await addBusinessContactsAndLogo(args)
      await addReceiptVouchers(args)
      await addReceiptVoucherStatusWorkflow(args)
      await defaultVatExclusiveProducts(args)
      await addServiceBoardAndDashboard(args)

      await db.run(sql`INSERT INTO shop_settings (
        id, seller_name_arabic, seller_name_english, cr_number, vat_number,
        business_address, default_price_includes_vat
      ) VALUES (1, 'متجر', 'Legacy Shop', 'CR-1', '310000000000003', 'Riyadh', true);`)
      await db.run(sql`INSERT INTO products (
        id, name_english, name_arabic, name_bangla, price_minor, vat_category,
        price_includes_vat, active
      ) VALUES ('legacy-product', 'Haircut', 'قص شعر', 'চুল কাটা', 10000, 'standard', true, true);`)
      await db.run(sql`INSERT INTO invoices (
        id, invoice_number, idempotency_key, invoice_type, sales_channel, issued_at,
        seller_name_arabic, seller_name_english, seller_vat_number, seller_address,
        subtotal_minor, vat_minor, total_minor, qr_payload
      ) VALUES (
        'legacy-invoice', 'INV-LEGACY', '10000000-0000-4000-8000-000000000010',
        'simplified', 'checkout', '2026-11-17T12:00:00.000Z', 'متجر', 'Legacy Shop',
        '310000000000003', 'Riyadh', 8696, 1304, 10000, 'legacy-qr'
      );`)
      await db.run(sql`INSERT INTO invoices_items (
        _order, _parent_id, id, product_id, description_english, description_arabic,
        description_bangla, quantity_milliunits, unit_price_minor, price_includes_vat,
        vat_category, vat_rate_bps, net_minor, vat_minor, total_minor
      ) VALUES (
        1, 'legacy-invoice', 'legacy-item', 'legacy-product', 'Haircut', 'قص شعر',
        'চুল কাটা', 1000, 10000, true, 'standard', 1500, 8696, 1304, 10000
      );`)

      // Simulate the empty child tables left by a cancelled development push.
      await db.run(sql`CREATE TABLE products_translations (stale text);`)
      await db.run(sql`CREATE TABLE invoices_seller_registrations (stale text);`)
      await db.run(sql`CREATE TABLE invoices_items_translations (stale text);`)
      await db.run(sql`CREATE TABLE receipt_vouchers_business_registrations (stale text);`)
      await db.run(sql`CREATE TABLE shop_settings_registrations (stale text);`)
      await db.run(sql`CREATE TABLE __new_invoices (stale text);`)
      await db.run(sql`INSERT INTO service_board_settings (id) VALUES (1);`)
      await db.run(sql`INSERT INTO service_board_settings_columns (
        _order, _parent_id, id, product_id
      ) VALUES (1, 1, 'legacy-column', 'legacy-product');`)
      await db.run(sql`INSERT INTO payload_locked_documents (id) VALUES (1);`)
      await db.run(sql`INSERT INTO payload_locked_documents_rels (
        id, parent_id, path, products_id
      ) VALUES (1, 1, 'products', 'legacy-product');`)

      await database.transaction(async (transaction) => {
        await addCountryProfiles({
          db: transaction as unknown as MigrateUpArgs['db'],
        } as MigrateUpArgs)
      })
      await database.transaction(async (transaction) => {
        const transactionArgs = {
          db: transaction as unknown as MigrateUpArgs['db'],
        } as MigrateUpArgs
        await makeProductNamesNullable(transactionArgs)
        await makeProductNamesNullable(transactionArgs)
      })

      const settings = await db.run(
        sql`SELECT country_code, secondary_language FROM shop_settings WHERE id = 1;`,
      )
      const invoice = await db.run(
        sql`SELECT country_code, currency_code, time_zone, tax_mode, qr_payload FROM invoices WHERE id = 'legacy-invoice';`,
      )
      const product = await db.run(
        sql`SELECT id, name_arabic, name_bangla FROM products WHERE id = 'legacy-product';`,
      )
      const productTranslations = await db.run(
        sql`SELECT language, name FROM products_translations WHERE _parent_id = 'legacy-product' ORDER BY _order;`,
      )
      const itemTranslations = await db.run(
        sql`SELECT language, name FROM invoices_items_translations WHERE _parent_id = 'legacy-item' ORDER BY _order;`,
      )
      const productColumns = await db.run(sql`PRAGMA table_info('products');`)
      const itemProduct = await db.run(
        sql`SELECT product_id FROM invoices_items WHERE id = 'legacy-item';`,
      )
      const boardProduct = await db.run(
        sql`SELECT product_id FROM service_board_settings_columns WHERE id = 'legacy-column';`,
      )
      const lockedProduct = await db.run(
        sql`SELECT products_id FROM payload_locked_documents_rels WHERE id = 1;`,
      )

      assert.deepEqual(settings.rows[0], { country_code: 'SA', secondary_language: 'ar' })
      assert.deepEqual(product.rows[0], {
        id: 'legacy-product',
        name_arabic: 'قص شعر',
        name_bangla: 'চুল কাটা',
      })
      assert.deepEqual(invoice.rows[0], {
        country_code: 'SA',
        currency_code: 'SAR',
        qr_payload: 'legacy-qr',
        tax_mode: 'saudiVat',
        time_zone: 'Asia/Riyadh',
      })
      assert.deepEqual(productTranslations.rows, [
        { language: 'ar', name: 'قص شعر' },
        { language: 'bn', name: 'চুল কাটা' },
      ])
      assert.deepEqual(itemTranslations.rows, [
        { language: 'ar', name: 'قص شعر' },
        { language: 'bn', name: 'চুল কাটা' },
      ])
      const arabicNameColumn = productColumns.rows.find(
        (column) => String(column.name) === 'name_arabic',
      )
      assert.equal(Number(arabicNameColumn?.notnull), 0)
      assert.equal(itemProduct.rows[0]?.product_id, 'legacy-product')
      assert.equal(boardProduct.rows[0]?.product_id, 'legacy-product')
      assert.equal(lockedProduct.rows[0]?.products_id, 'legacy-product')
    } finally {
      client.close()
      rmSync(directory, { force: true, recursive: true })
    }
  })
})
