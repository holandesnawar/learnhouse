'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getStudentProgress, patchStudentProgress } from '@services/student/progress'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (next: Theme) => void
  resolved: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'lh_theme'

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyClass(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (resolved === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token

  const [theme, setThemeState] = useState<Theme>('system')
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')

  // First paint: pick from localStorage so we don't flicker while waiting for
  // the backend. Then hydrate from the student profile when the token lands.
  useEffect(() => {
    const initial = readInitialTheme()
    setThemeState(initial)
  }, [])

  // Hydrate from backend once the user is authenticated. We treat the
  // backend as the source of truth across devices; if it differs from
  // localStorage, the server value wins.
  useEffect(() => {
    if (!accessToken) return
    let active = true
    getStudentProgress(accessToken).then((p) => {
      if (!active) return
      const remote = p?.theme as Theme | undefined
      if (remote && (remote === 'light' || remote === 'dark' || remote === 'system')) {
        setThemeState(remote)
        try { window.localStorage.setItem(STORAGE_KEY, remote) } catch {}
      }
    }).catch(() => { /* silent — keep local */ })
    return () => { active = false }
  }, [accessToken])

  // Resolve "system" against the OS preference + react to live changes.
  useEffect(() => {
    const compute = () => {
      const r: 'light' | 'dark' =
        theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme
      setResolved(r)
      applyClass(r)
    }
    compute()
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => compute()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch {}
    if (accessToken) {
      // Fire-and-forget; if the network drops, localStorage still has it.
      patchStudentProgress({ theme: next }, accessToken).catch(() => {})
    }
  }, [accessToken])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return { theme: 'system', setTheme: () => {}, resolved: 'light' }
  }
  return ctx
}
