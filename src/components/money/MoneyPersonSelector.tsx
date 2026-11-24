'use client'

import { Plus } from 'lucide-react'
import { type SubmitEvent, useMemo, useState, useTransition } from 'react'

import { createMoneyPersonAction } from '@/actions/money'
import { Button } from '@/components/ui/button'
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem, ComboboxTrigger } from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/localization'
import type { MoneyPerson } from '@/payload-types'

export function MoneyPersonSelector({
  dictionary,
  idPrefix,
  onValueChange,
  people,
  value,
}: {
  dictionary: Dictionary
  idPrefix: string
  onValueChange: (person: MoneyPerson) => void
  people: MoneyPerson[]
  value: string
}) {
  const [createdPeople, setCreatedPeople] = useState<MoneyPerson[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const availablePeople = useMemo(() => {
    const byId = new Map(people.map((person) => [person.id, person]))
    for (const person of createdPeople) byId.set(person.id, person)
    return [...byId.values()].filter(({ active }) => active).sort((a, b) => a.name.localeCompare(b.name))
  }, [createdPeople, people])
  const selected = availablePeople.find(({ id }) => id === value) || null

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const name = String(formData.get('name') || '')
    const phone = String(formData.get('phone') || '')
    setError('')
    startTransition(async () => {
      const result = await createMoneyPersonAction({ name, phone: phone || undefined })
      if (!result.ok || !result.data) {
        setError(result.ok ? dictionary.genericError : result.error)
        return
      }
      const person: MoneyPerson = {
        active: true,
        createdAt: new Date().toISOString(),
        id: result.data.id,
        name: result.data.name,
        phone: phone || null,
        updatedAt: new Date().toISOString(),
      }
      setCreatedPeople((current) => [...current.filter(({ id }) => id !== person.id), person])
      onValueChange(person)
      form.reset()
      setDialogOpen(false)
    })
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor={`${idPrefix}-person`}>{dictionary.person} <span className="text-destructive">*</span></Label>
      <div className="flex gap-2">
        <Combobox
          items={availablePeople}
          value={selected}
          itemToStringLabel={(person: MoneyPerson) => person.name}
          filter={(person: MoneyPerson, query) => {
            const normalized = query.trim().toLocaleLowerCase()
            return !normalized || [person.name, person.phone]
              .filter(Boolean)
              .some((item) => item!.toLocaleLowerCase().includes(normalized))
          }}
          onValueChange={(person: MoneyPerson | null) => person && onValueChange(person)}
        >
          <ComboboxInputGroup className="min-w-0 flex-1 bg-background">
            <ComboboxInput id={`${idPrefix}-person`} placeholder={dictionary.selectPerson} />
            <ComboboxTrigger aria-label={dictionary.selectPerson} />
          </ComboboxInputGroup>
          <ComboboxContent emptyText={dictionary.noPeopleBalances}>
            {(person: MoneyPerson) => (
              <ComboboxItem key={person.id} value={person}>
                <span className="min-w-0"><span className="block truncate font-medium">{person.name}</span>{person.phone && <span className="block truncate text-xs text-muted-foreground">{person.phone}</span>}</span>
              </ComboboxItem>
            )}
          </ComboboxContent>
        </Combobox>
        <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus /> <span className="hidden sm:inline">{dictionary.create}</span>
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dictionary.createPerson}</DialogTitle>
            <DialogDescription>{dictionary.personFormDescription}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5"><Label htmlFor={`${idPrefix}-new-person-name`}>{dictionary.person} <span className="text-destructive">*</span></Label><Input id={`${idPrefix}-new-person-name`} name="name" required maxLength={160} /></div>
            <div className="space-y-1.5"><Label htmlFor={`${idPrefix}-new-person-phone`}>{dictionary.phoneOptional}</Label><Input id={`${idPrefix}-new-person-phone`} name="phone" maxLength={40} /></div>
            {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
            <DialogFooter><Button type="button" variant="cancel" disabled={pending} onClick={() => setDialogOpen(false)}>{dictionary.cancel}</Button><Button type="submit" variant="success" disabled={pending}>{pending ? dictionary.saving : dictionary.create}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
