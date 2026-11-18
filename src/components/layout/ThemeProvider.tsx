'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'

type Theme = 'dark' | 'light' | 'system'

type ThemeContextValue = {
  resolvedTheme: 'dark' | 'light'
  setTheme: (theme: string) => void
  theme: Theme
}

const THEME_CHANGE_EVENT = 'quickpos-theme-change'
const ThemeContext = createContext<ThemeContextValue | null>(null)

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system'
}

function subscribeToSystemTheme(callback: () => void) {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function systemThemeSnapshot() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  disableTransitionOnChange = false,
  storageKey = 'theme',
}: {
  children: ReactNode
  defaultTheme?: Theme
  disableTransitionOnChange?: boolean
  storageKey?: string
}) {
  const subscribeToStoredTheme = useCallback((callback: () => void) => {
    window.addEventListener('storage', callback)
    window.addEventListener(THEME_CHANGE_EVENT, callback)
    return () => {
      window.removeEventListener('storage', callback)
      window.removeEventListener(THEME_CHANGE_EVENT, callback)
    }
  }, [])
  const storedThemeSnapshot = useCallback((): Theme => {
    const stored = window.localStorage.getItem(storageKey)
    return isTheme(stored) ? stored : defaultTheme
  }, [defaultTheme, storageKey])
  const theme = useSyncExternalStore(
    subscribeToStoredTheme,
    storedThemeSnapshot,
    () => defaultTheme,
  )
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    systemThemeSnapshot,
    () => false,
  )
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  const setTheme = useCallback(
    (nextTheme: string) => {
      if (!isTheme(nextTheme)) return
      window.localStorage.setItem(storageKey, nextTheme)
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
    },
    [storageKey],
  )

  useLayoutEffect(() => {
    let transitionStyle: HTMLStyleElement | undefined
    if (disableTransitionOnChange) {
      transitionStyle = document.createElement('style')
      transitionStyle.textContent =
        '*,*::before,*::after{transition:none!important;animation-duration:0s!important}'
      document.head.appendChild(transitionStyle)
    }

    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
    root.style.colorScheme = resolvedTheme

    if (transitionStyle) {
      window.getComputedStyle(document.body)
      transitionStyle.remove()
    }
  }, [disableTransitionOnChange, resolvedTheme])

  const value = useMemo<ThemeContextValue>(
    () => ({ resolvedTheme, setTheme, theme }),
    [resolvedTheme, setTheme, theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.')
  return context
}
