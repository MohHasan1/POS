import { LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { LockScreenIdentity } from '@/lib/pos-access'

export function LockScreenCard({ identity, title, description, children }: {
  identity: LockScreenIdentity
  title: ReactNode
  description: ReactNode
  children: ReactNode
}) {
  const date = new Intl.DateTimeFormat(identity.dateLocale, {
    dateStyle: 'full',
    timeZone: identity.timeZone,
  }).format(new Date())

  return (
    <div className="mx-auto w-full max-w-sm space-y-5">
      <div className="flex items-center gap-3 px-1">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-card/80 text-foreground">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="break-words font-semibold" dir="auto">{identity.shopName}</p>
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>{date}</p>
        </div>
      </div>
      <Card className="rounded-xl border-0 shadow-md shadow-black/5 dark:shadow-black/25">
        <CardHeader className="p-5 pb-4 sm:px-6 sm:pt-6">
          {title}
          {description}
        </CardHeader>
        <CardContent className="px-5 pb-4 sm:px-6 sm:pb-5">{children}</CardContent>
      </Card>
    </div>
  )
}
