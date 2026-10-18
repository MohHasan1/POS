'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { issueReceiptVoucherAction } from '@/actions/receipt-vouchers'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Dictionary } from '@/lib/localization'

export function IssueReceiptVoucherButton({
  dictionary,
  id,
}: {
  dictionary: Dictionary
  id: string
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function issue() {
    setError('')
    startTransition(async () => {
      const result = await issueReceiptVoucherAction(id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{dictionary.markAsIssued}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dictionary.issueVoucherTitle}</DialogTitle>
            <DialogDescription>{dictionary.issueVoucherConfirmation}</DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {dictionary.cancel}
            </Button>
            <Button type="button" onClick={issue} disabled={pending}>
              {pending ? dictionary.issuingVoucher : dictionary.markAsIssued}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
