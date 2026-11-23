'use client'

/**
 * Las piezas de un alumno que comparten Progreso (la fila abierta y la ficha
 * de siempre) y la ficha nueva del alumno (`FichaAlumno.tsx`, 22/11/2026):
 * fechas legibles, el nombre de un módulo, los módulos por avance con «Abrir
 * ya», el enlace para crear la contraseña y cambiar el correo de acceso.
 * Estaban dentro de `ProgresoPanel.tsx`; se sacaron tal cual, sin cambiar lo
 * que hacen.
 */

import React, { useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  abrirModulo,
  cambiarCorreoAlumno,
  darEnlaceContrasena,
  quitarAperturaModulo,
  type AlumnoProgreso,
  type AperturaModulo,
} from '@services/panel/panel'
import { Copy, KeyRound, Loader2, Lock, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@lib/nawar/confirmar'
import { BOTON, BOTON_PRINCIPAL, TARJETA } from './ui'

export const ZONA = 'Europe/Amsterdam'


/** Día del calendario en Países Bajos ("2026-10-04"), para comparar días. */
export function diaNL(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: ZONA })
}

/**
 * "Hoy, 18:05", "Ayer", "jue 2 oct", "12 sep". Con hora solo si el dato la
 * trae: la visita diaria se guarda por día, sin hora.
 */
export function cuando(iso: string): string {
  if (!iso) return 'Nunca'
  const conHora = iso.length > 10
  const d = new Date(conHora ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const dia = conHora ? diaNL(d) : iso
  const hoy = diaNL(new Date())
  const ayer = diaNL(new Date(Date.now() - 86400000))
  const hora = conHora ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: ZONA }) : ''
  if (dia === hoy) return hora ? `Hoy, ${hora}` : 'Hoy'
  if (dia === ayer) return hora ? `Ayer, ${hora}` : 'Ayer'
  const dias = Math.round((new Date(`${hoy}T12:00:00`).getTime() - new Date(`${dia}T12:00:00`).getTime()) / 86400000)
  const fecha = new Date(`${dia}T12:00:00`).toLocaleDateString('es-ES', dias < 7 ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' })
  return dias < 7 ? fecha : `${fecha} · hace ${dias} días`
}

/** "MODULE 2 - FAMILIE" → "Módulo 2 · Familie". Lo demás, tal cual. */
export function modulo(nombre: string): string {
  const m = /^\s*(?:module|módulo|modulo)\s+(\d+)\s*[-–:·]\s*(.+)$/i.exec(nombre || '')
  if (!m) return nombre
  // Solo la primera letra en mayúscula, como se escribe en neerlandés: "Eten en drinken".
  const minus = m[2].trim().toLowerCase()
  const resto = minus.charAt(0).toUpperCase() + minus.slice(1)
  return `Módulo ${m[1]} · ${resto}`
}

export function Iniciales({ nombre }: { nombre: string }) {
  const ini = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span className="w-9 h-9 shrink-0 rounded-full bg-[#F3F4F6] text-[12.5px] font-semibold text-gray-700 flex items-center justify-center">
      {ini || '·'}
    </span>
  )
}

export function Barra({ pct, llena }: { pct: number; llena?: boolean }) {
  return (
    <span className="block h-1.5 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
      <span
        className={`block h-full rounded-full ${llena ? 'bg-[#16A34A]' : 'bg-gray-900'}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </span>
  )
}

export function Cifra({ label, valor, nota, activo, onClick }: { label: string; valor: number; nota: string; activo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`${TARJETA} text-left p-3.5 sm:p-4 transition-colors ${activo ? 'border-gray-900 ring-1 ring-gray-900' : 'hover:bg-[#F9FAFB]'}`}
    >
      <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.08em]">{label}</p>
      <p className="text-[24px] sm:text-[26px] font-semibold tabular-nums text-gray-900 leading-tight mt-1">{valor}</p>
      <p className="hidden sm:block text-[12px] text-[#9CA3AF] mt-0.5">{nota}</p>
    </button>
  )
}

export function haceDias(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = Math.floor((Date.now() - t) / 86400000)
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`
}

/** "24 oct" (y el año si no es este). */
export function diaCorto(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const mismoAno = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(mismoAno ? {} : { year: 'numeric' }), timeZone: ZONA })
}

/**
 * Los módulos de quien va por avance (todos los alumnos desde el 02/11/2026): cuáles
 * tiene abiertos, por qué no los demás, y «Abrir ya» para saltarse la regla.
 * La regla está en apps/api/src/services/courses/avance_modulos.py.
 */
