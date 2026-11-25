'use client'

import { Eye, EyeOff } from 'lucide-react'
import { createContext, useContext, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

const SalesPrivacyContext = createContext({
  amountsHidden: false,
  hiddenValueLabel: '',
  toggleAmounts: () => {},
})

export function SalesPrivacyProvider({
  children,
  className,
  cookieName,
  hiddenValueLabel,
  initiallyHidden,
}: {
  children: ReactNode
  className: string
  cookieName: string
  hiddenValueLabel: string
  initiallyHidden: boolean
}) {
  const [amountsHidden, setAmountsHidden] = useState(initiallyHidden)

  function toggleAmounts() {
    const next = !amountsHidden
    setAmountsHidden(next)
    document.cookie = `${cookieName}=${next ? '1' : '0'}; Path=/; Max-Age=31536000; SameSite=Lax`
  }

  return (
    <SalesPrivacyContext.Provider value={{ amountsHidden, hiddenValueLabel, toggleAmounts }}>
      <div className={className}>{children}</div>
    </SalesPrivacyContext.Provider>
  )
}

export function SalesOverviewValue({ children }: { children: string }) {
  const { amountsHidden, hiddenValueLabel } = useContext(SalesPrivacyContext)

  return amountsHidden ? (
    <>
      <span aria-hidden="true">******</span>
      <span className="sr-only">{hiddenValueLabel}</span>
    </>
  ) : children
}

export function SalesOverviewSection({
  children,
  heading,
  hideLabel,
  showLabel,
}: {
  children: ReactNode
  heading: string
  hideLabel: string
  showLabel: string
}) {
  const { amountsHidden, toggleAmounts } = useContext(SalesPrivacyContext)

  return (
    <section aria-labelledby="sales-dashboard-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sales-dashboard-heading" className="text-sm font-medium">
          {heading}
        </h2>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-controls="sales-dashboard-content"
          onClick={toggleAmounts}
        >
          {amountsHidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          {amountsHidden ? showLabel : hideLabel}
        </Button>
      </div>
      <div id="sales-dashboard-content" className="space-y-3">
        {children}
      </div>
    </section>
  )
}
