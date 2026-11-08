'use client'
/**
 * El perfil arriba a la derecha, como en Circle (rediseño, rama diseno,
 * 08/11/2026): la foto de la persona y, al tocarla, su nombre, su papel en la
 * escuela y lo de su cuenta (perfil, ajustes, contraseña, cerrar sesión).
 * Sustituye a la caja del perfil que iba abajo en la barra.
 */
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import UserAvatar from '@components/Objects/UserAvatar'
import { signOut } from '@components/Contexts/AuthContext'
import { getUriWithOrg } from '@services/config/config'
import { UserCircle, GearSix, LockKey, ChatCircleDots, SquaresFour, SignOut, CaretDown } from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'

export function papelDe(s: { isAdmin?: boolean; isProfe?: boolean; isCloser?: boolean; isStaff?: boolean }): string {
  if (s.isAdmin) return 'Administrador'
  if (s.isProfe) return 'Profe'
  if (s.isCloser) return 'Equipo de admisiones'
  if (s.isStaff) return 'Equipo'
  return 'Alumno'
}

export default function MenuPerfil({ claro = false }: { claro?: boolean }) {
  const session = useLHSession() as any
  const org = useOrg() as any
  const estado = useAdminStatus() as any
  if (session?.status !== 'authenticated') return null
  const u = session?.data?.user || {}
  const nombre = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || ''
  const ruta = (p: string) => getUriWithOrg(org?.slug || '', p)
  const item = 'flex items-center gap-2.5 px-2.5 py-2 text-[14px] text-[#2B3150] cursor-pointer'
  // La barra lateral, azul o blanca: la elige cada uno (08/11/2026). Se guarda
  // en este navegador y la barra se entera al momento (evento «nawar-barra»).
  const [barra, setBarra] = useState<'azul' | 'blanca'>('azul')
  useEffect(() => {
    try {
      const v = localStorage.getItem('nawar.barra.estilo')
      if (v === 'azul' || v === 'blanca') setBarra(v)
    } catch {}
  }, [])
  const elegirBarra = (v: 'azul' | 'blanca') => {
    setBarra(v)
    try {
      localStorage.setItem('nawar.barra.estilo', v)
    } catch {}
    window.dispatchEvent(new CustomEvent('nawar-barra', { detail: v }))
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Tu perfil"
          className={`ml-1 flex items-center gap-1.5 rounded-full pl-0.5 pr-1.5 py-0.5 transition-colors `}
        >
          <UserAvatar border="border-2" rounded="rounded-full" width={32} />
          <CaretDown size={12} weight="bold" className={claro ? 'text-[#6B7393]' : 'text-white/80'} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-1.5 rounded-xl">
        <DropdownMenuLabel className="px-2.5 py-2">
          <div className="flex items-center gap-3">
            <UserAvatar border="border-2" rounded="rounded-full" width={40} />
            <div className="min-w-0">
              <p className="text-[14.5px] font-semibold text-[#0B1033] truncate">{nombre}</p>
              <p className="text-[12.5px] text-[#6B7393] truncate">{u.email}</p>
              <p className="mt-0.5 text-[11.5px] font-semibold text-[#0b2da0]">{papelDe(estado)}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={ruta('/account/profile')} className={item}>
            <UserCircle size={18} /> Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={ruta('/account/general')} className={item}>
            <GearSix size={18} /> Ajustes de la cuenta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={ruta('/account/security')} className={item}>
            <LockKey size={18} /> Contraseña y seguridad
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={ruta('/mis-consultas')} className={item}>
            <ChatCircleDots size={18} /> Mis consultas
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2.5 py-2">
          <p className="text-[12.5px] text-[#6B7393] mb-1.5">Barra lateral</p>
          <div className="grid grid-cols-2 rounded-lg border border-[#DDE3F0] overflow-hidden divide-x divide-[#DDE3F0]">
            {(['azul', 'blanca'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  elegirBarra(v)
                }}
                aria-pressed={barra === v}
                className={`h-8 text-[13px] font-semibold capitalize transition-colors ${
                  barra === v ? 'bg-[#0b2da0] text-white' : 'bg-white text-[#3B4262] hover:bg-[#F5F7FC]'
                }`}
              >
                {v === 'azul' ? 'Azul' : 'Blanca'}
              </button>
            ))}
          </div>
        </div>
        {estado?.isAdmin || estado?.isCloser ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={estado?.isAdmin ? '/dash' : '/dash/estadisticas?tab=matriculas'} className={item}>
                <SquaresFour size={18} /> {estado?.isAdmin ? 'Panel de la escuela' : 'Panel de ventas'}
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })} className={`${item} text-[#B42323] focus:text-[#B42323]`}>
          <SignOut size={18} /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