export function ModulosPorAvance({
  a,
  onAbrir,
  onDeshacer,
}: {
  a: AlumnoProgreso
  /** Sin ellos (la ficha en modo closer) no salen «Abrir ya» ni «Deshacer»: abrir módulos a mano es solo de administradores. */
  onAbrir?: (m: AperturaModulo) => void
  onDeshacer?: (m: AperturaModulo) => void
}) {
  return (
    <ul className="space-y-3">
      {a.aperturas.map((m) => {
        const pct = m.total ? Math.round((m.hechas * 100) / m.total) : 0
        let estado = ''
        if (m.abierto) {
          if (m.como === 'mano') estado = `Abierto a mano el ${diaCorto(m.abre)}`
          else if (m.como === 'avance') estado = `Abierto el ${diaCorto(m.abre)}`
          // Lo tenía abierto por fecha y ya había hecho alguna clase (02/11): no se le cierra.
          else if (m.como === 'empezado') estado = `Abierto: ya lo había empezado (${diaCorto(m.abre)})`
        } else if (m.motivo) {
          estado = m.fecha_minima ? `${m.motivo} No antes del ${diaCorto(m.fecha_minima)}.` : m.motivo
        } else if (m.abre) {
          estado = `Ya ha terminado lo anterior: se abre el ${diaCorto(m.abre)}.`
        }
        return (
          <li key={m.uuid} className="text-[12.5px]">
            <div className="grid grid-cols-[minmax(0,1fr)_96px_44px] items-center gap-3">
              <span className={`truncate flex items-center gap-1.5 ${m.abierto ? 'text-gray-800' : 'text-[#9CA3AF]'}`}>
                {m.abierto ? null : <Lock size={12} className="shrink-0" />}
                {modulo(m.nombre)}
              </span>
              <Barra pct={pct} llena={m.total > 0 && m.hechas === m.total} />
              <span className="text-right tabular-nums text-[#6B7280]">
                {m.hechas}/{m.total}
              </span>
            </div>
            {estado || (!m.abierto && onAbrir) || (m.como === 'mano' && onDeshacer) ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[18px]">
                {estado ? <span className="text-[#6B7280]">{estado}</span> : null}
                {!m.abierto && onAbrir ? (
                  <button onClick={() => onAbrir(m)} className="font-medium text-[#025dc7] hover:underline">
                    Abrir ya
                  </button>
                ) : m.abierto && m.como === 'mano' && onDeshacer ? (
                  <button onClick={() => onDeshacer(m)} className="font-medium text-[#6B7280] hover:text-gray-900 hover:underline">
                    Deshacer
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Lo de dentro de un alumno: estado, constancia, recordatorio y módulos.
 * Lo usan la fila abierta de Progreso y la ficha del alumno de Usuarios. */
export function fechaCorta(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * «Mandarle el enlace para crear su contraseña» (17/11/2026, usuario: "entró
 * una nueva pero le caducó el link… algo manual así no le pido a este alumno").
 * Un enlace nuevo de 7 días: vale para quien no la puso nunca y para quien la
 * ha olvidado. Por correo o copiándolo para mandarlo por WhatsApp.
 */
export function EnlaceContrasena({ a }: { a: AlumnoProgreso }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState<'' | 'correo' | 'copiar'>('')
  const [enlace, setEnlace] = useState('')
  const pedirlo = async (enviar: boolean) => {
    if (!org?.id || !token) return
    setOcupado(enviar ? 'correo' : 'copiar')
    const r = await darEnlaceContrasena(org.id, a.user_id, enviar, token)
    setOcupado('')
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido crear el enlace')
    const d = r.datos
    if (!d.enlace) return toast.error(d.motivo || 'No se ha podido crear el enlace')
    setEnlace(d.enlace)
    if (enviar) {
      if (d.correo_enviado) toast.success(`Correo mandado a ${a.email}`)
      else toast.error(`El correo no salió: ${d.motivo || 'motivo desconocido'}. Copia el enlace y mándaselo por WhatsApp.`)
    } else {
      try {
        await navigator.clipboard.writeText(d.enlace)
        toast.success('Enlace copiado')
      } catch {
        toast.success('Enlace listo: cópialo de abajo')
      }
    }
  }
  const nombre = (a.nombre || '').split(' ')[0]
  const wa = (a.telefono || '').replace(/[^\d]/g, '')
  const textoWa = `Hola ${nombre}, aquí tienes tu enlace para poner tu contraseña y entrar en la escuela (vale 7 días): ${enlace}`
  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#025dc7] hover:underline">
        <KeyRound size={13} /> No puede entrar: darle un enlace para crear su contraseña
      </button>
    )
  }
  return (
    <div className="rounded-lg border border-[#E2E8F4] bg-white p-3 space-y-2">
      <p className="text-[12.5px] text-[#374151] leading-snug">
        Un enlace nuevo para que ponga su contraseña y entre (vale 7 días). Sirve si no la puso nunca, si le caducó el del
        correo o si la ha olvidado.
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => pedirlo(true)} disabled={!!ocupado} className={BOTON_PRINCIPAL}>
          {ocupado === 'correo' ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Mandárselo por correo
        </button>
        <button onClick={() => pedirlo(false)} disabled={!!ocupado} className={BOTON}>
          {ocupado === 'copiar' ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />} Solo copiar el enlace
        </button>
      </div>
      {enlace ? (
        <div className="space-y-1.5">
          <input readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} className="w-full h-8 rounded-md border border-[#E2E8F4] bg-[#F9FAFB] px-2 text-[12px] text-[#374151]" />
          {wa ? (
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(textoWa)}`} target="_blank" rel="noreferrer" className="inline-flex text-[12.5px] font-medium text-[#025dc7] hover:underline">
              Mandárselo por WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Cambiar el correo con el que entra (18/11/2026, usuario: "hay que cambiarle
 * el mail de acceso, pero ya creó cuenta… solo admin"). Su contraseña y su
 * progreso siguen igual; el pago y su ficha de Contactos se quedan con el
 * correo de antes. Servidor: services/panel/enlace_contrasena.py.
 */
export function CambiarCorreo({ a }: { a: AlumnoProgreso }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [abierto, setAbierto] = useState(false)
  const [actual, setActual] = useState(a.email)
  const [nuevo, setNuevo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const guardar = async () => {
    if (!org?.id || !token || !nuevo.trim()) return
    const ok = await confirmar(
      `A partir de ahora ${a.nombre || 'esta persona'} entrará con ${nuevo.trim().toLowerCase()} y su misma contraseña. Los correos de la escuela le llegarán ahí.`,
      { boton: 'Cambiar el correo', peligro: false },
    )
    if (!ok) return
    setOcupado(true)
    const r = await cambiarCorreoAlumno(org.id, a.user_id, nuevo, token)
    setOcupado(false)
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido cambiar el correo')
    setActual(r.datos.email)
    setNuevo('')
    setAbierto(false)
    toast.success(`Ya entra con ${r.datos.email}. Si tenía la escuela abierta, tendrá que volver a entrar.`)
  }
  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="block text-[12.5px] font-medium text-[#025dc7] hover:underline">
        Cambiar el correo con el que entra{actual !== a.email ? ` (ahora ${actual})` : ''}
      </button>
    )
  }
  return (
    <div className="rounded-lg border border-[#E2E8F4] bg-white p-3 space-y-2">
      <p className="text-[12.5px] text-[#374151] leading-snug">
        Ahora entra con <strong>{actual}</strong>. Su contraseña, sus clases y su progreso no cambian. El pago y su ficha de Contactos se
        quedan con el correo de antes.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="Correo nuevo"
          className="flex-1 min-w-[200px] h-9 rounded-md border border-[#E2E8F4] px-2.5 text-[13px]"
        />
        <button onClick={guardar} disabled={ocupado || !nuevo.trim()} className={BOTON_PRINCIPAL}>
          {ocupado ? <Loader2 size={14} className="animate-spin" /> : null} Guardar
        </button>
        <button onClick={() => setAbierto(false)} className={BOTON}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** Abrirle ya un módulo (o deshacerlo), preguntando antes. true si se hizo. */
export async function abrirAMano(orgId: number, token: string, a: AlumnoProgreso, m: AperturaModulo): Promise<boolean> {
  const si = await confirmar(
    `¿Abrirle ya el ${modulo(m.nombre)} a ${a.nombre}? Se le abre ahora, sin esperar a que termine el anterior. El siguiente módulo cuenta su espera desde hoy.`,
    { boton: 'Abrir ya', peligro: false }
  )
  if (!si) return false
  const r = await abrirModulo(orgId, a.user_id, m.uuid, token)
  if (!r.ok) {
    toast.error(r.error || 'No se ha podido abrir')
    return false
  }
  toast.success('Abierto')
  return true
}

export async function deshacerAMano(orgId: number, token: string, a: AlumnoProgreso, m: AperturaModulo): Promise<boolean> {
  const si = await confirmar(`¿Volver a cerrarle el ${modulo(m.nombre)} a ${a.nombre}? Queda como diga su avance.`, {
    boton: 'Sí, deshacer',
    peligro: false,
  })
  if (!si) return false
  const r = await quitarAperturaModulo(orgId, a.user_id, m.uuid, token)
  if (!r.ok) {
    toast.error(r.error || 'No se ha podido deshacer')
    return false
  }
  toast.success('Hecho')
  return true
}

