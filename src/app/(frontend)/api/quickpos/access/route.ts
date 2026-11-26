import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { POS_PASSWORD_MAX } from '@/lib/pos-access'
import { changePosAccess, getPosAccessStatus, POS_SESSION_COOKIE } from '@/services/pos-access'

export const dynamic = 'force-dynamic'
const password = z.string().max(POS_PASSWORD_MAX)
const newPasswordFields = { password, confirmation: password }
const inputSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('setup'), ...newPasswordFields }),
  z.object({ operation: z.literal('change'), currentPassword: password, ...newPasswordFields }),
  z.object({ operation: z.literal('recover'), code: z.string().max(100), ...newPasswordFields }),
  z.object({ operation: z.literal('unlock'), password }),
  z.object({ operation: z.literal('timeout'), minutes: z.number().int() }),
  z.object({ operation: z.literal('activity') }),
  z.object({ operation: z.literal('lock') }),
])

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: NextRequest) {
  try {
    const status = await getPosAccessStatus(request.cookies.get(POS_SESSION_COOKIE)?.value)
    return json({ ok: true, status })
  } catch {
    return json({ ok: false, error: 'unavailable' }, 503)
  }
}

export async function POST(request: NextRequest) {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (request.headers.get('x-quickpos-access') !== '1' || (fetchSite && fetchSite !== 'same-origin')) {
    return json({ ok: false, error: 'locked' }, 403)
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => undefined))
  if (!parsed.success) return json({ ok: false, error: 'invalidInput' }, 400)

  try {
    const { response, sessionToken } = await changePosAccess(
      parsed.data,
      request.cookies.get(POS_SESSION_COOKIE)?.value,
    )
    const result = json(response)
    if (sessionToken !== undefined) {
      const secure = request.headers.get('origin')?.startsWith('https://') ?? request.nextUrl.protocol === 'https:'
      result.cookies.set(POS_SESSION_COOKIE, sessionToken ?? '', {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        ...(sessionToken === null ? { maxAge: 0 } : {}),
      })
    }
    return result
  } catch {
    return json({ ok: false, error: 'unavailable' }, 503)
  }
}
