'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

const themeStorageKey = 'counter-pos-theme'

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark)
}

function hasSavedTheme() {
  try {
    return localStorage.getItem(themeStorageKey) !== null
  } catch {
    return false
  }
}

export function ThemeToggle({ label }: { label: string }) {
  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')

    function followSystemTheme(event: MediaQueryListEvent) {
      if (!hasSavedTheme()) {
        applyTheme(event.matches)
      }
    }

    colorScheme.addEventListener('change', followSystemTheme)
    return () => colorScheme.removeEventListener('change', followSystemTheme)
  }, [])

  function toggleTheme() {
    const isDark = !document.documentElement.classList.contains('dark')
    applyTheme(isDark)

    try {
      localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light')
    } catch {}
  }

  return (
    <Button
      aria-label={label}
      onClick={toggleTheme}
      size="icon-sm"
      title={label}
      variant="outline"
    >
      <Moon aria-hidden="true" className="size-4 dark:hidden" />
      <Sun aria-hidden="true" className="hidden size-4 dark:block" />
    </Button>
  )
}
