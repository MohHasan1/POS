'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function PrintButton({ label }: { label: string }) {
  async function print() {
    await document.fonts.ready
    window.print()
  }

  return <Button onClick={print}><Printer aria-hidden="true" />{label}</Button>
}
