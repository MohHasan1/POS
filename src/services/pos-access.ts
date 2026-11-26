import config from '@payload-config'
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { getPayload, type Payload, type PayloadRequest } from 'payload'

import {
  DEFAULT_POS_TIMEOUT,
  POS_PASSWORD_MAX,
  POS_TIMEOUT_OPTIONS,
  type PosAccessRequest,
  type PosAccessResponse,
  type PosAccessStatus,
} from '@/lib/pos-access'
import type { PosSecurity, PosSession } from '@/payload-types'

const scryptAsync = promisify(scrypt)
const SECURITY_ID = 'quickpos'
const MINUTE = 60_000
const COOLDOWN = MINUTE
const MAX_ATTEMPTS = 5
type RequestContext = Partial<PayloadRequest>
type AccessMutation = { response: PosAccessResponse; sessionToken?: string | null }

export const POS_SESSION_COOKIE = 'quickpos-pos-session'

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${key.toString('hex')}`
}

async function verifyPassword(password: string, stored: string) {
  if (!password || password.length > POS_PASSWORD_MAX) return false
  const [salt, expected] = stored.split(':')
  if (!salt || expected?.length !== 128) return false
  const actual = (await scryptAsync(password, salt, 64)) as Buffer
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'))
}

function newRecoveryCode() {
  const value = randomBytes(24).toString('hex')
  return { code: value.match(/.{6}/g)!.join('-'), hash: digest(value) }
}

function verifyRecoveryCode(code: string, expected: string) {
  const value = code.toLowerCase().replace(/[\s-]/g, '')
  return /^[a-f0-9]{48}$/.test(value) &&
    timingSafeEqual(Buffer.from(digest(value), 'hex'), Buffer.from(expected, 'hex'))
}

async function readSecurity(payload: Payload, req?: RequestContext) {
  return payload.findByID({
    collection: 'pos-security',
    id: SECURITY_ID,
    depth: 0,
    disableErrors: true,
    req,
  })
}

function expiry(security: PosSecurity, session: PosSession) {
  return Math.min(
    Date.parse(session.lastActivityAt) + security.timeoutMinutes * MINUTE,
    Date.parse(session.expiresAt),
  )
}

async function readSession(
  payload: Payload,
  security: PosSecurity,
  token: string | undefined,
  now: number,
  req?: RequestContext,
) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const session = await payload.findByID({
    collection: 'pos-sessions',
    id: digest(token),
    depth: 0,
    disableErrors: true,
    req,
  })
  return session?.generation === security.generation && expiry(security, session) > now
    ? session
    : null
}

function status(security?: PosSecurity | null, session?: PosSession | null): PosAccessStatus {
  return {
    configured: Boolean(security),
    unlocked: !security || Boolean(session),
    timeoutMinutes: security?.timeoutMinutes ?? DEFAULT_POS_TIMEOUT,
    expiresAt: security && session ? expiry(security, session) : null,
  }
}

export async function getPosAccessStatus(token?: string, now = Date.now(), req?: RequestContext) {
  const payload = req?.payload ?? await getPayload({ config })
  const security = await readSecurity(payload, req)
  return status(security, security ? await readSession(payload, security, token, now, req) : null)
}

function activityDates(now: number, minutes: number) {
  return {
    lastActivityAt: new Date(now).toISOString(),
    expiresAt: new Date(now + minutes * MINUTE).toISOString(),
  }
}

async function createSession(
  payload: Payload,
  generation: string,
  minutes: number,
  now: number,
  req: RequestContext,
) {
  const token = randomBytes(32).toString('hex')
  await payload.delete({
    collection: 'pos-sessions',
    where: { lastActivityAt: { less_than_equal: new Date(now - 60 * MINUTE).toISOString() } },
    req,
  })
  const session = await payload.create({
    collection: 'pos-sessions',
    data: { id: digest(token), generation, ...activityDates(now, minutes) },
    req,
  })
  return { token, session }
}

function failure(error: Extract<PosAccessResponse, { ok: false }>['error']): AccessMutation {
  return { response: { ok: false, error } }
}

async function verifyCredential(
  payload: Payload,
  security: PosSecurity,
  value: string,
  recovery: boolean,
  now: number,
  req: RequestContext,
): Promise<AccessMutation | undefined> {
  const until = recovery ? 'recoveryBlockedUntil' : 'unlockBlockedUntil'
  const attempts = recovery ? 'failedRecoveries' : 'failedUnlocks'
  const blockedUntil = security[until]
  if (blockedUntil && Date.parse(blockedUntil) > now) return failure('tryAgainLater')
  const valid = recovery
    ? verifyRecoveryCode(value, security.recoveryHash)
    : await verifyPassword(value, security.passwordHash)
  const failures = valid ? 0 : (blockedUntil ? 0 : security[attempts]) + 1
  await payload.update({
    collection: 'pos-security',
    id: SECURITY_ID,
    data: {
      [attempts]: failures,
      [until]: failures >= MAX_ATTEMPTS ? new Date(now + COOLDOWN).toISOString() : null,
    },
    req,
  })
  if (!valid) return failure(recovery ? 'invalidRecovery' : 'invalidPassword')
}

async function perform(
  payload: Payload,
  input: PosAccessRequest,
  token: string | undefined,
  now: number,
  req: RequestContext,
): Promise<AccessMutation> {
  const security = await readSecurity(payload, req)
  const operation = input.operation
  if (operation === 'setup' && security) return failure('alreadyConfigured')
  if (operation !== 'setup' && !security) return failure('locked')

  const session = security ? await readSession(payload, security, token, now, req) : null
  if ((operation === 'change' || operation === 'timeout' || operation === 'activity') && !session) {
    return failure('locked')
  }

  if (operation === 'setup' || operation === 'change' || operation === 'recover') {
    const { password, confirmation } = input
    if (!password || password !== confirmation || password.length > POS_PASSWORD_MAX) {
      return failure('invalidInput')
    }
    if (security && operation !== 'setup') {
      const recovery = operation === 'recover'
      const error = await verifyCredential(
        payload, security, recovery ? input.code : input.currentPassword, recovery, now, req,
      )
      if (error) return error
    }
    const recovery = operation === 'change' ? undefined : newRecoveryCode()
    const generation = randomUUID()
    const passwordHash = await hashPassword(password)
    const issued = await createSession(payload, generation, security?.timeoutMinutes ?? DEFAULT_POS_TIMEOUT, now, req)
    const data = { passwordHash, generation, failedUnlocks: 0, unlockBlockedUntil: null }
    const updated = security
      ? await payload.update({
          collection: 'pos-security',
          id: SECURITY_ID,
          data: recovery ? { ...data, recoveryHash: recovery.hash } : data,
          req,
        })
      : await payload.create({
          collection: 'pos-security',
          data: {
            ...data,
            id: SECURITY_ID,
            recoveryHash: recovery!.hash,
            timeoutMinutes: DEFAULT_POS_TIMEOUT,
            failedRecoveries: 0,
          },
          req,
        })
    return {
      response: { ok: true, status: status(updated, issued.session), recoveryCode: recovery?.code },
      sessionToken: issued.token,
    }
  }

  if (!security) return failure('locked')
  switch (operation) {
    case 'unlock': {
      const error = await verifyCredential(payload, security, input.password, false, now, req)
      if (error) return error
      const issued = await createSession(payload, security.generation, security.timeoutMinutes, now, req)
      if (session) await payload.delete({ collection: 'pos-sessions', id: session.id, req })
      return { response: { ok: true, status: status(security, issued.session) }, sessionToken: issued.token }
    }
    case 'lock': {
      if (session) await payload.delete({ collection: 'pos-sessions', id: session.id, req })
      return { response: { ok: true, status: status(security) }, sessionToken: null }
    }
    case 'activity': {
      const updated = await payload.update({
        collection: 'pos-sessions',
        id: session!.id,
        data: activityDates(now, security.timeoutMinutes),
        req,
      })
      return { response: { ok: true, status: status(security, updated) } }
    }
    case 'timeout': {
      if (!POS_TIMEOUT_OPTIONS.some((minutes) => minutes === input.minutes)) return failure('invalidInput')
      if (input.minutes < security.timeoutMinutes) {
        const { docs } = await payload.find({
          collection: 'pos-sessions',
          depth: 0,
          pagination: false,
          where: {
            generation: { equals: security.generation },
            id: { not_equals: session!.id },
          },
          req,
        })
        for (const other of docs) {
          const deadline = Date.parse(other.lastActivityAt) + input.minutes * MINUTE
          if (deadline < Date.parse(other.expiresAt)) {
            await payload.update({
              collection: 'pos-sessions',
              id: other.id,
              data: { expiresAt: new Date(deadline).toISOString() },
              req,
            })
          }
        }
      }
      const updated = await payload.update({
        collection: 'pos-security',
        id: SECURITY_ID,
        data: { timeoutMinutes: input.minutes },
        req,
      })
      const updatedSession = await payload.update({
        collection: 'pos-sessions',
        id: session!.id,
        data: activityDates(now, input.minutes),
        req,
      })
      return { response: { ok: true, status: status(updated, updatedSession) } }
    }
  }
}

let pendingMutation: Promise<unknown> = Promise.resolve()

export function changePosAccess(
  input: PosAccessRequest,
  token?: string,
  testNow?: number,
): Promise<AccessMutation> {
  // Serialize settings changes even on standalone adapters without DB transactions.
  const operation = pendingMutation.then(async () => {
    const payload = await getPayload({ config })
    const transactionID = await payload.db.beginTransaction()
    const req = { payload, transactionID: transactionID ?? undefined }
    try {
      const result = await perform(payload, input, token, testNow ?? Date.now(), req)
      if (transactionID != null) await payload.db.commitTransaction(transactionID)
      return result
    } catch (error) {
      if (transactionID != null) await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
      throw error
    }
  })
  pendingMutation = operation.catch(() => undefined)
  return operation
}
