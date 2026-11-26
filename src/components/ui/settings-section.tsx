'use client'

import { Collapsible } from '@base-ui/react/collapsible'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

export function SettingsSection({ children, defaultOpen, title }: {
  children: ReactNode
  defaultOpen?: boolean
  title: string
}) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className="rounded-lg border bg-background">
      <h2>
        <Collapsible.Trigger
          render={<Button type="button" variant="ghost" />}
          className="group/section h-auto w-full justify-between rounded-lg px-4 py-3 font-semibold sm:px-5"
        >
          {title}
          <ChevronDown className="transition-transform group-data-panel-open/section:rotate-180" aria-hidden="true" />
        </Collapsible.Trigger>
      </h2>
      <Collapsible.Panel keepMounted className="space-y-3 px-4 pt-2 pb-4 sm:px-5 sm:pb-5">
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
