import type { CollectionConfig } from 'payload'

const deny = () => false
const internal = { create: deny, read: deny, update: deny, delete: deny }

export const PosSecurity: CollectionConfig = {
  slug: 'pos-security',
  access: internal,
  admin: { hidden: true },
  fields: [
    { name: 'id', type: 'text', required: true },
    { name: 'passwordHash', type: 'text', required: true },
    { name: 'recoveryHash', type: 'text', required: true },
    { name: 'generation', type: 'text', required: true },
    { name: 'timeoutMinutes', type: 'number', required: true, defaultValue: 5 },
    { name: 'failedUnlocks', type: 'number', required: true, defaultValue: 0 },
    { name: 'unlockBlockedUntil', type: 'date' },
    { name: 'failedRecoveries', type: 'number', required: true, defaultValue: 0 },
    { name: 'recoveryBlockedUntil', type: 'date' },
  ],
}

export const PosSessions: CollectionConfig = {
  slug: 'pos-sessions',
  access: internal,
  admin: { hidden: true },
  fields: [
    { name: 'id', type: 'text', required: true },
    { name: 'generation', type: 'text', required: true },
    { name: 'lastActivityAt', type: 'date', required: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
  ],
}
