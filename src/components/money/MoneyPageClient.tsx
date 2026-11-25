'use client'

import { ChevronDown, ChevronUp, Pencil, Plus, Receipt, RotateCcw, Users, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useMemo, useState, useTransition } from 'react'

import { voidMoneyAccountAction, voidMoneyPaymentAction } from '@/actions/money'
import { MoneyAccountDialog } from '@/components/money/MoneyAccountDialog'
import { MoneyPaymentDialog } from '@/components/money/MoneyPaymentDialog'
import { MoneyTabs } from '@/components/money/MoneyTabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatMarketDate, toMarketDateInput } from '@/lib/calendar'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale } from '@/lib/market'
import type { MoneyAccountView, MoneyDashboard, MoneyDerivedStatus, MoneyDirection, MoneyInvoiceOption, MoneyKind } from '@/lib/money-types'
import { formatMoney, formatQuantity } from '@/lib/money'
import type { MoneyPayment, Product } from '@/payload-types'

const ALL = '__all__'
const PAGE_SIZE = 15

function relationId(value: { id: string } | null | string | undefined) {
  return typeof value === 'string' ? value : value?.id
}

function kindLabel(kind: MoneyKind, dictionary: Dictionary) {
  if (kind === 'unpaidInvoice') return dictionary.unpaidInvoice
  if (kind === 'moneyLent') return dictionary.moneyLent
  if (kind === 'supplierCredit') return dictionary.supplierCredit
  if (kind === 'borrowedMoney') return dictionary.borrowedMoney
  return dictionary.otherMoney
}

function statusLabel(status: MoneyDerivedStatus, dictionary: Dictionary) {
  if (status === 'open') return dictionary.moneyStatusOpen
  if (status === 'overdue') return dictionary.moneyStatusOverdue
  if (status === 'paid') return dictionary.moneyStatusPaid
  return dictionary.voided
}

type VoidTarget = { kind: 'account'; view: MoneyAccountView } | { kind: 'payment'; payment: MoneyPayment } | null

