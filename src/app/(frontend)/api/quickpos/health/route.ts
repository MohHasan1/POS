import config from '@payload-config'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-sqlite'
import { getPayload, type Migration } from 'payload'

import { migrations } from '@/migrations'

export const dynamic = 'force-dynamic'

type HealthDetails = {
  invoices: number
  products: number
}

let readiness: Promise<HealthDetails> | undefined
const runtimeMigrations: Migration[] = migrations.map(({ down, name, up }) => ({
  down: (args) => down(args as MigrateDownArgs),
  name,
  up: (args) => up(args as MigrateUpArgs),
}))

async function prepareApplication(): Promise<HealthDetails> {
  const payload = await getPayload({ config })

  if (process.env.QUICKPOS_MIGRATE_ON_STARTUP === '1') {
    await payload.db.migrate({ migrations: runtimeMigrations })
  }

  const [products, invoices] = await Promise.all([
    payload.count({ collection: 'products' }),
    payload.count({ collection: 'invoices' }),
  ])

  return {
    invoices: invoices.totalDocs,
    products: products.totalDocs,
  }
}

export async function GET() {
  readiness ??= prepareApplication()

  try {
    const details = await readiness

    return Response.json(
      { app: 'QuickPOS', database: 'ready', status: 'ok', ...details },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('QuickPOS startup database check failed.', error)

    return Response.json(
      { app: 'QuickPOS', database: 'error', status: 'error' },
      { headers: { 'Cache-Control': 'no-store' }, status: 503 },
    )
  }
}
