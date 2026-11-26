export const POS_ACCESS_PATH = '/api/quickpos/access'
export const POS_TIMEOUT_OPTIONS = [1, 5, 10, 15, 30, 60] as const
export const DEFAULT_POS_TIMEOUT = 5
export const POS_PASSWORD_MAX = 128
export const POS_ACCESS_EVENT = 'quickpos:access-changed'

export type LockScreenIdentity = {
  shopName: string
  dateLocale: string
  timeZone: string
}

export type PosAccessStatus = {
  configured: boolean
  unlocked: boolean
  timeoutMinutes: number
  expiresAt: number | null
}

export type PosAccessRequest =
  | { operation: 'setup'; password: string; confirmation: string }
  | { operation: 'change'; currentPassword: string; password: string; confirmation: string }
  | { operation: 'recover'; code: string; password: string; confirmation: string }
  | { operation: 'unlock'; password: string }
  | { operation: 'timeout'; minutes: number }
  | { operation: 'activity' | 'lock' }

export type PosAccessErrorCode =
  | 'invalidInput'
  | 'invalidPassword'
  | 'invalidRecovery'
  | 'tryAgainLater'
  | 'locked'
  | 'alreadyConfigured'
  | 'unavailable'

export type PosAccessResponse =
  | { ok: true; status: PosAccessStatus; recoveryCode?: string }
  | { ok: false; error: PosAccessErrorCode }

export function safePosReturnPath(value?: string) {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  const url = new URL(value, 'http://quickpos.local')
  if (url.origin !== 'http://quickpos.local' || /^\/(api|admin|unlock)(\/|$)/.test(url.pathname)) return '/'
  return url.pathname + url.search
}
