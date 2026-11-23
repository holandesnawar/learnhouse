'use client'

/**
 * Correos y avisos → «Resumen semanal»: el correo de los lunes a cada alumno
 * con lo suyo de esa semana (sus clases en directo, por dónde va en la
 * formación y a qué clase le toca volver, su tarea y la lectura).
 *
 * **Apagado de serie.** Aquí se enciende, se ve cómo le queda a un alumno de
 * verdad (cada uno recibe el suyo: no hay un texto único), se manda una prueba
 * y se ve a quién le saldría el lunes y a quién no, con el motivo.
 *
 * Los textos fijos (asunto, saludo, cierre, botón) se cambian en «Correos
 * automáticos» → Resumen semanal, como los demás. Servidor:
 * apps/api/src/services/notifications/resumen_semanal.py.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  getResumenSemanal,
  guardarResumenSemanal,
  vistaResumenSemanal,
  type ResumenSemanalPanel,
} from '@services/panel/panel'
import { confirmar } from '@lib/nawar/confirmar'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronRight, Eye, Loader2, Send } from 'lucide-react'
import { BOTON, META, TARJETA } from '../Panel/ui'

const CAMPO =
  'bg-white rounded-md px-3 h-9 border border-[#E5E7EB] text-[13.5px] text-gray-900 outline-none focus:border-[#025dc7] transition-colors max-w-full'

function cuantos(n: number) {
  return n === 1 ? '1 alumno' : `${n} alumnos`
}

function diaLargo(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`)
  return Number.isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function ResumenSemanal() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token

  const [d, setD] = useState<ResumenSemanalPanel | null>(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState<'' | 'interruptor' | 'vista' | 'prueba'>('')
  const [verSi, setVerSi] = useState(false)
  const [verNo, setVerNo] = useState(false)
  // 0 = el alumno de ejemplo (inventado); si no, un alumno de verdad.
  const [quien, setQuien] = useState(0)
  const [vista, setVista] = useState<{ asunto: string; html: string; nota: string } | null>(null)

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    const r = await getResumenSemanal(org.id, token)
    if (!r.ok || !r.datos) return setError(r.error || 'No se ha podido cargar')
    setD(r.datos)
  }, [org?.id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  const alternar = async () => {
    if (!d) return
    const activar = !d.activo
    if (activar) {
      const ok = await confirmar(
        `¿Encender el resumen semanal? El ${diaLargo(d.proximo)} por la mañana le saldrá a ${cuantos(d.le_tocaria.length)}, y después cada lunes. Cada alumno puede darse de baja desde el propio correo.`,
        { boton: 'Encender' }
      )
      if (!ok) return
    }
    setOcupado('interruptor')
    const r = await guardarResumenSemanal(org.id, activar, token)
    setOcupado('')
    if (!r.ok) return toast.error(r.error || 'No se ha podido cambiar')
    toast.success(activar ? 'Resumen semanal encendido' : 'Resumen semanal apagado')
    cargar()
  }

  const ver = async (aMi: boolean) => {
    setOcupado(aMi ? 'prueba' : 'vista')
    const r = await vistaResumenSemanal(org.id, { user_id: quien || null, a_mi: aMi }, token)
    setOcupado('')
    if (!r.ok || !r.datos) return toast.error(r.error || 'No se ha podido preparar')
    if (aMi) return toast.success(`Prueba enviada a ${r.datos.para}`)
    setVista({
      asunto: r.datos.asunto,
      html: r.datos.html,
      nota: !quien ? 'con un alumno de ejemplo' : r.datos.motivo_texto ? `a este alumno no le saldría: ${r.datos.motivo_texto.toLowerCase()}` : 'tal cual le llegaría',
    })
  }

  if (error && !d) return <p className="text-[13.5px] text-red-700">{error}</p>
  if (!d)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )

  const todos = [...d.le_tocaria, ...d.no_les_toca].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return (
    <div className="max-w-3xl space-y-5">
      {/* El interruptor */}
      <div className={`${TARJETA} p-4 sm:p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-gray-900">Resumen semanal</p>
            <p className="text-[13px] text-[#4B5563] mt-1 leading-relaxed">
              Los lunes por la mañana (sobre las 8:30 en invierno y las 9:30 en verano, hora de Países Bajos) cada <strong>alumno</strong> recibe un
              correo corto con lo suyo de esa semana: sus clases en directo, cuánto avanzó en la formación y a qué clase le toca volver (con un
              botón que le lleva a esa clase), su tarea pendiente o corregida y la lectura de la semana. Lo que no tiene, no sale. Uno por
              semana, y cada alumno puede darse de baja desde el propio correo.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={d.activo}
            aria-label="Resumen semanal"
            onClick={alternar}
            disabled={ocupado === 'interruptor'}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${d.activo ? 'bg-[#16A34A]' : 'bg-[#D1D5DB]'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${d.activo ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <p className={`mt-3 text-[13px] font-medium ${d.activo ? 'text-[#15803D]' : 'text-[#6B7280]'}`}>
          {d.activo ? `Encendido · el próximo sale el ${diaLargo(d.proximo)}` : 'Apagado: no sale ningún correo'}
          {d.cambiado_en ? (
            <span className="font-normal text-[#9CA3AF]">
              {' '}
              · cambiado el {new Date(d.cambiado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              {d.por ? ` por ${d.por}` : ''}
            </span>
          ) : null}
        </p>

        <div className="mt-4 border-t border-[#F3F4F6] pt-3 space-y-2">
          <button onClick={() => setVerSi((v) => !v)} className="text-[13px] text-gray-800 inline-flex items-center gap-1 text-left">
            {verSi ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {d.activo ? 'Con lo de hoy, le sale a' : 'Si estuviera encendido, con lo de hoy le saldría a'} <strong>{cuantos(d.le_tocaria.length)}</strong>
            <span className="text-[#9CA3AF]">de {d.alumnos}</span>
          </button>
          {verSi ? (
            d.le_tocaria.length ? (
              <ul className="pl-5 space-y-1">
                {d.le_tocaria.map((a) => (
                  <li key={a.user_id} className="text-[12.5px] text-[#4B5563]">
                    <span className="text-gray-900">{a.nombre}</span> · {a.email} · lleva: {a.partes.join(', ')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pl-5 text-[12.5px] text-[#9CA3AF]">A nadie esta semana.</p>
            )
          ) : null}
          {d.no_les_toca.length ? (
            <>
              <button onClick={() => setVerNo((v) => !v)} className="text-[13px] text-gray-800 inline-flex items-center gap-1 text-left">
                {verNo ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                No le sale a <strong>{cuantos(d.no_les_toca.length)}</strong>
              </button>
              {verNo ? (
                <ul className="pl-5 space-y-1">
                  {d.no_les_toca.map((a) => (
                    <li key={a.user_id} className="text-[12.5px] text-[#4B5563]">
                      <span className="text-gray-900">{a.nombre}</span> · {a.motivo_texto}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
          <p className={META}>
            Se calcula con lo que hay ahora mismo; el lunes se vuelve a calcular. No lo reciben las cuentas del grupo «Testers» ni quien está
            fuera de los números. Si alguien se da de baja, se ve en su ficha (Progreso).
          </p>
        </div>
      </div>

      {/* Ver cómo queda */}
      <div className={`${TARJETA} p-4 sm:p-5 space-y-4`}>
        <div>
          <p className="text-[15px] font-semibold text-gray-900">Cómo le queda a cada uno</p>
          <p className={`${META} mt-0.5`}>
            Cada alumno recibe el suyo. Elige uno para verlo con sus datos de verdad. El asunto, el saludo, la despedida y el texto del
            botón se cambian en «Correos automáticos» → Resumen semanal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={quien}
            onChange={(e) => {
              setQuien(Number(e.target.value))
              setVista(null)
            }}
            aria-label="Con qué alumno verlo"
            className={CAMPO}
          >
            <option value={0}>Un alumno de ejemplo</option>
            {todos.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.nombre}
              </option>
            ))}
          </select>
          <button onClick={() => ver(false)} disabled={!!ocupado} className={BOTON}>
            {ocupado === 'vista' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Ver cómo queda
          </button>
          <button onClick={() => ver(true)} disabled={!!ocupado} className={BOTON}>
            {ocupado === 'prueba' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Mandármelo a mí
          </button>
        </div>
        <p className={META}>«Mandármelo a mí» te lo manda solo a ti: al alumno no le llega nada y no cuenta como enviado.</p>

        {vista ? (
          <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
            <p className="px-3.5 py-2 border-b border-[#E5E7EB] text-[12.5px] text-[#6B7280] truncate">
              Asunto: <span className="text-gray-900">{vista.asunto}</span> <span className="text-[#9CA3AF]">· {vista.nota}</span>
            </p>
            <iframe title="Vista previa" srcDoc={vista.html} className="w-full h-[640px] bg-white" sandbox="" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
