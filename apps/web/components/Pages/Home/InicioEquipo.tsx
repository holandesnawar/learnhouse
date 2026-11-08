'use client'
/**
 * El Inicio del equipo (rediseño, rama diseno, 08/11/2026): los profes y los
 * administradores no ven el Inicio del alumno (su formación, sus tareas),
 * sino lo suyo: atajos a lo de cada día y el tablero de las clases.
 */
import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getUriWithOrg } from '@services/config/config'
import ClasesProfes from '@components/Pages/Profes/ClasesProfes'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

export default function InicioEquipo({ orgslug }: { orgslug: string }) {
  const session = useLHSession() as any
  const { isAdmin } = useAdminStatus() as any
  const u = session?.data?.user || {}
  const nombre = u.first_name || u.username || ''
  const hora = new Date().getHours()
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'
  const ruta = (p: string) => getUriWithOrg(orgslug, p)
  const atajos = [
    ...(isAdmin ? [{ t: 'Organizar clases', d: 'Grupos, quién da cada clase y alumnos', href: ruta('/organizar') }] : []),
    { t: 'Preparar clases', d: 'Presentaciones, tareas y grabaciones', href: ruta('/mis-clases') },
    { t: 'Seguimiento y tareas', d: 'Quién hizo qué y lo que queda por corregir', href: ruta('/seguimiento') },
    { t: 'Responder consultas', d: 'Las dudas de los alumnos', href: ruta('/responder-consultas') },
    ...(isAdmin ? [{ t: 'Panel de la escuela', d: 'Ventas, números y ajustes', href: '/dash' }] : []),
  ]
  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="text-[26px] sm:text-[30px] font-bold text-[#0B1033] tracking-tight" style={POPPINS}>
        {saludo}
        {nombre ? `, ${nombre}` : ''}
      </h1>
      <p className="mt-1 text-[14.5px] text-[#5B6382]">Lo que tienes entre manos en la escuela esta semana.</p>
      <div className={`mt-6 grid gap-3 sm:grid-cols-2 ${atajos.length > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {atajos.map((a) => (
          <Link key={a.t} href={a.href} className="group rounded-2xl border border-[#E4E8F2] bg-white px-4 py-3.5 hover:border-[#C9D4EC]">
            <p className="flex items-center justify-between text-[15px] font-semibold text-[#0B1033]">
              {a.t} <ArrowRight size={15} className="text-[#0b2da0] opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <p className="mt-0.5 text-[13px] text-[#6B7393]">{a.d}</p>
          </Link>
        ))}
      </div>
      <div className="mt-8">
        <ClasesProfes />
      </div>
    </div>
  )
}
