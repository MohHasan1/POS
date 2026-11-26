import config from '@payload-config'
import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import { getPayload } from 'payload'

import { safePosReturnPath } from '@/lib/pos-access'
import { changePosAccess, getPosAccessStatus } from '@/services/pos-access'

const password = 'a'
const replacement = 'b'
const recoveredPassword = 'c'
const minute = 60_000
const start = Date.parse('2026-11-25T12:00:00Z')

describe('QuickPOS access', () => {
  after(async () => {
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'pos-sessions', where: { id: { exists: true } } })
    await payload.delete({
      collection: 'pos-security',
      where: { id: { equals: 'quickpos' } },
    })
  })

  it('preserves internal destinations and blocks external and admin destinations', () => {
    assert.equal(safePosReturnPath('/reports/print?period=month'), '/reports/print?period=month')
    for (const path of ['https://example.com', '//example.com', '/\n/example.com', '/api/quickpos/health', '/admin', '/unlock']) {
      assert.equal(safePosReturnPath(path), '/')
    }
  })

  it('bootstraps once, enforces idle expiry, changes passwords and recovers access once', async () => {
    assert.deepEqual(await getPosAccessStatus(undefined, start), {
      configured: false, unlocked: true, timeoutMinutes: 5, expiresAt: null,
    })
    const empty = await changePosAccess({ operation: 'setup', password: '', confirmation: '' }, undefined, start)
    assert.deepEqual(empty.response, { ok: false, error: 'invalidInput' })
    const [setup, duplicate] = await Promise.all([
      changePosAccess({ operation: 'setup', password, confirmation: password }, undefined, start),
      changePosAccess({ operation: 'setup', password, confirmation: password }, undefined, start),
    ])
    assert.ok(setup.response.ok)
    assert.ok(setup.sessionToken)
    assert.ok(setup.response.recoveryCode)
    const recoveryCode = setup.response.recoveryCode
    const first = setup.sessionToken
    assert.deepEqual(duplicate.response, { ok: false, error: 'alreadyConfigured' })
    assert.equal((await getPosAccessStatus(undefined, start)).unlocked, false)
    assert.equal((await getPosAccessStatus(first, start)).unlocked, true)

    const payload = await getPayload({ config })
    const stored = await payload.findByID({ collection: 'pos-security', id: 'quickpos' })
    assert.notEqual(stored.passwordHash, password)
    assert.notEqual(stored.recoveryHash, recoveryCode)
    await assert.rejects(payload.find({ collection: 'pos-security', overrideAccess: false }), { status: 403 })
    await assert.rejects(payload.create({
      collection: 'users',
      data: { email: 'local-smoke@example.test', password },
    }), { status: 403 })

    const second = await changePosAccess({ operation: 'unlock', password }, undefined, start)
    assert.ok(second.sessionToken)
    assert.equal((await getPosAccessStatus(first, start + 4 * minute)).expiresAt, start + 5 * minute)
    const activity = await changePosAccess({ operation: 'activity' }, first, start + 4 * minute)
    assert.ok(activity.response.ok)
    assert.equal(activity.response.status.expiresAt, start + 9 * minute)
    assert.equal((await getPosAccessStatus(second.sessionToken, start + 5 * minute)).unlocked, false)
    assert.deepEqual(
      (await changePosAccess({ operation: 'activity' }, second.sessionToken, start + 5 * minute)).response,
      { ok: false, error: 'locked' },
    )

    const timeout = await changePosAccess({ operation: 'timeout', minutes: 10 }, first, start + 5 * minute)
    assert.ok(timeout.response.ok)
    assert.equal(timeout.response.status.expiresAt, start + 15 * minute)
    assert.equal((await getPosAccessStatus(second.sessionToken, start + 5 * minute)).unlocked, false)
    const stillUnlocked = await changePosAccess({ operation: 'unlock', password }, undefined, start + 6 * minute)
    assert.ok(stillUnlocked.sessionToken)
    await changePosAccess({ operation: 'timeout', minutes: 1 }, first, start + 6 * minute)
    await changePosAccess({ operation: 'timeout', minutes: 10 }, first, start + 6 * minute + 1)
    assert.equal((await getPosAccessStatus(stillUnlocked.sessionToken, start + 7 * minute)).unlocked, false)
    const changed = await changePosAccess({
      operation: 'change', currentPassword: password, password: replacement, confirmation: replacement,
    }, first, start + 6 * minute + 2)
    assert.ok(changed.sessionToken)
    assert.equal((await getPosAccessStatus(first, start + 6 * minute)).unlocked, false)
    assert.equal((await getPosAccessStatus(stillUnlocked.sessionToken, start + 6 * minute)).unlocked, false)
    assert.equal((await getPosAccessStatus(changed.sessionToken, start + 6 * minute)).unlocked, true)

    const attemptTime = start + 7 * minute
    for (let i = 0; i < 5; i++) {
      const denied = await changePosAccess({ operation: 'unlock', password }, undefined, attemptTime)
      assert.deepEqual(denied.response, { ok: false, error: 'invalidPassword' })
    }
    assert.deepEqual(
      (await changePosAccess({ operation: 'unlock', password: replacement }, undefined, attemptTime)).response,
      { ok: false, error: 'tryAgainLater' },
    )
    const afterCooldown = await changePosAccess(
      { operation: 'unlock', password: replacement }, undefined, attemptTime + minute,
    )
    assert.ok(afterCooldown.response.ok)

    const reset = {
      operation: 'recover',
      code: recoveryCode,
      password: recoveredPassword,
      confirmation: recoveredPassword,
    } as const
    const recovered = await changePosAccess(reset, undefined, start + 9 * minute)
    assert.ok(recovered.response.ok)
    assert.ok(recovered.response.recoveryCode)
    assert.notEqual(recovered.response.recoveryCode, recoveryCode)
    assert.deepEqual(
      (await changePosAccess(reset, undefined, start + 9 * minute)).response,
      { ok: false, error: 'invalidRecovery' },
    )
    assert.equal((await getPosAccessStatus(changed.sessionToken, start + 9 * minute)).unlocked, false)
    assert.ok(recovered.sessionToken)
    const locked = await changePosAccess({ operation: 'lock' }, recovered.sessionToken, start + 9 * minute)
    assert.equal(locked.sessionToken, null)
    assert.equal((await getPosAccessStatus(recovered.sessionToken, start + 9 * minute)).unlocked, false)
  })
})
