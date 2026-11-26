import {
  POS_ACCESS_EVENT,
  POS_ACCESS_PATH,
  type PosAccessRequest,
  type PosAccessResponse,
  type PosAccessStatus,
} from '@/lib/pos-access'

export async function requestPosAccess(input?: PosAccessRequest): Promise<PosAccessResponse> {
  try {
    const response = await fetch(POS_ACCESS_PATH, {
      cache: 'no-store',
      ...(input && {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-QuickPOS-Access': '1' },
        body: JSON.stringify(input),
      }),
    })
    return await response.json()
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}

export function notifyPosAccessChanged(status: PosAccessStatus) {
  window.dispatchEvent(new CustomEvent(POS_ACCESS_EVENT, { detail: status }))
  try {
    window.localStorage.setItem(POS_ACCESS_EVENT, `${Date.now()}-${Math.random()}`)
  } catch {
    // Tabs without storage access reconcile on focus and on their next status check.
  }
}
