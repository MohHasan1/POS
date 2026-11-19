import { Badge } from '@/components/ui/badge'
import type { CompensationType } from '@/lib/payroll-types'

const planClasses: Record<CompensationType, string> = {
  commission: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  monthly: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  unconfigured: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
}

export function CompensationPlanBadge({
  label,
  type,
}: {
  label: string
  type: CompensationType
}) {
  return (
    <Badge className={planClasses[type]} variant="secondary">
      {label}
    </Badge>
  )
}
