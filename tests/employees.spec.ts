import config from '@payload-config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import {
  createEmployee,
  employeeRelationshipId,
  getEmployees,
  setDefaultEmployee,
  setEmployeeActive,
  updateEmployee,
} from '@/services/employees'
import { finalizeInvoice, getInvoice } from '@/services/invoices'
import { getShopSettings, updateShopSettings } from '@/services/settings'

const employeeIds: string[] = []
const invoiceIds: string[] = []

function saleInput(employeeId?: string | null) {
  return {
    employeeId,
    idempotencyKey: randomUUID(),
    invoiceType: 'simplified' as const,
    items: [
      {
        descriptionArabic: 'خدمة الموظف',
        descriptionEnglish: 'Employee service',
        priceIncludesVat: true,
        quantityMilliunits: 1000,
        unitPriceMinor: 1150,
        vatCategory: 'standard' as const,
      },
    ],
  }
}

describe('employee assignment', () => {
  after(async () => {
    const payload = await getPayload({ config })
    await updateShopSettings({ defaultEmployee: null })
    for (const id of invoiceIds) await payload.delete({ collection: 'invoices', id })
    for (const id of employeeIds) await payload.delete({ collection: 'employees', id })
  })

  it('manages the default employee and clears it when deactivated', async () => {
    await updateShopSettings({
      businessAddress: 'Riyadh, Saudi Arabia',
      countryCode: 'SA',
      sellerNameArabic: 'متجر الاختبار',
      sellerNameEnglish: 'Test Shop',
      secondaryLanguage: 'ar',
      vatNumber: '310000000000003',
    })
    const employee = await createEmployee({
      employeeCode: `EMP-${randomUUID().slice(0, 8)}`,
      name: 'Amina Rahman',
      role: 'Stylist',
    })
    employeeIds.push(employee.id)

    await setDefaultEmployee(employee.id)
    let settings = await getShopSettings()
    assert.equal(employeeRelationshipId(settings.defaultEmployee), employee.id)
    assert.equal((await getEmployees()).some(({ id }) => id === employee.id), true)

    await setEmployeeActive(employee.id, false, settings)
    settings = await getShopSettings()
    assert.equal(employeeRelationshipId(settings.defaultEmployee), undefined)
    assert.equal((await getEmployees()).some(({ id }) => id === employee.id), false)
    assert.equal((await getEmployees(true)).some(({ id }) => id === employee.id), true)

    await setEmployeeActive(employee.id, true, settings)
  })

  it('stores an immutable name snapshot and preserves it for idempotent retries', async () => {
    const employee = (await getEmployees(true)).find(({ id }) => employeeIds.includes(id))!
    const input = saleInput(employee.id)
    const invoice = await finalizeInvoice(input)
    invoiceIds.push(invoice.id)

    assert.equal(employeeRelationshipId(invoice.employee), employee.id)
    assert.equal(invoice.employeeSnapshot?.name, 'Amina Rahman')

    await updateEmployee(employee.id, { name: 'Amina Updated', role: 'Senior Stylist' })
    await setEmployeeActive(employee.id, false, await getShopSettings())

    const saved = await getInvoice(invoice.id)
    assert.equal(saved?.employeeSnapshot?.name, 'Amina Rahman')
    assert.equal((await finalizeInvoice(input)).id, invoice.id)

    await assert.rejects(finalizeInvoice(saleInput(employee.id)), /missing or inactive/)

    const unassigned = await finalizeInvoice(saleInput(null))
    invoiceIds.push(unassigned.id)
    assert.equal(unassigned.employee, null)
    assert.equal(unassigned.employeeSnapshot?.name, null)
  })
})
