'use client'

/**
 * Los ejercicios de la lectura semanal, dentro de la escuela (14/11/2026).
 * Se abren con un botón en la lectura, se contestan ahí mismo y dicen al
 * momento si está bien, con la buena y su explicación. No se guarda en el
 * servidor: es para corregirse solo. El navegador recuerda el último
 * resultado para enseñarlo en el botón. Formato y corrección:
 * `lib/nawar/ejerciciosLectura.ts`.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import { esCorrecta, opcionesDe, TITULO_TIPO, type EjercicioLectura } from '@lib/nawar/ejerciciosLectura'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }
const clave = (id: string) => `nawar.lectura.ejercicios.${id}`

export function resultadoGuardado(id: string): { aciertos: number; total: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(clave(id)) || 'null')
    return v && typeof v.aciertos === 'number' ? v : null
  } catch {
    return null
  }
}

function Pregunta({ texto }: { texto: string }) {
  // El hueco «___» se pinta como una raya.
  const trozos = texto.split(/_{2,}/)
  return (
    <p lang="nl" className="text-[16px] leading-relaxed text-[#0B1033] font-medium">
      {trozos.map((t, i) => (
        <React.Fragment key={i}>
          {t}
          {i < trozos.length - 1 ? <span className="inline-block w-16 border-b-2 border-[#0b2da0] mx-1 align-baseline" /> : null}
        </React.Fragment>
      ))}
    </p>
  )
}

function Ejercicio({
  e,
  n,
  respuesta,
  onResponder,
}: {
  e: EjercicioLectura
  n: number
  respuesta?: string
  onResponder: (r: string) => void
}) {
  const [escrito, setEscrito] = useState('')
  const [verEjemplo, setVerEjemplo] = useState(false)
  const contestado = respuesta !== undefined
  const bien = contestado && esCorrecta(e, respuesta!)
  const opciones = opcionesDe(e)

  return (
    <li className="rounded-xl border border-[#E4E8F2] bg-white px-4 py-4 space-y-3">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">
        {n}. {TITULO_TIPO[e.tipo]}
      </p>
      <Pregunta texto={e.pregunta} />

      {e.tipo === 'ab' ? (
        <div className="space-y-2">
          <textarea
            value={escrito}
            onChange={(ev) => setEscrito(ev.target.value)}
            rows={2}
            lang="nl"
            placeholder="Escribe aquí en neerlandés"
            className="w-full px-3 py-2 rounded-lg border border-[#DDE3F0] text-[15px] outline-none focus:border-[#0b2da0]"
          />
          {e.correcta ? (
            verEjemplo ? (
              <p className="rounded-lg bg-[#F4F7FD] px-3 py-2 text-[14.5px] text-[#0B1033]">
                <span className="font-semibold">Un ejemplo: </span>
                <span lang="nl">{e.correcta}</span>
              </p>
            ) : (
              <button type="button" onClick={() => setVerEjemplo(true)} className="text-[13.5px] font-semibold text-[#0b2da0]">
                Ver un ejemplo de respuesta
              </button>
            )
          ) : null}
        </div>
      ) : opciones.length ? (
        <div className="flex flex-wrap gap-2">
          {opciones.map((o) => {
            const elegida = respuesta === o
            const esLaBuena = contestado && esCorrecta(e, o)
            const estilo = !contestado
              ? 'border-[#DDE3F0] text-[#0B1033] hover:border-[#0b2da0]'
              : esLaBuena
                ? 'border-[#16A34A] bg-[#F0FBF4] text-[#166534]'
                : elegida
                  ? 'border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]'
                  : 'border-[#EEF1F7] text-[#A3AAC2]'
            return (
              <button
                key={o}
                type="button"
                disabled={contestado}
                onClick={() => onResponder(o)}
                lang="nl"
                className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-lg border text-[15px] font-medium ${estilo}`}
              >
                {contestado && esLaBuena ? <Check size={15} strokeWidth={3} /> : null}
                {contestado && elegida && !esLaBuena ? <X size={15} strokeWidth={3} /> : null}
                {o}
              </button>
            )
          })}
        </div>
      ) : (
        <form
          onSubmit={(ev) => {
            ev.preventDefault()
            if (escrito.trim()) onResponder(escrito)
          }}
          className="flex gap-2"
        >
          <input
            value={contestado ? respuesta : escrito}
            onChange={(ev) => setEscrito(ev.target.value)}
            disabled={contestado}
            lang="nl"
            placeholder="Escribe la palabra"
            className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-[#DDE3F0] text-[15px] outline-none focus:border-[#0b2da0] disabled:bg-[#F7F9FD]"
          />
          {!contestado ? (
            <button type="submit" disabled={!escrito.trim()} className="h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold disabled:opacity-50">
              Comprobar
            </button>
          ) : null}
        </form>
      )}

      {contestado && e.tipo !== 'ab' ? (
        <div className={`rounded-lg px-3 py-2 text-[14px] ${bien ? 'bg-[#F0FBF4] text-[#166534]' : 'bg-[#FEF2F2] text-[#991B1B]'}`}>
          <span className="font-semibold">{bien ? '¡Bien!' : 'No es así.'}</span>
          {!bien ? (
            <>
              {' '}
              La respuesta es <span lang="nl" className="font-semibold">{e.correcta}</span>.
            </>
          ) : null}
          {e.explicacion ? (
            <span className="block mt-0.5 text-[#3B4262]" lang="nl">
              {e.explicacion}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export default function EjerciciosLectura({
  id,
  titulo,
  ejercicios,
  onCerrar,
}: {
  id: string
  titulo: string
  ejercicios: EjercicioLectura[]
  onCerrar: (resultado: { aciertos: number; total: number } | null) => void
}) {
  const [respuestas, setRespuestas] = useState<Record<number, string>>({})
  const corregibles = useMemo(() => ejercicios.map((e, i) => (e.tipo === 'ab' ? -1 : i)).filter((i) => i >= 0), [ejercicios])
  const contestadas = corregibles.filter((i) => respuestas[i] !== undefined)
  const aciertos = contestadas.filter((i) => esCorrecta(ejercicios[i], respuestas[i])).length
  const terminado = corregibles.length > 0 && contestadas.length === corregibles.length
  const resultado = terminado ? { aciertos, total: corregibles.length } : null

  useEffect(() => {
    if (!resultado) return
    try {
      localStorage.setItem(clave(id), JSON.stringify(resultado))
    } catch {
      /* sin almacenamiento */
    }
  }, [id, resultado?.aciertos, resultado?.total]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => ev.key === 'Escape' && onCerrar(resultado)
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  return (
    <EnElCuerpo>
      <div className="fixed inset-0 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4">
        <div className="w-full sm:max-w-[720px] sm:max-h-[92vh] h-full sm:h-auto bg-[#F7F9FD] sm:rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-start gap-3 px-5 py-4 bg-white border-b border-[#EEF1F7]">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Ejercicios de la lectura</p>
              <h2 style={POPPINS} className="text-[18px] font-bold text-[#0B1033] truncate" lang="nl">
                {titulo}
              </h2>
              {corregibles.length ? (
                <p className="text-[13px] text-[#6B7393]">
                  {contestadas.length} de {corregibles.length} contestadas · {aciertos} bien
                </p>
              ) : null}
            </div>
            <button type="button" onClick={() => onCerrar(resultado)} aria-label="Cerrar" className="p-2 rounded-lg text-[#6B7393] hover:text-[#0B1033]">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
            <ol className="space-y-3">
              {ejercicios.map((e, i) => (
                <Ejercicio
                  key={`${i}-${respuestas[i] === undefined ? 'n' : 's'}`}
                  e={e}
                  n={i + 1}
                  respuesta={respuestas[i]}
                  onResponder={(r) => setRespuestas((a) => ({ ...a, [i]: r }))}
                />
              ))}
            </ol>

            {terminado ? (
              <div className="mt-4 rounded-xl bg-white border border-[#E4E8F2] px-4 py-4 text-center space-y-3">
                <p style={POPPINS} className="text-[18px] font-bold text-[#0B1033]">
                  Has acertado {aciertos} de {corregibles.length}
                </p>
                <p className="text-[14px] text-[#4A5272]">
                  {aciertos === corregibles.length
                    ? 'Perfecto. Ya puedes contar esta lectura con tus palabras.'
                    : 'Vuelve a leer el texto y repite los que fallaste.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRespuestas({})}
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#E4E8F2] bg-white text-[14px] font-semibold text-[#0b2da0]"
                  >
                    <RotateCcw size={15} /> Repetir
                  </button>
                  <button type="button" onClick={() => onCerrar(resultado)} className="h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold">
                    Volver a la lectura
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </EnElCuerpo>
  )
}
