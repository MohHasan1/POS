import type { Metadata } from 'next'

import { EmployeesManager } from '@/components/employees/EmployeesManager'
import { getDictionary } from '@/lib/localization'
import { employeeRelationshipId, getEmployees } from '@/services/employees'
import { getProducts } from '@/services/products'
import { getShopSettings, marketContextFromSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Employees' }

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ compensation?: string }>
}) {
  const [{ dictionary }, employees, products, settings, params] = await Promise.all([
    getDictionary(),
    getEmployees(true),
    getProducts(true),
    getShopSettings(),
    searchParams,
  ])
  const market = marketContextFromSettings(settings)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.employees}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.employeeDescription}</p>
      </header>
      <EmployeesManager
        key={params.compensation || 'employees'}
        defaultEmployeeId={employeeRelationshipId(settings.defaultEmployee)}
        dictionary={dictionary}
        employees={employees}
        initialCompensationEmployeeId={params.compensation}
        market={market.profile}
        products={products}
      />
    </div>
  )
}
