'use client'
/**
 * «Nueva clase», desde el calendario de la sala de profes (12/11/2026).
 *
 * Usuario: "me sigue obligando a crear una semana antes de crear un evento en
 * el calendario de los profes; primero me gustaría subir eso en eventos para
 * que se vea qué le toca a quién, luego ahí dentro ya meter yo el recurso".
 *
 * Lo mínimo: qué clase es, qué día y quién la da. El tema y el documento se
 * ponen después, en la ficha (`FichaClase`), que se abre al crearla. Se puede
 * repetir varias semanas seguidas y crear a la vez la del otro grupo. Por
 * dentro es la semana de siempre (`apps/api/src/services/tareas/clase_nueva.py`).
 */
import React, { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import { crearClase, type ClaseCreada } from '@services/tareas/tareas'
import { diaLegible, type SemanaEquipo } from '@/lib/nawar/salaProfes'
import { sumarDias } from '@/lib/nawar/semanasTrabajo'
import type { ClaseEquipo } from './useClasesEquipo'
import { POPPINS } from './estilo'

const CAMPO = 'w-full rounded-lg border border-[#DDE3EF] bg-white px-3 py-2 text-[14px] text-[#0B1033] outline-none focus:border-[#0b2da0]'
const ETIQUETA = 'text-[13px] font-semibold text-[#3B4262]'

/** «Clase semanal · Groep rood» → «Clase semanal». */
const base = (nombre: string) => nombre.split(' · ')[0].trim().toLowerCase()

/** El día que toca: una semana después de su última clase o, si ya pasó, su próximo día habitual. */
export function diaQueToca(uuid: string, semanas: SemanaEquipo[], hoy: string): string {
  const suyas = semanas.filter((s) => !s.suelta && s.courseUuid === uuid && s.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const ultima = suyas[suyas.length - 1]
  if (!ultima) return hoy
  let dia = sumarDias(ultima.fecha, 7)
  while (dia < hoy) dia = sumarDias(dia, 7)
  return dia
}

export default function NuevaClase({
  clases,
  semanas,
  hoy,
  admin,
  nombres,
  token,
  preset,
  onCerrar,
  onCreada,
}: {
  clases: ClaseEquipo[]
  semanas: SemanaEquipo[]
  hoy: string
  admin: boolean
  /** Los nombres de pila del equipo, para proponer quién la da. */
  nombres: string[]
  token: string
  preset?: { uuid?: string; fecha?: string }
  onCerrar: () => void
  onCreada: (creadas: ClaseCreada[]) => void
}) {
  const primera = preset?.uuid || clases[0]?.uuid || ''
  const [uuid, setUuid] = useState(primera)
  const [fecha, setFecha] = useState(preset?.fecha || diaQueToca(primera, semanas, hoy))
  const [tocada, setTocada] = useState(!!preset?.fecha)
  const [profe, setProfe] = useState('')
  const [tema, setTema] = useState('')
  const [repetir, setRepetir] = useState(1)
  const [tambien, setTambien] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const clase = clases.find((c) => c.uuid === uuid)
  const hermanas = useMemo(() => (clase ? clases.filter((c) => c.uuid !== clase.uuid && base(c.nombre) === base(clase.nombre)) : []), [clase, clases])
  const yaHay = semanas.some((s) => !s.suelta && s.courseUuid === uuid && s.fecha === fecha)

  const elegir = (u: string) => {
    setUuid(u)
    if (!tocada) setFecha(diaQueToca(u, semanas, hoy))
  }

  const crear = async () => {
    if (!uuid || !fecha) return
    setEnviando(true)
    try {
      const r = await crearClase(uuid, { fecha, tema: tema.trim(), profe: profe.trim(), repetir, tambien: tambien && hermanas.length > 0 }, token)
      if (!r.creadas.length) {
        toast.error('Ese día ya había una clase creada: no se ha creado ninguna.')
        return
      }
      const n = r.creadas.length
      toast.success(
        `${n === 1 ? 'Clase creada' : `${n} clases creadas`}${r.saltadas.length ? ` (${r.saltadas.length} ya ${r.saltadas.length === 1 ? 'existía' : 'existían'})` : ''}`
      )
      onCreada(r.creadas)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido crear la clase')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-[#0a1656]/40 p-0 sm:p-4" onClick={onCerrar}>
      <div className="w-full sm:max-w-[520px] max-h-[92dvh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-bold text-[#0B1033]" style={POPPINS}>
              Nueva clase
            </h2>
            <p className="mt-0.5 text-[13.5px] text-[#5B6382]">Qué clase es, qué día y quién la da. El tema y el documento los pones después, dentro.</p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1.5 rounded-lg text-[#6B7393] hover:text-[#0B1033]">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4">
          <p className={ETIQUETA}>Clase</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {clases.map((c) => (
              <button
                key={c.uuid}
                onClick={() => elegir(c.uuid)}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[13.5px] font-semibold ${
                  c.uuid === uuid ? 'border-[#0b2da0] bg-[#F3F6FE] text-[#0b2da0]' : 'border-[#DDE3EF] text-[#3B4262] hover:border-[#0b2da0]'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={ETIQUETA}>Día</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value)
                setTocada(true)
              }}
              className={`${CAMPO} mt-1`}
            />
            <span className="block mt-1 text-[12.5px] text-[#6B7393] first-letter:uppercase">
              {fecha ? diaLegible(fecha) : ''}
              {clase?.hora ? ` · ${clase.hora}` : ''}
            </span>
          </label>
          <label className="block">
            <span className={ETIQUETA}>Repetir</span>
            <select value={repetir} onChange={(e) => setRepetir(Number(e.target.value))} className={`${CAMPO} mt-1`}>
              <option value={1}>Solo esta clase</option>
              <option value={2}>2 semanas seguidas</option>
              <option value={4}>4 semanas seguidas</option>
              <option value={8}>8 semanas seguidas</option>
            </select>
            {repetir > 1 && fecha ? (
              <span className="block mt-1 text-[12.5px] text-[#6B7393]">Hasta el {diaLegible(sumarDias(fecha, 7 * (repetir - 1)))}.</span>
            ) : null}
          </label>
        </div>
        {yaHay ? <p className="mt-2 text-[13px] text-[#8A6A2A]">Ese día ya hay una clase creada en {clase?.nombre}: esa no se duplica.</p> : null}

        {admin ? (
          <label className="block mt-4">
            <span className={ETIQUETA}>Quién la da</span>
            <input
              value={profe}
              onChange={(e) => setProfe(e.target.value)}
              list="nawar-equipo-nombres"
              placeholder={clase?.profe ? `Vacío = ${clase.profe} (quien da esta clase)` : 'Nombre del profe o del monitor'}
              className={`${CAMPO} mt-1`}
            />
            <datalist id="nawar-equipo-nombres">
              {nombres.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <span className="block mt-1 text-[12.5px] text-[#6B7393]">Su nombre de pila, como en su cuenta: le saldrá en su sala de profes.</span>
          </label>
        ) : null}

        <label className="block mt-4">
          <span className={ETIQUETA}>
            Tema <span className="font-normal text-[#6B7393]">(si ya lo sabes)</span>
          </span>
          <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Se puede poner después" className={`${CAMPO} mt-1`} />
        </label>

        {hermanas.length ? (
          <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#E4EBF8] bg-[#F5F8FE] px-3.5 py-3 cursor-pointer">
            <input type="checkbox" checked={tambien} onChange={(e) => setTambien(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0b2da0]" />
            <span className="text-[13.5px] leading-snug text-[#2B3150]">
              <span className="font-semibold text-[#0B1033]">Crearla también en {hermanas.map((h) => h.nombre).join(' y ')}</span>
              <br />
              En su día de esa misma semana, con el mismo tema. Quién la da se pone en cada una.
            </span>
          </label>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCerrar} className="h-10 px-4 rounded-lg border border-[#DDE3EF] text-[14px] font-semibold text-[#3B4262]">
            Cancelar
          </button>
          <button onClick={crear} disabled={enviando || !uuid || !fecha} className="h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold disabled:opacity-60">
            {enviando ? 'Creando…' : repetir > 1 ? `Crear ${repetir} clases` : 'Crear la clase'}
          </button>
        </div>
      </div>
    </div>
  )
}
