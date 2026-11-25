import type { Metadata } from 'next'

import { PeoplePageClient } from '@/components/money/PeoplePageClient'
import { getDictionary } from '@/lib/localization'
import { getMoneyPeople } from '@/services/money'

export const metadata: Metadata = { title: 'People' }

export default async function PeoplePage() {
  const [{ dictionary }, people] = await Promise.all([getDictionary(), getMoneyPeople(true)])

  return (
    <div className="mx-auto max-w-6xl">
      <PeoplePageClient dictionary={dictionary} people={people} />
    </div>
  )
}
