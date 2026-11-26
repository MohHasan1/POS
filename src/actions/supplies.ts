'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import type { MarketProfile } from '@/lib/market'
import { requirePosAccess } from '@/lib/require-pos-access'
import type { SupplySettingsInput, SupplyUsageDetails } from '@/lib/supplies'
import { getMarketContext } from '@/services/settings'
import {
  saveSupply,
  setSupplyArchived,
  startSupplyUsage,
  SupplyError,
  updateSupplyUsage,
} from '@/services/supplies'

export type SupplyActionResult =
  | { ok: true }
  | { ok: false; error: SupplyError['code'] | 'unavailable' | 'setupRequired' }

async function changeSupply(
  supplyId: string | undefined,
  change: (profile: MarketProfile) => Promise<unknown>,
): Promise<SupplyActionResult> {
  const path = supplyId && z.uuid().safeParse(supplyId).success ? `/supplies/${supplyId}` : '/supplies'
  await requirePosAccess(path)
  try {
    const market = await getMarketContext()
    if (!market.configured) return { ok: false, error: 'setupRequired' }
    await change(market.profile)
    revalidatePath('/supplies')
    if (path !== '/supplies') revalidatePath(path)
    return { ok: true }
  } catch (error) {
    if (error instanceof SupplyError) return { ok: false, error: error.code }
    console.error('Unable to update supplies.', error)
    return { ok: false, error: 'unavailable' }
  }
}

export async function saveSupplyAction(input: SupplySettingsInput, supplyId?: string) {
  return changeSupply(supplyId, () => saveSupply(input, supplyId))
}

export async function archiveSupplyAction(supplyId: string, archived: boolean) {
  return changeSupply(supplyId, () => {
    if (typeof archived !== 'boolean') throw new SupplyError('invalidSettings')
    return setSupplyArchived(supplyId, archived)
  })
}

export async function startSupplyUsageAction(
  supplyId: string,
  id: string,
  input: SupplyUsageDetails,
) {
  return changeSupply(supplyId, (profile) => startSupplyUsage(supplyId, id, input, profile))
}

export async function finishSupplyUsageAction(supplyId: string, id: string, finishedOn: string) {
  return changeSupply(supplyId, (profile) =>
    updateSupplyUsage(supplyId, id, { operation: 'finish', finishedOn }, profile),
  )
}

export async function correctSupplyUsageAction(
  supplyId: string,
  id: string,
  input: SupplyUsageDetails & { finishedOn: string | null },
) {
  return changeSupply(supplyId, (profile) =>
    updateSupplyUsage(supplyId, id, { ...input, operation: 'correct' }, profile),
  )
}
