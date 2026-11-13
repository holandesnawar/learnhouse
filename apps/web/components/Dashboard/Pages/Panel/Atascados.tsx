'use client'

/**
 * Progreso → «Sin avanzar en la formación» (13/11/2026). Los alumnos que
 * llevan dos semanas o más sin terminar ninguna clase de la formación, entren
 * o no a la escuela: «van a las clases en directo y no tocan la formación».
 * Cada uno con lo que le toca y un WhatsApp ya escrito; al volver se pregunta
 * si se mandó, y solo entonces se apunta (como en Llamadas). A quien ya se le
 * escribió esta semana se le ve aparte, sin el botón en azul.
 * Quién sale: `apps/api/src/services/panel/alumnos.py::atasco`.
 */

import React, { useState } from 'react'
import { Hourglass, Mail, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { apuntarWhatsappAlumno, type AlumnoProgreso } from '@services/panel/panel'
import { getSchoolUrl } from '@services/config/config'
import { CURSO_FORMACION_UUID, RUTA_FORMACION } from '@/lib/nawar/cursos'
import { mensajeAtascado, resumenAtasco } from '@/lib/nawar/atascados'
import { numeroWhatsApp } from '@/lib/nawar/telefono'
import { BOTON, BOTON_PRINCIPAL, Plegable } from './ui'

function enlaceDe(a: AlumnoProgreso): string {
  const uuid = (a.seguir_uuid || '').replace('activity_', '')
  return getSchoolUrl(uuid ? `/course/${CURSO_FORMACION_UUID}/activity/${uuid}` : RUTA_FORMACION)
}

function entra(a: AlumnoProgreso): string {
  const d = a.estado.dias
  if (d === null) return 'No ha entrado nunca a la escuela'
  if (d === 0) return 'Ha entrado hoy a la escuela'
  if (d === 1) return 'Entró ayer a la escuela'
  return d <= 7 ? `Entró a la escuela hace ${d} días` : `Tampoco entra: ${d} días sin entrar`
}

export function estaAtascado(a: AlumnoProgreso): boolean {
  return !!a.sin_avanzar?.atascado
}

export default function Atascados({
  alumnos,
  orgId,
  token,
  yo,
  onCorreo,
  onFicha,
  onCambio,
}: {
  alumnos: AlumnoProgreso[]
  orgId: number
  token: string
  yo: string
  onCorreo: (a: AlumnoProgreso) => void
  onFicha: (a: AlumnoProgreso) => void
  onCambio: () => void
}) {
  const [preguntar, setPreguntar] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  const todos = alumnos.filter(estaAtascado).sort((x, y) => (y.sin_avanzar?.dias || 0) - (x.sin_avanzar?.dias || 0))
  if (!todos.length) return null
  const porEscribir = todos.filter((a) => !a.sin_avanzar?.escrito_hace_poco)
  const yaEscritos = todos.filter((a) => a.sin_avanzar?.escrito_hace_poco)

  async function enviado(a: AlumnoProgreso) {
    setGuardando(true)
    const r = await apuntarWhatsappAlumno(orgId, a.user_id, token)
    setGuardando(false)
    setPreguntar(null)
    if (r.ok) {
      toast.success('Apuntado')
      onCambio()
    } else toast.error(r.error || 'No se ha podido apuntar')
  }

  const fila = (a: AlumnoProgreso, escrito: boolean) => {
    const num = numeroWhatsApp(a.telefono)
    const clase = a.siguiente ? a.siguiente.clase : ''
    const texto = encodeURIComponent(
      mensajeAtascado({ nombre: a.nombre, yo, clase, enlace: enlaceDe(a), sinEmpezar: !!a.sin_avanzar?.sin_empezar })
    )
    return (
      <li key={a.user_id} className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" onClick={() => onFicha(a)} className="min-w-0 flex-1 text-left">
            <p className="text-[14px] font-semibold text-gray-900 truncate">{a.nombre}</p>
            <p className="text-[12.5px] text-[#4B5563]">
              <span className="font-medium text-[#B4413C]">{resumenAtasco(a.sin_avanzar?.dias ?? null, !!a.sin_avanzar?.sin_empezar)}</span>
              {' · '}
              {entra(a)}
            </p>
            <p className="text-[12.5px] text-[#6B7280] truncate">
              {a.siguiente ? `Le toca: ${a.siguiente.modulo} · ${a.siguiente.clase}` : 'Le toca: empezar la formación'}
              {` · ${a.hechas} de ${a.total} clases`}
            </p>
            {escrito && a.ultimo_recordatorio ? (
              <p className="text-[12px] text-[#6B7280] mt-0.5">
                Se le escribió el{' '}
                {new Date(a.ultimo_recordatorio.sent_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                {a.ultimo_recordatorio.por ? `, ${a.ultimo_recordatorio.por}` : ''}
                {a.ultimo_recordatorio.tipo === 'whatsapp' ? ' · por WhatsApp' : ' · por correo'}
              </p>
            ) : null}
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            {num ? (
              <a
                href={`https://wa.me/${num}?text=${texto}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setPreguntar(a.user_id)}
                className={escrito ? BOTON : BOTON_PRINCIPAL}
              >
                <MessageCircle size={13} /> WhatsApp
              </a>
            ) : (
              <span className="text-[12px] text-[#9CA3AF]">Sin teléfono</span>
            )}
            <button type="button" onClick={() => onCorreo(a)} className={BOTON}>
              <Mail size={13} /> Correo
            </button>
          </div>
        </div>
        {preguntar === a.user_id ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-[#E2E8F4] bg-[#F8FAFE] px-3 py-2">
            <p className="text-[13px] text-gray-900 flex-1 min-w-[180px]">¿Le has mandado el mensaje a {a.nombre.split(' ')[0]}?</p>
            <button type="button" disabled={guardando} onClick={() => enviado(a)} className={BOTON_PRINCIPAL}>
              Sí, enviado
            </button>
            <button type="button" onClick={() => setPreguntar(null)} className={BOTON}>
              No lo envié
            </button>
          </div>
        ) : null}
      </li>
    )
  }

  return (
    <Plegable
      titulo="Sin avanzar en la formación"
      icono={<Hourglass size={16} />}
      cifra={todos.length}
      recordarComo="progreso-atascados"
      abiertoDeSerie
      color="#B4413C"
      aviso={porEscribir.length > 0}
      resumen={
        porEscribir.length
          ? `${porEscribir.length} por escribir · dos semanas o más sin terminar una clase`
          : 'Ya se les ha escrito a todos esta semana'
      }
    >
      <p className="px-4 pt-3 text-[12.5px] text-[#6B7280]">
        Llevan dos semanas o más sin terminar ninguna clase de la formación, aunque entren a la escuela o vayan a las clases en
        directo. El mensaje ya va escrito con lo que les toca: puedes cambiarlo en WhatsApp antes de mandarlo.
      </p>
      <ul className="divide-y divide-[#EEF1F7]">{porEscribir.map((a) => fila(a, false))}</ul>
      {yaEscritos.length ? (
        <>
          <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] border-t border-[#EEF1F7]">
            Ya se les escribió esta semana
          </p>
          <ul className="divide-y divide-[#EEF1F7]">{yaEscritos.map((a) => fila(a, true))}</ul>
        </>
      ) : null}
    </Plegable>
  )
}