export function MoneyPageClient({
  dashboard,
  dictionary,
  direction,
  invoices,
  initialInvoiceId,
  initialSearch,
  locale,
  products,
  today,
}: {
  dashboard: MoneyDashboard
  dictionary: Dictionary
  direction: MoneyDirection
  invoices: MoneyInvoiceOption[]
  initialInvoiceId?: string
  initialSearch?: string
  locale: Locale
  products: Product[]
  today: string
}) {
  const router = useRouter()
  const displayLocale = marketLocale(dashboard.market, locale)
  const [accountDialog, setAccountDialog] = useState<MoneyAccountView | null | undefined>(initialInvoiceId ? null : undefined)
  const [paymentDialog, setPaymentDialog] = useState<{ full: boolean; view: MoneyAccountView } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState(initialSearch || '')
  const [status, setStatus] = useState(ALL)
  const [kind, setKind] = useState(ALL)
  const [person, setPerson] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [voidTarget, setVoidTarget] = useState<VoidTarget>(null)
  const [voidReason, setVoidReason] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const money = (value: number) => formatMoney(value, dashboard.market, displayLocale)
  const kinds: MoneyKind[] = direction === 'owedToUs'
    ? ['unpaidInvoice', 'moneyLent', 'other']
    : ['supplierCredit', 'borrowedMoney', 'other']

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return dashboard.accounts.filter((view) => {
      const account = view.account
      const accountDate = toMarketDateInput(account.recordDate, dashboard.market)
      const invoice = typeof account.invoice === 'string' ? undefined : account.invoice
      const searchable = [
        account.recordNumber,
        account.personSnapshot.name,
        account.personSnapshot.phone,
        account.reference,
        invoice?.invoiceNumber,
        ...(account.products || []).map(({ productSnapshot }) => productSnapshot.name),
      ]
      return (status === ALL || view.derivedStatus === status) &&
        (kind === ALL || account.kind === kind) &&
        (person === ALL || relationId(account.person) === person) &&
        (!from || accountDate >= from) && (!to || accountDate <= to) &&
        (!query || searchable.filter(Boolean).some((value) => value!.toLocaleLowerCase().includes(query)))
    })
  }, [dashboard.accounts, dashboard.market, from, kind, person, search, status, to])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function reset() {
    setSearch(''); setStatus(ALL); setKind(ALL); setPerson(ALL); setFrom(''); setTo(''); setPage(1)
  }

  function submitVoid() {
    if (!voidTarget) return
    setError('')
    startTransition(async () => {
      const result = voidTarget.kind === 'account'
        ? await voidMoneyAccountAction(voidTarget.view.account.id, voidReason)
        : await voidMoneyPaymentAction(voidTarget.payment.id, voidReason)
      if (!result.ok) return setError(result.error)
      setVoidTarget(null)
      setVoidReason('')
      router.refresh()
    })
  }

  return <div className="space-y-5">
    <MoneyTabs dictionary={dictionary} />
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">{direction === 'owedToUs' ? dictionary.owedToUs : dictionary.weOwe}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{direction === 'owedToUs' ? dictionary.owedToUsDescription : dictionary.weOweDescription}</p>
    </header>
    <section className="flex flex-wrap gap-2">
      <Button variant="success" onClick={() => setAccountDialog(null)}><Plus />{direction === 'owedToUs' ? dictionary.addOwedToUs : dictionary.addWeOwe}</Button>
      <Button variant="outline" nativeButton={false} render={<Link href="/people" />}>
        <Users aria-hidden="true" />
        {dictionary.managePeople}
      </Button>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        [dictionary.outstandingNow, money(dashboard.summary.remainingMinor)],
        [dictionary.overdueNow, money(dashboard.summary.overdueMinor)],
        [direction === 'owedToUs' ? dictionary.totalMoneyReceived : dictionary.totalMoneyPaid, money(dashboard.summary.paidMinor)],
        [dictionary.openRecords, new Intl.NumberFormat(displayLocale).format(dashboard.summary.openRecords)],
      ].map(([label, value]) => <Card key={label}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></CardContent></Card>)}
    </section>
    <Card>
      <CardHeader><CardTitle>{dictionary.balancesByPerson}</CardTitle></CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {dashboard.personBalances.map(({ openRecords, person: balancePerson, remainingMinor }) => <Button key={balancePerson.id} type="button" variant="ghost" className="h-auto justify-start rounded-lg bg-muted/50 p-3 text-left" onClick={() => { setPerson(balancePerson.id); setPage(1) }}><span className="block w-full"><span className="font-medium">{balancePerson.name}</span>{balancePerson.phone && <span className="block text-xs text-muted-foreground">{balancePerson.phone}</span>}<span className="mt-2 flex justify-between gap-6 text-sm"><span>{openRecords} {dictionary.openRecords.toLocaleLowerCase()}</span><strong className="tabular-nums">{money(remainingMinor)}</strong></span></span></Button>)}
        {!dashboard.personBalances.length && <p className="py-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">{dictionary.noPeopleBalances}</p>}
      </CardContent>
    </Card>
    {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
    <Card>
      <CardHeader><CardTitle>{dictionary.recordHistory}</CardTitle></CardHeader>
      <CardContent className="space-y-4 p-0">
        <div className="grid gap-2 px-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Input type="search" className="lg:col-span-2" placeholder={dictionary.searchMoneyRecords} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
          <Select value={status} onValueChange={(value) => { setStatus(value || ALL); setPage(1) }}><SelectTrigger className="w-full"><SelectValue>{status === ALL ? dictionary.allMoneyStatuses : statusLabel(status as MoneyDerivedStatus, dictionary)}</SelectValue></SelectTrigger><SelectContent><SelectItem value={ALL}>{dictionary.allMoneyStatuses}</SelectItem>{(['open', 'overdue', 'paid', 'voided'] as const).map((value) => <SelectItem key={value} value={value}>{statusLabel(value, dictionary)}</SelectItem>)}</SelectContent></Select>
          <Select value={kind} onValueChange={(value) => { setKind(value || ALL); setPage(1) }}><SelectTrigger className="w-full"><SelectValue>{kind === ALL ? dictionary.allMoneyTypes : kindLabel(kind as MoneyKind, dictionary)}</SelectValue></SelectTrigger><SelectContent><SelectItem value={ALL}>{dictionary.allMoneyTypes}</SelectItem>{kinds.map((value) => <SelectItem key={value} value={value}>{kindLabel(value, dictionary)}</SelectItem>)}</SelectContent></Select>
          <Select value={person} onValueChange={(value) => { setPerson(value || ALL); setPage(1) }}><SelectTrigger className="w-full"><SelectValue>{person === ALL ? dictionary.allPeople : dashboard.people.find(({ id }) => id === person)?.name}</SelectValue></SelectTrigger><SelectContent><SelectItem value={ALL}>{dictionary.allPeople}</SelectItem>{dashboard.people.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          <Input type="date" aria-label={dictionary.fromDate} value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} />
          <Input type="date" aria-label={dictionary.toDate} value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} />
        </div>
        <div className="px-4"><Button size="sm" variant="outline" onClick={reset}><RotateCcw />{dictionary.resetFilters}</Button></div>
        <div className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>{dictionary.date}</TableHead><TableHead>{dictionary.person}</TableHead><TableHead>{dictionary.type}</TableHead><TableHead className="text-right">{dictionary.originalAmount}</TableHead><TableHead className="text-right">{dictionary.amountPaid}</TableHead><TableHead className="text-right">{dictionary.amountRemaining}</TableHead><TableHead>{dictionary.status}</TableHead><TableHead className="text-right">{dictionary.actions}</TableHead></TableRow></TableHeader><TableBody>
            {visible.map((view) => {
              const account = view.account
              const invoice = typeof account.invoice === 'string' ? undefined : account.invoice
              const isExpanded = expanded === account.id
              return <Fragment key={account.id}><TableRow><TableCell className="whitespace-nowrap">{formatMarketDate(account.recordDate, dashboard.market, displayLocale)}<span className="block text-xs text-muted-foreground">{account.recordNumber}</span></TableCell><TableCell><span className="font-medium">{account.personSnapshot.name}</span>{account.personSnapshot.phone && <span className="block text-xs text-muted-foreground">{account.personSnapshot.phone}</span>}</TableCell><TableCell>{kindLabel(account.kind, dictionary)}{invoice && <Link className="block text-xs text-primary hover:underline" href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>}{account.products?.map((row) => <span key={row.id} className="block text-xs text-muted-foreground">{row.productSnapshot.name} × {formatQuantity(row.quantityMilliunits, displayLocale)}</span>)}</TableCell><TableCell className="text-right tabular-nums">{money(account.originalAmountMinor)}</TableCell><TableCell className="text-right tabular-nums">{money(view.paidMinor)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{money(view.remainingMinor)}</TableCell><TableCell><Badge variant={view.derivedStatus === 'overdue' ? 'destructive' : view.derivedStatus === 'paid' ? 'secondary' : 'outline'}>{statusLabel(view.derivedStatus, dictionary)}</Badge>{account.dueDate && <span className="mt-1 block text-xs text-muted-foreground">{formatMarketDate(account.dueDate, dashboard.market, displayLocale)}</span>}</TableCell><TableCell><div className="flex justify-end gap-1">
                <Button size="icon-sm" variant="ghost" title={dictionary.paymentHistory} onClick={() => setExpanded(isExpanded ? null : account.id)}>{isExpanded ? <ChevronUp /> : <ChevronDown />}</Button>
                {account.status === 'confirmed' && <Button size="icon-sm" variant="ghost" title={dictionary.edit} onClick={() => setAccountDialog(view)}><Pencil /></Button>}
                {account.status === 'confirmed' && view.remainingMinor > 0 && <><Button size="sm" variant="success" onClick={() => setPaymentDialog({ full: false, view })}>{dictionary.addPayment}</Button><Button size="sm" variant="outline" onClick={() => setPaymentDialog({ full: true, view })}>{dictionary.payFullAmount}</Button></>}
                {account.status === 'confirmed' && <Button size="icon-sm" variant="destructive" title={dictionary.void} onClick={() => { setVoidTarget({ kind: 'account', view }); setVoidReason('') }}><XCircle /></Button>}
              </div></TableCell></TableRow>
              {isExpanded && <TableRow><TableCell colSpan={8} className="bg-muted/25"><div className="space-y-2"><p className="text-sm font-medium">{dictionary.paymentHistory}</p>{view.payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-2 text-sm"><span>{formatMarketDate(payment.paymentDate, dashboard.market, displayLocale)}</span><strong className="tabular-nums">{money(payment.amountMinor)}</strong><span className="text-muted-foreground">{dictionary[`payment_${payment.paymentMethod}`]}</span><Badge variant={payment.status === 'confirmed' ? 'secondary' : 'outline'}>{payment.status === 'confirmed' ? dictionary.confirmed : dictionary.voided}</Badge>{payment.receiptVoucher && <Link href={`/receipt-vouchers/${relationId(payment.receiptVoucher)}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Receipt className="size-3" />{dictionary.receiptVouchers}</Link>}<span className="flex-1" />{payment.status === 'confirmed' && <Button size="sm" variant="destructive" onClick={() => { setVoidTarget({ kind: 'payment', payment }); setVoidReason('') }}>{dictionary.void}</Button>}</div>)}{!view.payments.length && <p className="text-sm text-muted-foreground">{dictionary.noPayments}</p>}</div></TableCell></TableRow>}
              </Fragment>
            })}
          </TableBody></Table>
          {!visible.length && <p className="p-8 text-center text-sm text-muted-foreground">{dictionary.noMoneyRecords}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-4 pb-4"><span className="text-sm text-muted-foreground">{dictionary.pageOf.replace('{page}', String(page)).replace('{total}', String(totalPages))}</span><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{dictionary.previous}</Button><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>{dictionary.next}</Button></div>
      </CardContent>
    </Card>
    <MoneyAccountDialog key={accountDialog === null ? `new-account-${initialInvoiceId || ''}` : `account-${accountDialog?.account.id || 'closed'}`} dictionary={dictionary} direction={direction} initialInvoiceId={initialInvoiceId} invoices={invoices} market={dashboard.market} onClose={() => setAccountDialog(undefined)} people={dashboard.people} products={products} today={today} view={accountDialog} />
    <MoneyPaymentDialog key={paymentDialog ? `${paymentDialog.view.account.id}:${paymentDialog.full}` : 'closed-payment'} dictionary={dictionary} full={paymentDialog?.full || false} market={dashboard.market} onClose={() => setPaymentDialog(null)} today={today} view={paymentDialog?.view || null} />
    <Dialog open={Boolean(voidTarget)} onOpenChange={(open) => !open && setVoidTarget(null)}><DialogContent><DialogHeader><DialogTitle>{voidTarget?.kind === 'payment' ? dictionary.voidPayment : dictionary.voidMoneyRecord}</DialogTitle><DialogDescription>{voidTarget?.kind === 'payment' ? dictionary.voidPaymentWarning : dictionary.voidMoneyRecordWarning}</DialogDescription></DialogHeader><div className="space-y-1.5"><Label htmlFor="void-money-reason">{dictionary.reason} *</Label><Textarea id="void-money-reason" required maxLength={500} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} /></div>{error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}<DialogFooter><Button variant="cancel" onClick={() => setVoidTarget(null)}>{dictionary.cancel}</Button><Button variant="destructive" disabled={pending || !voidReason.trim()} onClick={submitVoid}>{dictionary.void}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
