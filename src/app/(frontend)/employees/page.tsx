import type { Metadata } from 'next'

import { EmployeesManager } from '@/components/employees/EmployeesManager'
import { getDictionary } from '@/lib/localization'
import { employeeRelationshipId, getEmployees } from '@/services/employees'
import { getShopSettings } from '@/services/settings'

export const metadata: Metadata = { title: 'Employees' }

export default async function EmployeesPage() {
  const [{ dictionary }, employees, settings] = await Promise.all([
    getDictionary(),
    getEmployees(true),
    getShopSettings(),
  ])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dictionary.employees}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{dictionary.employeeDescription}</p>
      </header>
      <EmployeesManager
        defaultEmployeeId={employeeRelationshipId(settings.defaultEmployee)}
        dictionary={dictionary}
        employees={employees}
      />
    </div>
  )
}
