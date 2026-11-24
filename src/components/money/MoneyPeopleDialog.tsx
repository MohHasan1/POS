'use client'

import { Pencil, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState, useTransition } from 'react'

import { createMoneyPersonAction, updateMoneyPersonAction } from '@/actions/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Dictionary } from '@/lib/localization'
import type { MoneyPerson } from '@/payload-types'

export function MoneyPeopleDialog({ dictionary, onClose, people }: { dictionary: Dictionary; onClose: () => void; people: MoneyPerson[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<MoneyPerson | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function edit(person?: MoneyPerson) {
    setEditing(person || null)
    setName(person?.name || '')
    setPhone(person?.phone || '')
    setNote(person?.note || '')
    setError('')
    setShowForm(true)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    startTransition(async () => {
      const result = editing
        ? await updateMoneyPersonAction(editing.id, { active: editing.active, name, note: note || undefined, phone: phone || undefined })
        : await createMoneyPersonAction({ name, note: note || undefined, phone: phone || undefined })
      if (!result.ok) return setError(result.error)
      setShowForm(false)
      router.refresh()
    })
  }

  function toggle(person: MoneyPerson) {
    startTransition(async () => {
      const result = await updateMoneyPersonAction(person.id, { active: !person.active, name: person.name, note: person.note || undefined, phone: person.phone || undefined })
      if (!result.ok) return setError(result.error)
      router.refresh()
    })
  }

  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{dictionary.managePeople}</DialogTitle><DialogDescription>{dictionary.personFormDescription}</DialogDescription></DialogHeader>
    {!showForm && <div className="space-y-3"><Button type="button" variant="success" onClick={() => edit()}><Plus />{dictionary.createPerson}</Button><div className="divide-y rounded-lg bg-muted/30">{people.map((person) => <div key={person.id} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="font-medium">{person.name}</p>{person.phone && <p className="text-xs text-muted-foreground">{person.phone}</p>}</div><Badge variant={person.active ? 'secondary' : 'outline'}>{person.active ? dictionary.active : dictionary.inactive}</Badge><Button type="button" size="icon-sm" variant="ghost" title={dictionary.edit} onClick={() => edit(person)}><Pencil /></Button><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => toggle(person)}>{person.active ? dictionary.deactivate : dictionary.activate}</Button></div>)}{!people.length && <p className="p-6 text-center text-sm text-muted-foreground">{dictionary.noPeopleBalances}</p>}</div></div>}
    {showForm && <form className="space-y-4" onSubmit={submit}><div className="space-y-1.5"><Label htmlFor="person-name">{dictionary.person} *</Label><Input id="person-name" required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="person-phone">{dictionary.phoneOptional}</Label><Input id="person-phone" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="person-note">{dictionary.note}</Label><Textarea id="person-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></div>{error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}<DialogFooter><Button type="button" variant="cancel" onClick={() => setShowForm(false)}>{dictionary.cancel}</Button><Button type="submit" variant="success" disabled={pending}>{pending ? dictionary.saving : dictionary.save}</Button></DialogFooter></form>}
    {!showForm && error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
  </DialogContent></Dialog>
}
