import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/lib/localization'
import { POS_PASSWORD_MAX } from '@/lib/pos-access'

export function PasswordFields({ dictionary, id, current = false }: {
  dictionary: Dictionary
  id: string
  current?: boolean
}) {
  return (
    <>
      {current && (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-current`}>{dictionary.posAccess.currentPassword}</Label>
          <Input id={`${id}-current`} name="currentPassword" type="password" autoComplete="current-password" maxLength={POS_PASSWORD_MAX} required />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-password`}>{dictionary.posAccess.newPassword}</Label>
        <Input id={`${id}-password`} name="password" type="password" autoComplete="new-password" maxLength={POS_PASSWORD_MAX} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-confirmation`}>{dictionary.posAccess.confirmPassword}</Label>
        <Input id={`${id}-confirmation`} name="confirmation" type="password" autoComplete="new-password" maxLength={POS_PASSWORD_MAX} required />
      </div>
    </>
  )
}
