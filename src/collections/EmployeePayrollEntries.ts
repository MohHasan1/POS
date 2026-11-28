import { randomUUID } from 'node:crypto'
import type { CollectionConfig } from 'payload'
import { postCashPayroll } from '@/services/cash-postings'

const authenticated = ({ req }: { req: { user: unknown } }) => Boolean(req.user)

export const EmployeePayrollEntries: CollectionConfig = {
  slug: 'employee-payroll-entries',
  hooks: { afterChange: [postCashPayroll] },
  admin: {
    defaultColumns: ['employee', 'entryType', 'entryDate', 'amountMinor'],
  },
  access: {
    create: authenticated,
    delete: () => false,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    { name: 'id', type: 'text', required: true, defaultValue: () => randomUUID() },
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
      index: true,
    },
    {
      name: 'employeeSnapshot',
      type: 'group',
      fields: [{ name: 'name', type: 'text', required: true, maxLength: 160 }],
    },
    {
      name: 'entryType',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Monthly salary', value: 'monthlySalary' },
        { label: 'Payout / advance', value: 'payout' },
      ],
    },
    { name: 'entryDate', type: 'date', required: true, index: true },
    { name: 'salaryMonth', type: 'text', maxLength: 7, index: true },
    { name: 'amountMinor', type: 'number', required: true, min: 1 },
    { name: 'countryCode', type: 'text', required: true },
    { name: 'currencyCode', type: 'text', required: true },
    { name: 'currencyMinorUnitDigits', type: 'number', required: true },
    { name: 'timeZone', type: 'text', required: true },
    {
      name: 'paymentMethod',
      type: 'select',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Bank', value: 'bank' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'reference', type: 'text', maxLength: 120 },
    { name: 'note', type: 'textarea', maxLength: 500 },
  ],
}
