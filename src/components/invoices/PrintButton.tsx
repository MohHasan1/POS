'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function PrintButton({ documentTitle, label }: { documentTitle?: string; label: string }) {
  async function print() {
    await document.fonts.ready
    await Promise.all(
      Array.from(document.images).map(
        (image) =>
          image.complete ||
          new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true })
            image.addEventListener('error', () => resolve(), { once: true })
          }),
      ),
    )

    const previousTitle = document.title
    if (documentTitle) document.title = documentTitle
    try {
      window.print()
    } finally {
      document.title = previousTitle
    }
  }

  return (
    <Button onClick={print}>
      <Printer aria-hidden="true" />
      {label}
    </Button>
  )
}
