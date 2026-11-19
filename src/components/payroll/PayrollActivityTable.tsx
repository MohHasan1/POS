'use client'

import { Pencil, Percent } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import {
  PayrollDialog,
  type PayrollDialogKind,
} from '@/components/payroll/PayrollClient'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMarketDate } from '@/lib/calendar'
import type { Dictionary, Locale } from '@/lib/localization'
import { marketLocale } from '@/lib/market'
import { formatMoney } from '@/lib/money'
import type { PayrollActivity, PayrollDashboard } from '@/lib/payroll-types'
import type { Employee } from '@/payload-types'

export function PayrollActivityTable({
  activities,
  dashboard,
  dictionary,
  employees,
  locale,
}: {
  activities: PayrollActivity[]
  dashboard: PayrollDashboard
  dictionary: Dictionary
  employees: Employee[]
  locale: Locale
}) {
  const dateLocale = marketLocale(dashboard.market, locale)
  const [selectedActivity, setSelectedActivity] = useState<PayrollActivity | null>(null)
  const [dialog, setDialog] = useState<PayrollDialogKind>(null)

  function openActivity(activity: PayrollActivity) {
    setSelectedActivity(activity)
    setDialog(activity.kind === 'commission' ? 'commission' : 'edit')
  }

  if (!activities.length) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{dictionary.noPayrollActivity}</p>
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dictionary.date}</TableHead>
              <TableHead>{dictionary.employee}</TableHead>
              <TableHead>{dictionary.type}</TableHead>
              <TableHead>{dictionary.invoiceNumber}</TableHead>
              <TableHead className="text-right">{dictionary.amount}</TableHead>
              <TableHead className="text-right">{dictionary.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity) => (
              <TableRow key={activity.id}>
                <TableCell>{formatMarketDate(activity.date, dashboard.market, dateLocale)}</TableCell>
                <TableCell className="font-medium">{activity.employeeName}</TableCell>
                <TableCell>
                  <span>{dictionary[`payroll_${activity.kind}`]}</span>
                  {activity.serviceName && (
                    <span className="block text-xs text-muted-foreground">{activity.serviceName}</span>
                  )}
                </TableCell>
                <TableCell>
                  {activity.invoiceId ? (
                    <Link className="text-sm underline underline-offset-2" href={`/invoices/${activity.invoiceId}`}>
                      {activity.invoiceNumber}
                    </Link>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(activity.correctedAmountMinor ?? activity.amountMinor, dashboard.market, dateLocale)}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openActivity(activity)}>
                    {activity.kind === 'commission' ? <Percent /> : <Pencil />}
                    {activity.kind === 'commission' ? dictionary.correctCommission : dictionary.edit}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PayrollDialog
        key={`${dialog || 'closed'}:${selectedActivity?.id || 'activity'}`}
        activity={selectedActivity}
        dashboard={dashboard}
        dictionary={dictionary}
        employees={employees}
        kind={dialog}
        onClose={() => {
          setDialog(null)
          setSelectedActivity(null)
        }}
      />
    </>
  )
}
