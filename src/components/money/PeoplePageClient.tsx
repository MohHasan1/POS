'use client'

import { ContactRound, Mail, MapPin, Pencil, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'

import { createMoneyPersonAction, updateMoneyPersonAction } from '@/actions/money'
import { Badge } from '@/components/ui/badge'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary } from '@/lib/localization'
import type { MoneyPerson } from '@/payload-types'

const ALL = '__all__'

export function PeoplePageClient({
  dictionary,
  people,
}: {
  dictionary: Dictionary
  people: MoneyPerson[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(ALL)
  const [formPerson, setFormPerson] = useState<MoneyPerson | null | undefined>(undefined)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return people.filter((person) => {
      const matchesStatus =
        status === ALL || (status === 'active' ? person.active : !person.active)
      const fields = [person.name, person.phone, person.email, person.address, person.note]
      return (
        matchesStatus &&
        (!query ||
          fields.some((value) => value?.toLocaleLowerCase().includes(query)))
      )
    })
  }, [people, search, status])

  function openForm(person: MoneyPerson | null) {
    setFormPerson(person)
    setName(person?.name || '')
    setPhone(person?.phone || '')
    setEmail(person?.email || '')
    setAddress(person?.address || '')
    setNote(person?.note || '')
    setError('')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    startTransition(async () => {
      const details = {
        address: address || undefined,
        email: email || undefined,
        name,
        note: note || undefined,
        phone: phone || undefined,
      }
      const result = formPerson
        ? await updateMoneyPersonAction(formPerson.id, {
            ...details,
            active: formPerson.active,
          })
        : await createMoneyPersonAction(details)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setFormPerson(undefined)
      router.refresh()
    })
  }

  function toggleActive(person: MoneyPerson) {
    setError('')
    startTransition(async () => {
      const result = await updateMoneyPersonAction(person.id, {
        active: !person.active,
        address: person.address || undefined,
        email: person.email || undefined,
        name: person.name,
        note: person.note || undefined,
        phone: person.phone || undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.people}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dictionary.peopleDescription}</p>
        </div>
        <Button type="button" variant="success" onClick={() => openForm(null)}>
          <Plus aria-hidden="true" />
          {dictionary.createPerson}
        </Button>
      </header>

      <section className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            className="pl-8"
            aria-label={dictionary.searchPeople}
            placeholder={dictionary.searchPeople}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value || ALL)}>
          <SelectTrigger aria-label={dictionary.status} className="w-full">
            <SelectValue>
              {status === ALL
                ? dictionary.allPeopleStatuses
                : status === 'active'
                  ? dictionary.active
                  : dictionary.inactive}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{dictionary.allPeopleStatuses}</SelectItem>
            <SelectItem value="active">{dictionary.active}</SelectItem>
            <SelectItem value="inactive">{dictionary.inactive}</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {error && formPerson === undefined && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dictionary.person}</TableHead>
              <TableHead>{dictionary.contact}</TableHead>
              <TableHead>{dictionary.address}</TableHead>
              <TableHead>{dictionary.status}</TableHead>
              <TableHead className="text-right">{dictionary.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPeople.map((person) => (
              <TableRow key={person.id}>
                <TableCell>
                  <span className="font-medium">{person.name}</span>
                  {person.note && (
                    <span className="block max-w-72 truncate text-xs text-muted-foreground">
                      {person.note}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {person.phone && <span className="block">{person.phone}</span>}
                  {person.email && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="size-3" aria-hidden="true" />
                      {person.email}
                    </span>
                  )}
                  {!person.phone && !person.email && <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {person.address ? (
                    <span className="flex max-w-72 items-start gap-1 text-sm">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="line-clamp-2">{person.address}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={person.active ? 'secondary' : 'outline'}>
                    {person.active ? dictionary.active : dictionary.inactive}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={dictionary.editPerson}
                      title={dictionary.editPerson}
                      onClick={() => openForm(person)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => toggleActive(person)}
                    >
                      {person.active ? dictionary.deactivate : dictionary.activate}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredPeople.length === 0 && (
          <div className="p-10 text-center">
            <ContactRound className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">{dictionary.noPeople}</p>
          </div>
        )}
      </div>

      <Dialog
        open={formPerson !== undefined}
        onOpenChange={(open) => !open && setFormPerson(undefined)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {formPerson ? dictionary.editPerson : dictionary.createPerson}
            </DialogTitle>
            <DialogDescription>{dictionary.personDetailsDescription}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="person-page-name">{dictionary.person} *</Label>
              <Input
                id="person-page-name"
                required
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="person-page-phone">{dictionary.phoneOptional}</Label>
                <Input
                  id="person-page-phone"
                  type="tel"
                  maxLength={40}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="person-page-email">{dictionary.emailOptional}</Label>
                <Input
                  id="person-page-email"
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-page-address">{dictionary.addressOptional}</Label>
              <Textarea
                id="person-page-address"
                maxLength={300}
                rows={2}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-page-note">{dictionary.note}</Label>
              <Textarea
                id="person-page-note"
                maxLength={500}
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            {error && formPerson !== undefined && (
              <p
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="cancel" onClick={() => setFormPerson(undefined)}>
                {dictionary.cancel}
              </Button>
              <Button type="submit" variant="success" disabled={pending}>
                {pending ? dictionary.saving : dictionary.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
