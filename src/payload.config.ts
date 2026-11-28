import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Invoices } from './collections/Invoices'
import { CashClosings } from './collections/CashClosings'
import { CashLedger } from './collections/CashLedger'
import { ExpenseCategories } from './collections/ExpenseCategories'
import { Expenses } from './collections/Expenses'
import { ExpenseTemplates } from './collections/ExpenseTemplates'
import { Employees } from './collections/Employees'
import { EmployeeCommissionOverrides } from './collections/EmployeeCommissionOverrides'
import { EmployeeCommissionRates } from './collections/EmployeeCommissionRates'
import { EmployeePayrollEntries } from './collections/EmployeePayrollEntries'
import { InvoiceCostOverrides } from './collections/InvoiceCostOverrides'
import { Media } from './collections/Media'
import { MoneyAccounts } from './collections/MoneyAccounts'
import { MoneyPayments } from './collections/MoneyPayments'
import { MoneyPeople } from './collections/MoneyPeople'
import { PosSecurity, PosSessions } from './collections/PosAccess'
import { Products } from './collections/Products'
import { ReceiptVouchers } from './collections/ReceiptVouchers'
import { Supplies, SupplyPurchases, SupplyUsages } from './collections/Supplies'
import { Users } from './collections/Users'
import { ShopSettings } from './globals/ShopSettings'
import { ServiceBoardSettings } from './globals/ServiceBoardSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const databaseURL = process.env.DATABASE_URL || 'file:./pos.db'
const payloadSecret = process.env.PAYLOAD_SECRET

if (!payloadSecret) {
  throw new Error('PAYLOAD_SECRET is required.')
}

const db =
  process.env.DATABASE_ADAPTER === 'mongodb'
    ? mongooseAdapter({ url: databaseURL })
    : sqliteAdapter({
        busyTimeout: 5000,
        client: { url: databaseURL },
        migrationDir: path.resolve(dirname, 'migrations'),
        push: process.env.QUICKPOS_SCHEMA_PUSH === '1',
        transactionOptions: { behavior: 'immediate' },
        wal: { journalSizeLimit: 67_108_864, synchronous: 'FULL' },
      })

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    CashLedger,
    CashClosings,
    Products,
    Employees,
    EmployeeCommissionRates,
    Invoices,
    EmployeeCommissionOverrides,
    EmployeePayrollEntries,
    ExpenseCategories,
    ExpenseTemplates,
    Expenses,
    MoneyPeople,
    MoneyAccounts,
    MoneyPayments,
    PosSecurity,
    PosSessions,
    InvoiceCostOverrides,
    ReceiptVouchers,
    Supplies,
    SupplyPurchases,
    SupplyUsages,
    Media,
  ],
  globals: [ShopSettings, ServiceBoardSettings],
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db,
  plugins: [],
  upload: {
    requestSizeLimit: 2_200_000,
    safeFileNames: true,
  },
})
