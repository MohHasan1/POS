import { Badge } from '@/components/ui/badge'
import type { Dictionary } from '@/lib/localization'
import type { ReceiptVoucher } from '@/payload-types'

export function ReceiptVoucherStatusBadge({
  dictionary,
  status,
}: {
  dictionary: Dictionary
  status: ReceiptVoucher['status']
}) {
  const label =
    status === 'draft'
      ? dictionary.draftStatus
      : status === 'issued'
        ? dictionary.issuedStatus
        : dictionary.voidStatus
  const variant = status === 'voided' ? 'destructive' : status === 'draft' ? 'outline' : 'secondary'

  return <Badge variant={variant}>{label}</Badge>
}
