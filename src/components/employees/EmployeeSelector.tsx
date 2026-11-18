'use client'

import { Plus } from 'lucide-react'
import { type SubmitEvent, useMemo, useState, useTransition } from 'react'

import { quickCreateEmployeeAction } from '@/actions/employees'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Dictionary } from '@/lib/localization'
import type { EmployeeSummary } from '@/lib/pos-types'

const NO_EMPLOYEE = '__none__'

export function EmployeeSelector({
  dictionary,
  employees,
  onValueChange,
  value,
}: {
  dictionary: Dictionary
  employees: EmployeeSummary[]
  onValueChange: (employeeId: string | null) => void
  value: string | null
}) {
  const [createdEmployees, setCreatedEmployees] = useState<EmployeeSummary[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const availableEmployees = useMemo(() => {
    const byId = new Map(employees.map((employee) => [employee.id, employee]))
    for (const employee of createdEmployees) byId.set(employee.id, employee)
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [createdEmployees, employees])

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setError('')
    startTransition(async () => {
      const result = await quickCreateEmployeeAction({
        employeeCode: String(formData.get('employeeCode') || ''),
        name: String(formData.get('name') || ''),
        role: String(formData.get('role') || ''),
      })
      if (!result.ok || !result.data) {
        setError(result.ok ? 'Unable to create employee.' : result.error)
        return
      }
      const employee = result.data
      setCreatedEmployees((current) =>
        [...current.filter(({ id }) => id !== employee.id), employee].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      )
      onValueChange(employee.id)
      form.reset()
      setDialogOpen(false)
    })
  }

  const selected = availableEmployees.find((employee) => employee.id === value)

  return (
    <div className="space-y-1.5">
      <Label>{dictionary.employeeInvoiceAssignment}</Label>
      <div className="flex gap-2">
        <Select
          value={value || NO_EMPLOYEE}
          onValueChange={(next) => onValueChange(next === NO_EMPLOYEE ? null : next)}
        >
          <SelectTrigger className="min-w-0 flex-1 bg-background">
            <SelectValue>{selected?.name || dictionary.noEmployee}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_EMPLOYEE}>{dictionary.noEmployee}</SelectItem>
            {availableEmployees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
                {employee.role ? ` — ${employee.role}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus /> <span className="hidden sm:inline">{dictionary.addEmployee}</span>
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dictionary.quickCreateEmployee}</DialogTitle>
            <DialogDescription>{dictionary.employeeDescription}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="quick-employee-name">
                {dictionary.employeeName} <span className="text-destructive">*</span>
              </Label>
              <Input id="quick-employee-name" name="name" required maxLength={160} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quick-employee-code">{dictionary.employeeCode}</Label>
                <Input
                  id="quick-employee-code"
                  name="employeeCode"
                  maxLength={40}
                  placeholder="EMP-A1B2C3D4"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-employee-role">{dictionary.employeeRole}</Label>
                <Input id="quick-employee-role" name="role" maxLength={100} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="cancel"
                disabled={pending}
                onClick={() => setDialogOpen(false)}
              >
                {dictionary.cancel}
              </Button>
              <Button
                type="submit"
                variant="success"
                disabled={pending}
              >
                {pending ? dictionary.saving : dictionary.addEmployee}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
