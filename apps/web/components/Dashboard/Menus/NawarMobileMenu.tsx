'use client'

/**
 * El panel en el móvil: una barra abajo con lo esencial y un cajón con todo
 * lo demás, los mismos grupos que la barra de escritorio (ver NawarSidebar).
 * Desde el 04/11/2026 el cajón lleva el mismo fondo azul de la escuela y el
 * buscador.
 */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { signOut } from '@components/Contexts/AuthContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import useCloserVeNumeros from '@components/Hooks/useCloserVeNumeros'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import { ACTIVO_SOBRE_MARCA, FONDO_MARCA } from '@/lib/nawar/marca'
import { ArrowSquareOut, List, MagnifyingGlass, SignOut, X } from '@phosphor-icons/react'
import { GRUPOS_DEL_PANEL, activo, buscarEnPanel, gruposDelCloser, type Item } from './NawarSidebar'

export default function NawarMobileMenu() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const [buscar, setBuscar] = useState('')
  const { isCloser } = useAdminStatus()
  const closerVeNumeros = useCloserVeNumeros(isCloser)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    setSearch(typeof window !== 'undefined' ? window.location.search : '')
    setOpen(false)
    setBuscar('')
  }, [pathname])

  if (!org || !session || !mounted) return null

  const grupos = isCloser ? gruposDelCloser(closerVeNumeros) : GRUPOS_DEL_PANEL
  // Los tres de la barra: lo que más se abre (Inicio, Matrículas, Llamadas).
  const rapidos = grupos.flatMap((g) => g.items).slice(0, 3)
  const encontrados = buscarEnPanel(grupos, buscar)

  const salir = async () => {
    await signOut({ redirect: true, callbackUrl: getUriWithOrg(org?.slug, '/login') })
  }

  const fila = (it: Item) => {
    const on = activo(it, pathname, search)
    return (
      <Link
        key={it.href + it.label}
        href={it.href}
        onClick={() => setOpen(false)}
        className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[14px]', on ? 'text-white font-semibold' : 'text-white/85')}
        style={on ? { backgroundColor: ACTIVO_SOBRE_MARCA } : undefined}
      >
        <span className={on ? 'text-[#9CCBFF]' : 'text-white/55'}>{it.icon}</span>
        {it.label}
      </Link>
    )
  }

  return createPortal(
    <>
      <nav
        aria-label="Panel"
        className="fixed inset-x-0 mx-auto w-fit z-[9999]"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <div className="flex items-center gap-0.5 px-1.5 py-1.5 bg-white/95 backdrop-blur-xl rounded-full border border-[#E1E8F5]" style={{ boxShadow: '0 6px 24px rgba(29,0,132,0.14)' }}>
          {rapidos.map((it) => {
            const on = activo(it, pathname, search)
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-label={it.label}
                className={cn('flex items-center justify-center w-10 h-10 rounded-full transition-colors', on ? 'bg-[#1D0084] text-white' : 'text-[#5A6480]')}
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
          <div className="fixed inset-0 z-[9997] bg-[#0a1656]/40" onClick={() => setOpen(false)} />
          <div
            className="fixed inset-x-3 z-[9998] rounded-2xl text-white shadow-2xl p-3 max-h-[72vh] overflow-y-auto"
            style={{ ...FONDO_MARCA, bottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)' }}
          >
            <label className="flex items-center gap-2 h-10 px-3 mb-3 rounded-lg bg-white/10 border border-white/10">
              <MagnifyingGlass size={16} className="text-white/60 shrink-0" />
              <input
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar en el panel"
                className="flex-1 min-w-0 bg-transparent text-[14px] text-white placeholder:text-white/50 outline-none"
              />
            </label>
            {buscar.trim() ? (
              encontrados.length ? (
                <div className="mb-3">{encontrados.map(fila)}</div>
              ) : (
                <p className="px-2 pb-3 text-[13px] text-white/60">Nada con «{buscar.trim()}».</p>
              )
            ) : (
              grupos.map((g) => (
                <div key={g.titulo || 'inicio'} className="mb-3">
                  {g.titulo ? (
                    <p className="px-2.5 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">{g.titulo}</p>
                  ) : null}
                  {g.items.map(fila)}
                </div>
              ))
            )}
            <div className="border-t border-white/10 pt-2 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 px-2 py-2 text-[13.5px] text-white/85">
                <ArrowSquareOut size={17} className="text-white/55" /> Ver la escuela
              </Link>
              <button onClick={salir} className="flex items-center gap-2 px-2 py-2 text-[13.5px] text-white/85">
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
