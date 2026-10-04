'use client'

/**
 * Avisos → «1 semana sin entrar»: el recordatorio que sale solo.
 *
 * Pedido del usuario (04/10/2026): solo a alumnos, editable aquí, y con un
 * interruptor de activar/desactivar **apagado de serie** ("todavía no lo
 * actives: tengo que sacar de alumnos a gente que no lo es"). Las cuentas del
 * grupo «Testers» no reciben nada.
 *
 * El texto es la plantilla «semana», la MISMA que el recordatorio manual de
 * Progreso: cambiarla aquí la cambia allí. Servidor:
 * apps/api/src/services/panel/recordatorio.py.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  getPlantillasRecordatorio,
  getRecordatorioAuto,
  guardarPlantillasRecordatorio,
  guardarRecordatorioAuto,
  vistaRecordatorioAuto,
  type PlantillasRecordatorio,
  type RecordatorioAuto as Estado,
} from '@services/panel/panel'
import { confirmar } from '@lib/nawar/confirmar'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronRight, Eye, Loader2, Send } from 'lucide-react'
import { BOTON, BOTON_PRINCIPAL, META, TARJETA } from '../Panel/ui'

const CAMPO =
  'w-full bg-white rounded-md px-3 border border-[#E5E7EB] text-[13.5px] text-gray-900 placeholder:text-[#9CA3AF] outline-none focus:border-[#025dc7] transition-colors'

function Interruptor({ activo, onClick, ocupado }: { activo: boolean; onClick: () => void; ocupado: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      onClick={onClick}
      disabled={ocupado}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${activo ? 'bg-[#16A34A]' : 'bg-[#D1D5DB]'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function RecordatorioAuto() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token

  const [estado, setEstado] = useState<Estado | null>(null)
  const [plantillas, setPlantillas] = useState<PlantillasRecordatorio | null>(null)
  const [fabrica, setFabrica] = useState<PlantillasRecordatorio | null>(null)
  const [asunto, setAsunto] = useState('')
  const [texto, setTexto] = useState('')
  const [botones, setBotones] = useState<PlantillasRecordatorio['botones'] | null>(null)
  const [enlaces, setEnlaces] = useState<PlantillasRecordatorio['enlaces'] | null>(null)
  const [verLista, setVerLista] = useState(false)
  const [verBotones, setVerBotones] = useState(false)
  const [vista, setVista] = useState<{ asunto: string; html: string } | null>(null)
  const [ocupado, setOcupado] = useState<'' | 'interruptor' | 'guardar' | 'vista' | 'prueba'>('')
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    const [e, p] = await Promise.all([getRecordatorioAuto(org.id, token), getPlantillasRecordatorio(org.id, token)])
    if (!e.ok || !e.datos || !p.ok || !p.datos) return setError(e.error || p.error || 'No se ha podido cargar')
    setEstado(e.datos)
    setPlantillas(p.datos.plantillas)
    setFabrica(p.datos.de_fabrica)
    setAsunto(p.datos.plantillas.semana.asunto)
    setTexto(p.datos.plantillas.semana.texto)
    setBotones(p.datos.plantillas.botones)
    setEnlaces(p.datos.plantillas.enlaces)
  }, [org?.id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  const cambiado =
    !!plantillas &&
    (asunto !== plantillas.semana.asunto ||
      texto !== plantillas.semana.texto ||
      JSON.stringify(botones) !== JSON.stringify(plantillas.botones) ||
      JSON.stringify(enlaces) !== JSON.stringify(plantillas.enlaces))

  const alternar = async () => {
    if (!estado) return
    const activar = !estado.activo
    if (activar) {
      const n = estado.le_tocaria_hoy.length
      const ok = await confirmar(
        `¿Activar el recordatorio automático? Mañana por la mañana saldrá ${n === 0 ? 'a nadie todavía' : n === 1 ? 'a 1 alumno' : `a ${n} alumnos`}, y a partir de ahí a quien lleve 7 días sin entrar.`,
        { boton: 'Activar' }
      )
      if (!ok) return
    }
    setOcupado('interruptor')
    const r = await guardarRecordatorioAuto(org.id, activar, token)
    setOcupado('')
    if (!r.ok) return toast.error(r.error || 'No se ha podido cambiar')
    toast.success(activar ? 'Recordatorio automático activado' : 'Recordatorio automático desactivado')
    cargar()
  }

  const guardar = async () => {
    if (!plantillas || !botones || !enlaces) return false
    setOcupado('guardar')
    setError('')
    const r = await guardarPlantillasRecordatorio(org.id, { ...plantillas, botones, enlaces, semana: { asunto, texto } }, token)
    setOcupado('')
    if (!r.ok || !r.datos) {
      setError(r.error || 'No se ha podido guardar')
      return false
    }
    setPlantillas(r.datos.plantillas)
    toast.success('Texto guardado')
    return true
  }

  const verVista = async (aMi: boolean) => {
    // Los botones y enlaces van en la plantilla: se guardan antes para que la
    // vista enseñe lo que de verdad saldría.
    if (cambiado && !(await guardar())) return
    setOcupado(aMi ? 'prueba' : 'vista')
    const r = await vistaRecordatorioAuto(org.id, { asunto, texto, a_mi: aMi }, token)
    setOcupado('')
    if (!r.ok || !r.datos) return setError(r.error || 'No se ha podido preparar')
    if (aMi) return toast.success(`Prueba enviada a ${r.datos.para}`)
    setVista({ asunto: r.datos.asunto, html: r.datos.html })
  }

  const deFabrica = () => {
    if (!fabrica) return
    setAsunto(fabrica.semana.asunto)
    setTexto(fabrica.semana.texto)
    setBotones(fabrica.botones)
    setEnlaces(fabrica.enlaces)
    setVista(null)
  }

  if (error && !estado) return <p className="text-[13.5px] text-red-700">{error}</p>
  if (!estado || !plantillas || !botones || !enlaces)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )

  const n = estado.le_tocaria_hoy.length
  return (
    <div className="max-w-3xl space-y-5">
      {/* El interruptor */}
      <div className={`${TARJETA} p-4 sm:p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-gray-900">«Esta semana no has entrado»</p>
            <p className="text-[13px] text-[#4B5563] mt-1 leading-relaxed">
              Sale solo cada mañana (a las 9:00 en verano y a las 8:00 en invierno, hora de Países Bajos) a los <strong>alumnos</strong> que llevan {estado.dias} días o más sin
              entrar. Uno por racha: no se repite hasta que vuelvan a entrar y se vuelvan a ir. Si ya le mandaste uno a mano, ese cuenta.
            </p>
          </div>
          <Interruptor activo={estado.activo} onClick={alternar} ocupado={ocupado === 'interruptor'} />
        </div>
        <p className={`mt-3 text-[13px] font-medium ${estado.activo ? 'text-[#15803D]' : 'text-[#6B7280]'}`}>
          {estado.activo ? 'Activado' : 'Desactivado: no sale nada'}
          {estado.cambiado_en ? (
            <span className="font-normal text-[#9CA3AF]">
              {' '}
              · cambiado el {new Date(estado.cambiado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              {estado.por ? ` por ${estado.por}` : ''}
            </span>
          ) : null}
        </p>

        <div className="mt-4 border-t border-[#F3F4F6] pt-3 space-y-2">
          <button onClick={() => setVerLista((v) => !v)} className="text-[13px] text-gray-800 inline-flex items-center gap-1">
            {verLista ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {estado.activo ? 'Le sale mañana a' : 'Si estuviera activado, hoy le saldría a'}{' '}
            <strong>{n === 1 ? '1 alumno' : `${n} alumnos`}</strong>
          </button>
          {verLista ? (
            n ? (
              <ul className="pl-5 space-y-1">
                {estado.le_tocaria_hoy.map((a) => (
                  <li key={a.user_id} className="text-[12.5px] text-[#4B5563]">
                    <span className="text-gray-900">{a.nombre}</span> · {a.email} ·{' '}
                    {a.dias === null ? 'no ha entrado nunca' : `${a.dias} días sin entrar`}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pl-5 text-[12.5px] text-[#9CA3AF]">Nadie: todos han entrado esta semana o ya tienen su recordatorio.</p>
            )
          ) : null}
          <p className={META}>
            {estado.testers.grupo ? (
              <>
                Grupo «{estado.testers.grupo}»: {estado.testers.cuentas} {estado.testers.cuentas === 1 ? 'cuenta' : 'cuentas'} que no reciben
                ningún correo de alumno (ni este, ni avisos, ni «módulo abierto»).
              </>
            ) : (
              <>
                No hay grupo «Testers». Para que las cuentas de prueba no reciban nada, créalo en{' '}
                <a href="/dash/users/settings/usergroups" className="text-[#025dc7] hover:underline">
                  Equipo y grupos
                </a>{' '}
                con el nombre «Testers» y mete ahí esas cuentas.
              </>
            )}
          </p>
        </div>
      </div>

      {/* El texto */}
      <div className={`${TARJETA} p-4 sm:p-5 space-y-4`}>
        <div>
          <p className="text-[15px] font-semibold text-gray-900">El correo</p>
          <p className={`${META} mt-0.5`}>
            Es el mismo texto que «Esta semana no ha entrado» del recordatorio a mano de Progreso: si lo cambias aquí, cambia allí.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-gray-800">Asunto</label>
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className={`${CAMPO} h-9`} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-gray-800">Texto</label>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={12} className={`${CAMPO} py-2.5 leading-relaxed resize-y`} />
          <p className={META}>
            Los botones salen donde pongas <code>[seguir]</code>, <code>[victoria]</code> y <code>[consulta]</code>, cada uno en su propia
            línea. Huecos: <code>{'{nombre}'}</code>, <code>{'{dias}'}</code> y <code>{'{clase}'}</code>. Una línea en blanco separa
            párrafos; <code>*así*</code> va en negrita.
          </p>
        </div>

        <div className="rounded-lg border border-[#E5E7EB]">
          <button onClick={() => setVerBotones((v) => !v)} className="w-full text-left px-3.5 py-2.5 text-[13px] font-medium text-gray-800 flex justify-between gap-3">
            <span className="shrink-0 whitespace-nowrap">Botones del correo</span>
            <span className="text-[#6B7280] font-normal truncate">{`${botones.seguir} · ${botones.victoria} · ${botones.consulta}`}</span>
          </button>
          {verBotones ? (
            <div className="px-3.5 pb-3.5 space-y-2.5">
              {(
                [
                  ['seguir', 'Lleva a la clase donde lo dejó cada alumno'],
                  ['victoria', 'Lleva al canal 🏆 Victorias de la comunidad'],
                  ['consulta', 'Lleva a Consultas'],
                ] as const
              ).map(([k, nota]) => (
                <div key={k}>
                  <input value={botones[k]} onChange={(e) => setBotones({ ...botones, [k]: e.target.value })} className={`${CAMPO} h-9`} />
                  {k !== 'seguir' ? (
                    <input
                      value={enlaces[k]}
                      onChange={(e) => setEnlaces({ ...enlaces, [k]: e.target.value })}
                      placeholder="/community/… o https://…"
                      aria-label={`Enlace del botón ${botones[k]}`}
                      className={`${CAMPO} h-8 mt-1 text-[12.5px] text-[#4B5563]`}
                    />
                  ) : null}
                  <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">{nota}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="text-[13px] text-red-700">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={guardar} disabled={!!ocupado || !cambiado} className={BOTON_PRINCIPAL}>
            {ocupado === 'guardar' ? <Loader2 size={14} className="animate-spin" /> : null} Guardar
          </button>
          <button onClick={() => verVista(false)} disabled={!!ocupado} className={BOTON}>
            {ocupado === 'vista' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Ver cómo queda
          </button>
          <button onClick={() => verVista(true)} disabled={!!ocupado} className={BOTON}>
            {ocupado === 'prueba' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Mandármelo a mí
          </button>
          <button onClick={deFabrica} disabled={!!ocupado} className="text-[12.5px] text-[#6B7280] hover:text-gray-900 px-1">
            Volver al texto de fábrica
          </button>
        </div>
        {cambiado ? <p className="text-[12.5px] text-[#B45309]">Hay cambios sin guardar.</p> : null}

        {vista ? (
          <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
            <p className="px-3.5 py-2 border-b border-[#E5E7EB] text-[12.5px] text-[#6B7280] truncate">
              Asunto: <span className="text-gray-900">{vista.asunto}</span> <span className="text-[#9CA3AF]">· con un alumno de ejemplo</span>
            </p>
            <iframe title="Vista previa" srcDoc={vista.html} className="w-full h-[640px] bg-white" sandbox="" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
