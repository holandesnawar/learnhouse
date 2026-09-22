'use client'

/**
 * El panel en el móvil: una barra abajo con lo esencial y un cajón con todo
 * lo demás, los mismos grupos que la barra de escritorio (ver NawarSidebar).
 */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { signOut } from '@components/Contexts/AuthContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import { ArrowSquareOut, List, SignOut, X } from '@phosphor-icons/react'
import { GRUPOS_DEL_PANEL, activo } from './NawarSidebar'

export default function NawarMobileMenu() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const { isCloser } = useAdminStatus()

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    setSearch(typeof window !== 'undefined' ? window.location.search : '')
    setOpen(false)
  }, [pathname])

  if (!org || !session || !mounted) return null

  const grupos = isCloser
    ? [{ titulo: 'Ventas', items: GRUPOS_DEL_PANEL[0].items.filter((i) => i.label !== 'Facturas') }]
    : GRUPOS_DEL_PANEL
  // Los tres de la barra: lo que más se abre.
  const rapidos = grupos.flatMap((g) => g.items).slice(0, 3)

  const salir = async () => {
    await signOut({ redirect: true, callbackUrl: getUriWithOrg(org?.slug, '/login') })
  }

  return createPortal(
    <>
      <nav
        aria-label="Panel"
        className="fixed inset-x-0 mx-auto w-fit z-[9999]"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <div className="flex items-center gap-0.5 px-1.5 py-1.5 bg-white/95 backdrop-blur-xl rounded-full border border-[#E6EBF5]" style={{ boxShadow: '0 6px 24px rgba(29,0,132,0.12)' }}>
          {rapidos.map((it) => {
            const on = activo(it, pathname, search)
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-label={it.label}
                className={cn('flex items-center justify-center w-10 h-10 rounded-full transition-colors', on ? 'bg-[#EEF3FF] text-[#025dc7]' : 'text-gray-500')}
              >
                {it.icon}
              </Link>
            )
          })}
          <button onClick={() => setOpen((v) => !v)} aria-label="Menú" className={cn('flex items-center justify-center w-10 h-10 rounded-full', open ? 'bg-[#1D0084] text-white' : 'text-gray-700')}>
            {open ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
          </button>
        </div>
      </nav>

      {open && (
        <>
          <div className="fixed inset-0 z-[9997] bg-[#1D0084]/30" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 z-[9998] rounded-2xl bg-white border border-[#E6EBF5] shadow-2xl p-3 max-h-[70vh] overflow-y-auto" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)' }}>
            {grupos.map((g) => (
              <div key={g.titulo} className="mb-3">
                <p className="px-2 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-gray-400">{g.titulo}</p>
                {g.items.map((it) => {
                  const on = activo(it, pathname, search)
                  return (
                    <Link key={it.href} href={it.href} className={cn('flex items-center gap-2.5 px-2 py-2 rounded-lg text-[14px]', on ? 'bg-[#EEF3FF] text-[#1D0084] font-semibold' : 'text-gray-700')}>
                      <span className={on ? 'text-[#025dc7]' : 'text-gray-400'}>{it.icon}</span>
                      {it.label}
                    </Link>
                  )
                })}
              </div>
            ))}
            <div className="border-t border-[#E6EBF5] pt-2 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 px-2 py-2 text-[13.5px] text-gray-700">
                <ArrowSquareOut size={17} className="text-gray-400" /> Ver la escuela
              </Link>
              <button onClick={salir} className="flex items-center gap-2 px-2 py-2 text-[13.5px] text-red-600">
                <SignOut size={17} /> Salir
              </button>
            </div>
          </div>
        </>
      )}
    </>,
    document.body
  )
}
