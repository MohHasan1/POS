import config from '@payload-config'
import { getPayload } from 'payload'

import type { Employee, ShopSetting } from '@/payload-types'
import { updateShopSettings } from './settings'

export type EmployeeInput = Pick<
  Employee,
  'address' | 'email' | 'employeeCode' | 'name' | 'notes' | 'phone' | 'role'
>

export type EmployeeCompensationInput = Pick<
  Employee,
  'compensationType' | 'monthlySalaryMinor'
>

export function employeeRelationshipId(
  value: Employee | null | string | undefined,
): string | undefined {
  return typeof value === 'string' ? value : value?.id
}

export async function getEmployees(includeInactive = false): Promise<Employee[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'employees',
    pagination: false,
    sort: 'name',
    where: includeInactive ? undefined : { active: { equals: true } },
  })
  return result.docs
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const payload = await getPayload({ config })
  try {
    return await payload.findByID({ collection: 'employees', id })
  } catch {
    return null
  }
}

export async function createEmployee(data: EmployeeInput): Promise<Employee> {
  const payload = await getPayload({ config })
  return payload.create({
    collection: 'employees',
    data: { ...data, active: true, compensationType: 'unconfigured' },
  })
}

export async function updateEmployee(id: string, data: EmployeeInput): Promise<Employee> {
  const payload = await getPayload({ config })
  return payload.update({ collection: 'employees', id, data })
}

export async function updateEmployeeCompensation(
  id: string,
  data: EmployeeCompensationInput,
): Promise<Employee> {
  const payload = await getPayload({ config })
  return payload.update({ collection: 'employees', id, data })
}

export async function setEmployeeActive(
  id: string,
  active: boolean,
  settings: ShopSetting,
): Promise<Employee> {
  const payload = await getPayload({ config })
  const employee = await payload.update({ collection: 'employees', id, data: { active } })
  if (!active && employeeRelationshipId(settings.defaultEmployee) === id) {
    await updateShopSettings({ defaultEmployee: null })
  }
  return employee
}

export async function setDefaultEmployee(
  employeeId: null | string,
): Promise<ShopSetting> {
  if (employeeId) {
    const employee = await getEmployee(employeeId)
    if (!employee?.active) throw new Error('Choose an active employee as the default.')
  }
  return updateShopSettings({ defaultEmployee: employeeId })
}
