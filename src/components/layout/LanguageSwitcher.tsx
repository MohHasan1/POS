'use client'

import { Languages } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { setLocaleAction } from '@/actions/locale'
import { Button } from '@/components/ui/button'

export function LanguageSwitcher({ label }: { label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function switchLanguage() {
    const locale = label === 'English' ? 'en' : 'bn'
    startTransition(async () => {
      await setLocaleAction(locale)
      router.refresh()
    })
  }

  return (
    <Button
      aria-label={`Switch language to ${label}`}
      disabled={pending}
      onClick={switchLanguage}
      size="sm"
      variant="outline"
    >
      <Languages aria-hidden="true" />
      {label}
    </Button>
  )
}
