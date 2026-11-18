'use client'

import { Pencil, Plus, Search, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { setDefaultEmployeeAction, setEmployeeActiveAction } from '@/actions/employees'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Dictionary } from '@/lib/localization'
import type { Employee } from '@/payload-types'

export function EmployeesManager({
  defaultEmployeeId,
  dictionary,
  employees,
}: {
  defaultEmployeeId?: string
  dictionary: Dictionary
  employees: Employee[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Employee | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const query = search.trim().toLocaleLowerCase()
  const filtered = employees.filter((employee) =>
    [employee.name, employee.employeeCode, employee.role, employee.phone, employee.email]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(query)),
  )

  function openForm(employee: Employee | null) {
    setEditing(employee)
    setDialogOpen(true)
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError('')
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setError(result.error || 'Unable to update employee.')
      else router.refresh()
    })
  }

  return (
    <section className="rounded-lg border bg-background">
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
          <Input
            aria-label={dictionary.search}
            className="pl-8"
            placeholder={dictionary.searchEmployees}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button onClick={() => openForm(null)}>
          <Plus /> {dictionary.addEmployee}
        </Button>
      </div>
      {error && <p className="border-b p-3 text-sm text-destructive" role="alert">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{dictionary.employeeName}</TableHead>
            <TableHead>{dictionary.employeeCode}</TableHead>
            <TableHead>{dictionary.employeeRole}</TableHead>
            <TableHead>{dictionary.status}</TableHead>
            <TableHead>{dictionary.defaultEmployee}</TableHead>
            <TableHead className="text-right">{dictionary.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((employee) => {
            const isDefault = employee.id === defaultEmployeeId
            return (
              <TableRow key={employee.id}>
                <TableCell>
                  <p className="font-medium">{employee.name}</p>
                  <p className="text-xs text-muted-foreground">{employee.phone || employee.email || '—'}</p>
                </TableCell>
                <TableCell>{employee.employeeCode || '—'}</TableCell>
                <TableCell>{employee.role || '—'}</TableCell>
                <TableCell>
                  <Badge variant={employee.active ? 'secondary' : 'outline'}>
                    {employee.active ? dictionary.active : dictionary.inactive}
                  </Badge>
                </TableCell>
                <TableCell>
                  {isDefault ? <Badge><Star className="size-3" />{dictionary.defaultEmployee}</Badge> : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openForm(employee)}>
                      <Pencil /> {dictionary.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending || !employee.active}
                      onClick={() => run(() => setDefaultEmployeeAction(isDefault ? null : employee.id))}
                    >
                      <Star /> {isDefault ? dictionary.clearDefault : dictionary.setAsDefault}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => run(() => setEmployeeActiveAction(employee.id, !employee.active))}
                    >
                      {employee.active ? dictionary.deactivate : dictionary.activate}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {dictionary.noEmployees}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? dictionary.editEmployee : dictionary.addEmployee}</DialogTitle>
            <DialogDescription>{dictionary.employeeDescription}</DialogDescription>
          </DialogHeader>
          <EmployeeForm
            key={editing?.id || 'new'}
            dictionary={dictionary}
            employee={editing}
            onDone={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  )
}
