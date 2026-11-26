import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/localization'

export function RecoveryCode({ code, dictionary, onDone }: {
  code: string
  dictionary: Dictionary
  onDone: () => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{dictionary.posAccess.recoveryCode}</p>
      <p className="text-sm text-muted-foreground">{dictionary.posAccess.saveRecoveryCode}</p>
      <code className="block break-all rounded-md bg-muted p-3 font-mono text-sm" dir="ltr">{code}</code>
      <Button type="button" onClick={onDone}>{dictionary.posAccess.recoverySaved}</Button>
    </div>
  )
}
