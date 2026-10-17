import { WifiOff } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <WifiOff className="mb-4 size-8" aria-hidden="true" />
      <h1 className="text-xl font-semibold">You are offline</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reconnect before managing products or finalizing a sale. Offline transactions are not stored.
      </p>
      <Link href="/" className={buttonVariants({ className: 'mt-5' })}>
        Try again
      </Link>
    </div>
  )
}
