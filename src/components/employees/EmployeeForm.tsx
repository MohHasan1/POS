'use client'

import { useRouter } from 'next/navigation'
import { type SubmitEvent, useState, useTransition } from 'react'

import {
  createEmployeeAction,
  updateEmployeeAction,
  type EmployeeActionInput,
} from '@/actions/employees'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary } from '@/lib/localization'
import type { Employee } from '@/payload-types'

export function EmployeeForm({
  dictionary,
  employee,
  onDone,
}: {
  dictionary: Dictionary
  employee: Employee | null
  onDone: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const input: EmployeeActionInput = {
      address: String(formData.get('address') || ''),
      email: String(formData.get('email') || ''),
      employeeCode: String(formData.get('employeeCode') || ''),
      name: String(formData.get('name') || ''),
      notes: String(formData.get('notes') || ''),
      phone: String(formData.get('phone') || ''),
      role: String(formData.get('role') || ''),
    }

    setError('')
    startTransition(async () => {
      const result = employee
        ? await updateEmployeeAction(employee.id, input)
        : await createEmployeeAction(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
      onDone()
    })
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="employee-name">
            {dictionary.employeeName} <span className="text-destructive">*</span>
          </Label>
          <Input id="employee-name" name="name" defaultValue={employee?.name || ''} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employee-code">{dictionary.employeeCode}</Label>
          <Input
            id="employee-code"
            name="employeeCode"
            placeholder="EMP-A1B2C3D4"
            defaultValue={employee?.employeeCode || ''}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employee-role">{dictionary.employeeRole}</Label>
          <Input id="employee-role" name="role" defaultValue={employee?.role || ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employee-phone">{dictionary.employeePhone}</Label>
          <Input id="employee-phone" name="phone" defaultValue={employee?.phone || ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employee-email">{dictionary.employeeEmail}</Label>
          <Input
            id="employee-email"
            name="email"
            type="email"
            defaultValue={employee?.email || ''}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="employee-address">{dictionary.employeeAddress}</Label>
          <Textarea
            id="employee-address"
            name="address"
            maxLength={500}
            defaultValue={employee?.address || ''}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="employee-notes">{dictionary.employeeNotes}</Label>
          <Textarea
            id="employee-notes"
            name="notes"
            maxLength={500}
            defaultValue={employee?.notes || ''}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="cancel" onClick={onDone} disabled={pending}>
          {dictionary.cancel}
        </Button>
        <Button
          type="submit"
          variant="success"
          disabled={pending}
        >
          {pending ? dictionary.saving : employee ? dictionary.save : dictionary.addEmployee}
        </Button>
      </DialogFooter>
    </form>
  )
}
