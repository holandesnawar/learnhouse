'use client'
/**
 * El perfil arriba a la derecha, como en Circle (rediseño, rama diseno,
 * 08/11/2026): la foto de la persona y, al tocarla, su nombre, su papel en la
 * escuela y lo de su cuenta (perfil, ajustes, contraseña, cerrar sesión).
 * Sustituye a la caja del perfil que iba abajo en la barra.
 */
import React from 'react'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import UserAvatar from '@components/Objects/UserAvatar'
import { signOut } from '@components/Contexts/AuthContext'
import { nombreVerComo, volverDeVerComo } from '@components/Objects/VerComo/VerComo'
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
        {/* Mirando como un alumno (08/11): «salir» es volver a tu cuenta. */}
        <DropdownMenuItem
          onClick={() => (nombreVerComo() ? volverDeVerComo() : signOut({ callbackUrl: '/login' }))}
          className={`${item} text-[#B42323] focus:text-[#B42323]`}
        >
          <SignOut size={18} /> {typeof document !== 'undefined' && nombreVerComo() ? 'Volver a mi cuenta' : 'Cerrar sesión'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
