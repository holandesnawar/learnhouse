'use client'

/**
 * El estudio de grabaciones de una clase, para el equipo (10/11/2026): lo que
 * grabó la sala, día a día y con la semana que le toca. Nadie sube nada: la
 * sala graba sola y aquí aparece. Tres cosas por día: «Publicar tal cual»,
 * «Recortar» (el editor con la línea de tiempo) y «Quitar».
 *
 * Los datos y las acciones, en `useEstudio`; la explicación entera, en
 * apps/api/src/services/salas/estudio_grabaciones.py.
 */

import React, { useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, Scissors } from 'lucide-react'
import { duracionCorta } from '@/lib/nawar/recorte'
import { diaCorto } from '@services/tareas/tareas'
import type { DiaGrabado } from '@services/grabaciones/grabaciones'
import EditorRecorte from './EditorRecorte'
import { useEstudio } from './useEstudio'

const BOTON =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#D5DEEE] bg-white text-[13px] font-semibold text-[#0B1033] hover:border-[#0b2da0] hover:text-[#0b2da0] disabled:opacity-40'
const PRINCIPAL = 'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0b2da0] text-[13px] font-semibold text-white hover:bg-[#0a2690] disabled:opacity-40'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const nombreDia = (f: string) => DIAS[new Date(`${f}T12:00:00`).getDay()] || ''

export default function EstudioGrabaciones({ courseUuid }: { courseUuid: string }) {
  const { data, isLoading, isFetching, error, refetch, token, recargar, publicarTalCual, quitar } = useEstudio(courseUuid)
  const [editando, setEditando] = useState<DiaGrabado | null>(null)
  const [ocupado, setOcupado] = useState('')

  if (isLoading)
    return (
      <div className="flex items-center gap-2 py-10 text-[14px] text-[#6B7393]">
        <Loader2 size={16} className="animate-spin" /> Mirando lo que ha grabado la sala…
      </div>
    )
  if (error) return <p className="py-8 text-[14px] text-[#B4413C]">{(error as Error).message || 'No se pudieron leer las grabaciones'}</p>
  if (!data) return null

  const semanaDe = (id: number) => data.semanas.find((s) => s.id === id) || null

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-[#5A6480]">
          La sala graba sola cada clase. Aquí aparece lo grabado: publícalo tal cual o recórtalo antes.
        </p>
        <button onClick={() => refetch()} disabled={isFetching} className={BOTON} title="Volver a mirar en la sala">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {data.aviso ? (
        <p className="mt-3 rounded-lg border border-[#F0E2C0] bg-[#FFFBF2] px-3.5 py-2.5 text-[13px] text-[#8A6A2A]">{data.aviso}</p>
      ) : null}

      {!data.dias.length && !data.aviso ? (
        <div className="mt-4 rounded-xl border border-dashed border-[#D5DEEE] bg-white px-5 py-8 text-center">
          <p className="text-[14.5px] font-semibold text-[#0B1033]">La sala de esta clase aún no ha grabado nada</p>
          <p className="mt-1 text-[13px] text-[#6B7393]">
            En cuanto se dé una clase en la sala de la escuela, la grabación aparece aquí sola unos minutos después de terminar.
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {data.dias.map((dia) => {
          const listas = dia.partes.filter((p) => p.lista)
          const procesando = dia.partes.length - listas.length
          const publicada = dia.publicada
          const semana = dia.semana
          const laSemana = semana ? semanaDe(semana.id) : null
          const clave = dia.dia
          return (
            <section key={dia.dia} className="rounded-xl border border-[#E2E8F4] bg-white px-4 sm:px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A91AD]">
                    {nombreDia(dia.dia)} {diaCorto(dia.dia).replace(/^\S+\s/, '')}
                  </p>
                  <p className="mt-0.5 text-[16px] font-bold text-[#0B1033] leading-snug">
                    {publicada?.tema || semana?.tema || 'Sin semana ese día'}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#5A6480]">
                    La sala grabó {duracionCorta(dia.dur)}
                    {dia.partes.length > 1 ? ` en ${dia.partes.length} partes` : ''}
                    {dia.partes[0]?.hora ? ` · desde las ${dia.partes[0].hora}` : ''}
                    {procesando ? ` · ${procesando === dia.partes.length ? 'aún se está procesando' : `${procesando} aún se procesa`}` : ''}
                  </p>
                  {publicada ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[#15803D]">
                      <CheckCircle2 size={15} /> Publicada · los alumnos ven {duracionCorta(publicada.segundos)}
                      {semanaDe(publicada.semana_id)?.grabacion_sala?.vistas
                        ? ` · la han visto ${semanaDe(publicada.semana_id)?.grabacion_sala?.vistas}`
                        : ''}
                    </p>
                  ) : !semana ? (
                    <p className="mt-1.5 text-[12.5px] text-[#8A6A2A]">
                      Ese día no hay ninguna semana de esta clase. En «Recortar» puedes elegir en cuál publicarla.
                    </p>
                  ) : laSemana?.subida ? (
                    <p className="mt-1.5 text-[12.5px] text-[#8A6A2A]">Esta semana ya tiene una grabación subida a mano.</p>
                  ) : (
                    <p className="mt-1.5 text-[13px] text-[#6B7393]">Sin publicar: los alumnos aún no la ven.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {!publicada && semana ? (
                    <button
                      disabled={!listas.length || ocupado === clave}
                      onClick={async () => {
                        setOcupado(clave)
                        await publicarTalCual(dia, semana)
                        setOcupado('')
                      }}
                      className={PRINCIPAL}
                    >
                      {ocupado === clave ? <Loader2 size={14} className="animate-spin" /> : null}
                      Publicar tal cual
                    </button>
                  ) : null}
                  <button disabled={!listas.length} onClick={() => setEditando(dia)} className={BOTON}>
                    <Scissors size={14} /> {publicada ? 'Cambiar el recorte' : 'Recortar'}
                  </button>
                  {publicada ? (
                    <button
                      disabled={ocupado === clave}
                      onClick={async () => {
                        setOcupado(clave)
                        await quitar({ id: publicada.semana_id, tema: publicada.tema })
                        setOcupado('')
                      }}
                      className={`${BOTON} hover:border-[#B4413C] hover:text-[#B4413C]`}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          )
        })}
      </div>

      {editando ? (
        <EditorRecorte
          courseUuid={courseUuid}
          dia={editando}
          semanas={data.semanas}
          token={token}
          onClose={() => setEditando(null)}
          onPublicado={recargar}
        />
      ) : null}
    </div>
  )
}
