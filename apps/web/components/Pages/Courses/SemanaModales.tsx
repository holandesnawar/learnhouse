'use client'

/**
 * Crear y cambiar las semanas de una clase en directo (el equipo, también los
 * profes desde el 02/11/2026; «Quitar la semana», solo administradores).
 *
 * «Nueva semana» hace de una vez lo que antes eran cinco pasos en el editor
 * del curso: crea el capítulo con el tema, sube la presentación (PDF) como
 * clase, cuelga los ejercicios de una lección de la escuela (una clase por
 * parte que tenga: Flashcards, Oefeningen, Luisteren…), las publica y lo
 * marca como semana con su tarea. La grabación se añade después, en el
 * editor, como siempre.
 */

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2, Trash2, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { createChapter } from '@services/courses/chapters'
import { createActivity, createFileActivity, updateActivity } from '@services/courses/activities'
import { revalidateTags } from '@services/utils/ts/requests'
import { queryKeys } from '@/lib/query/keys'
import { getAllLessonsForModule, getLessonSections, getModules } from '@/lib/exercises-app/courseService'
import { borrarSemana, crearSemana, diaCorto, editarSemana, type Hermana, type Semana } from '@services/tareas/tareas'
import { confirmar } from '@lib/nawar/confirmar'
import { diaEnLaOtraClase } from '@/lib/nawar/otraClase'

// Las partes de una lección que se cuelgan como ejercicios, en este orden y
// con el nombre que ve el alumno (los mismos que NativeExercisePicker).
const PARTES: { id: string; nombre: string }[] = [
  { id: 'flashcards', nombre: 'Flashcards' },
  { id: 'vocabulary', nombre: 'Oefeningen' },
  { id: 'luisteren', nombre: 'Luisteren' },
  { id: 'lezen', nombre: 'Lezen' },
  { id: 'spreken', nombre: 'Spreken' },
]

const ENUNCIADO_EJEMPLO = '1. Escribe 5 frases sobre…\n2. Grábate 30 segundos contando…'

const CAMPO =
  'w-full rounded-lg border border-[#DDE6F5] px-3 py-2 text-[14px] text-gray-900 outline-none focus:border-[#0b2da0] bg-white'
const ETIQUETA = 'block text-[12px] font-semibold text-[#5A6480] mb-1'

function Ventana({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-bold text-gray-900" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            {titulo}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Las casillas de la campana de una semana (05/11/2026): avisar a los alumnos
 * de ESTA clase (los de su grupo) cuando esté la presentación y cuando esté la
 * grabación. Sale en la campana de la escuela, sin correo.
 */
export function CasillasCampana({
  presentacion,
  grabacion,
  onPresentacion,
  onGrabacion,
  disabled = false,
  compacto = false,
}: {
  presentacion: boolean
  grabacion: boolean
  onPresentacion: (v: boolean) => void
  onGrabacion: (v: boolean) => void
  disabled?: boolean
  compacto?: boolean
}) {
  const casilla = 'h-4 w-4 accent-[#0b2da0] shrink-0'
  if (compacto) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[#5A6480]">
        <span>Avisar en la campana:</span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" className={casilla} checked={presentacion} disabled={disabled} onChange={(e) => onPresentacion(e.target.checked)} />
          presentación
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" className={casilla} checked={grabacion} disabled={disabled} onChange={(e) => onGrabacion(e.target.checked)} />
          grabación
        </label>
      </span>
    )
  }
  return (
    <div className="rounded-lg bg-[#F0F5FF] px-3 py-2.5 space-y-1.5">
      <p className="text-[12px] font-semibold text-[#5A6480]">Avisar a los alumnos de esta clase en la campana</p>
      <label className="flex items-start gap-2 text-[13.5px] text-gray-900 cursor-pointer">
        <input type="checkbox" className={casilla + ' mt-0.5'} checked={presentacion} disabled={disabled} onChange={(e) => onPresentacion(e.target.checked)} />
        Cuando esté la presentación, para repasarla antes de la clase
      </label>
      <label className="flex items-start gap-2 text-[13.5px] text-gray-900 cursor-pointer">
        <input type="checkbox" className={casilla + ' mt-0.5'} checked={grabacion} disabled={disabled} onChange={(e) => onGrabacion(e.target.checked)} />
        Cuando esté la grabación, después de la clase
      </label>
      <p className="text-[11.5px] text-[#6B7280]">Solo les sale a los alumnos que ven esta clase (su grupo). No manda ningún correo.</p>
    </div>
  )
}

function sumarDias(dia: string, n: number): string {
  if (!dia) return ''
  const [a, m, d] = dia.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d + n, 12))
  return f.toISOString().slice(0, 10)
}

function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function NuevaSemana({
  courseUuid,
  curso,
  orgslug,
  ultima,
  hermanas = [],
  sencilla = false,
  onClose,
  onCreada,
}: {
  courseUuid: string
  curso: any
  orgslug: string
  ultima: Semana | null
  /** La Masterclass y el Spreekclub (10/11/2026, "crear una semana sin crear
   *  semana"): solo tema, día y, si se quiere, la presentación. Sin ejercicios
   *  ni tarea, y se llama «sesión». Por dentro es la misma semana de siempre. */
  sencilla?: boolean
  /** La otra clase con el mismo nombre (el otro grupo): la semana se puede crear en las dos (06/11/2026). */
  hermanas?: Hermana[]
  onClose: () => void
  onCreada: () => void
}) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tema, setTema] = useState('')
  // Una semana después de la última, o hoy.
  const [fecha, setFecha] = useState(ultima?.fecha ? sumarDias(ultima.fecha, 7) : hoyLocal())
  const [pdf, setPdf] = useState<File | null>(null)
  const [modulo, setModulo] = useState('')
  const [leccion, setLeccion] = useState('')
  const [enunciado, setEnunciado] = useState('')
  const [limite, setLimite] = useState('')
  const [avisarP, setAvisarP] = useState(true)
  const [avisarG, setAvisarG] = useState(!sencilla)
  const [paso, setPaso] = useState('')
  const que = sencilla ? 'sesión' : 'semana'
  // En la otra clase, de serie sí (el mismo tema), con su día en la misma semana.
  const [enOtras, setEnOtras] = useState<Record<string, boolean>>(() => Object.fromEntries(hermanas.map((h) => [h.course_uuid, true])))
  const [diaOtras, setDiaOtras] = useState<Record<string, string>>({})
  const diaDe = (h: Hermana) => diaOtras[h.course_uuid] || diaEnLaOtraClase(fecha, h)

  const modulos = useMemo(() => getModules(), [])
  const lecciones = useMemo(() => (modulo ? getAllLessonsForModule(modulo) : []), [modulo])
  const partes = useMemo(() => {
    if (!modulo || !leccion) return []
    const tiene = new Set(getLessonSections(modulo, leccion))
    return PARTES.filter((p) => tiene.has(p.id))
  }, [modulo, leccion])

  /** Crea la semana entera en una clase: capítulo, presentación, ejercicios y tarea. */
  async function crearEn(destino: { id: number; org_id: number }, uuidDestino: string, dia: string, quien: string) {
    setPaso(`Creando la semana${quien}…`)
    const capitulo: any = await createChapter(
      { name: tema.trim(), description: '', course_id: destino.id, org_id: destino.org_id },
      token
    )
    if (!capitulo?.id || !capitulo?.chapter_uuid) throw new Error('No se pudo crear el capítulo')

    if (pdf) {
      setPaso(`Subiendo la presentación${quien}…`)
      const act: any = await createFileActivity(pdf, 'documentpdf', { name: 'Presentación' }, capitulo.id, token)
      if (!act?.activity_uuid) throw new Error('No se pudo subir la presentación')
      await updateActivity({ published: true }, act.activity_uuid, token)
    }

    for (const p of partes) {
      setPaso(`Añadiendo ${p.nombre}${quien}…`)
      const act: any = await createActivity(
        {
          name: p.nombre,
          chapter_id: capitulo.id,
          activity_type: 'TYPE_DYNAMIC',
          activity_sub_type: 'SUBTYPE_DYNAMIC_EMBED',
          content: { embed_url: `nawar:${modulo}/${leccion}/${p.id}` },
          published_version: 1,
          version: 1,
          course_id: destino.id,
        },
        capitulo.id,
        destino.org_id,
        token
      )
      if (act?.activity_uuid) await updateActivity({ published: true }, act.activity_uuid, token)
    }

    setPaso(`Guardando la tarea${quien}…`)
    await crearSemana(
      uuidDestino,
      {
        chapter_uuid: capitulo.chapter_uuid,
        tema: tema.trim(),
        fecha: dia,
        enunciado: enunciado.trim(),
        fecha_limite: limite,
        avisar_presentacion: avisarP,
        avisar_grabacion: avisarG,
      },
      token
    )
    await queryClient.invalidateQueries({ queryKey: queryKeys.courses.meta(String(uuidDestino).replace(/^course_/, '')) })
  }

  async function crear() {
    if (!tema.trim()) return toast.error(`Ponle un tema a la ${que}`)
    if (!fecha) return toast.error('Falta el día de la clase')
    if (pdf && !/\.pdf$/i.test(pdf.name)) return toast.error('La presentación tiene que ser un PDF')
    const otras = hermanas.filter((h) => enOtras[h.course_uuid])
    if (otras.some((h) => !diaDe(h))) return toast.error('Falta el día de la clase en la otra clase')
    let hecha = false
    try {
      await crearEn({ id: curso.id, org_id: curso.org_id }, courseUuid, fecha, otras.length ? ' en esta clase' : '')
      hecha = true
      for (const h of otras) {
        try {
          await crearEn({ id: h.id, org_id: h.org_id }, h.course_uuid, diaDe(h), ` en ${h.nombre}`)
        } catch (e: any) {
          toast.error(`En ${h.nombre} no se pudo crear: ${e?.message || 'error'}. Créala desde su página.`)
        }
      }
      revalidateTags(['courses'], orgslug).catch(() => {})
      router.refresh()
      toast.success(otras.length ? `Creada en ${otras.length + 1} clases` : sencilla ? 'Sesión creada' : 'Semana creada')
      onCreada()
    } catch (e: any) {
      toast.error(e?.message || `No se pudo crear la ${que}`)
      if (hecha) onCreada()
    } finally {
      setPaso('')
    }
  }

  return (
    <Ventana titulo={sencilla ? 'Nueva sesión' : 'Nueva semana'} onClose={paso ? () => {} : onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3">
          <div>
            <label className={ETIQUETA}>Tema</label>
            <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="De kleding" className={CAMPO} />
          </div>
          <div>
            <label className={ETIQUETA}>Día de la clase</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
          </div>
        </div>

        <div>
          <label className={ETIQUETA}>Presentación (PDF, opcional)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdf(e.target.files?.[0] || null)}
            className="block w-full text-[13px] text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#F0F5FF] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-[#0b2da0]"
          />
          <p className="mt-1 text-[12px] text-[#6B7280]">Los alumnos la ven en cuanto creas la {que}: súbela antes de la clase.</p>
        </div>

        {sencilla ? null : (
        <>
        <div>
          <label className={ETIQUETA}>Ejercicios de la escuela (opcional)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={modulo} onChange={(e) => { setModulo(e.target.value); setLeccion('') }} className={CAMPO}>
              <option value="">Elige un módulo…</option>
              {modulos.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <select value={leccion} onChange={(e) => setLeccion(e.target.value)} className={CAMPO} disabled={!modulo}>
              <option value="">{modulo ? 'Elige una lección…' : 'Primero el módulo'}</option>
              {lecciones.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>
          {leccion ? (
            <p className="mt-1 text-[12px] text-[#6B7280]">
              {partes.length ? `Se añaden: ${partes.map((p) => p.nombre).join(', ')}.` : 'Esa lección no tiene ejercicios todavía.'}
            </p>
          ) : null}
        </div>

        <div>
          <label className={ETIQUETA}>Tarea para entregar (vacío = esta semana sin tarea)</label>
          <textarea
            value={enunciado}
            onChange={(e) => setEnunciado(e.target.value)}
            rows={4}
            placeholder={ENUNCIADO_EJEMPLO}
            className={CAMPO + ' resize-y'}
          />
          <div className="mt-2 flex items-center gap-2">
            <label className="text-[12px] font-semibold text-[#5A6480]">Entregar hasta</label>
            <input type="date" value={limite} onChange={(e) => setLimite(e.target.value)} className={CAMPO + ' max-w-[170px]'} />
            <span className="text-[12px] text-[#9CA3AF]">{limite ? '' : 'Vacío = el domingo'}</span>
          </div>
        </div>
        </>
        )}

        <CasillasCampana
          presentacion={avisarP}
          grabacion={avisarG}
          onPresentacion={setAvisarP}
          onGrabacion={setAvisarG}
          disabled={!!paso}
        />

        {hermanas.length ? (
          <div className="rounded-lg border border-[#DDE6F5] px-3 py-2.5 space-y-2">
            <p className="text-[12px] font-semibold text-[#5A6480]">El mismo tema en el otro grupo</p>
            {hermanas.map((h) => (
              <div key={h.course_uuid} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <label className="flex items-center gap-2 text-[13.5px] text-gray-900 cursor-pointer flex-1 min-w-[200px]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#0b2da0] shrink-0"
                    checked={!!enOtras[h.course_uuid]}
                    disabled={!!paso}
                    onChange={(e) => setEnOtras((o) => ({ ...o, [h.course_uuid]: e.target.checked }))}
                  />
                  Crearla también en «{h.nombre}»
                </label>
                {enOtras[h.course_uuid] ? (
                  <input
                    type="date"
                    value={diaDe(h)}
                    disabled={!!paso}
                    onChange={(e) => setDiaOtras((o) => ({ ...o, [h.course_uuid]: e.target.value }))}
                    className={CAMPO + ' max-w-[170px]'}
                  />
                ) : null}
              </div>
            ))}
            <p className="text-[11.5px] text-[#6B7280]">
              Misma presentación, ejercicios y tarea. Cada grupo con su día{hermanas[0] && diaDe(hermanas[0]) ? ` (${diaCorto(diaDe(hermanas[0]))})` : ''}, su grabación y sus entregas.
            </p>
          </div>
        ) : null}

        <button
          onClick={crear}
          disabled={!!paso}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0b2da0] py-3 text-[15px] font-bold text-white hover:bg-[#0a2690] disabled:opacity-60"
        >
          {paso ? (
            <>
              <Loader2 size={16} className="animate-spin" /> {paso}
            </>
          ) : sencilla ? (
            'Crear la sesión'
          ) : (
            'Crear semana'
          )}
        </button>
      </div>
    </Ventana>
  )
}

export function EditarSemana({
  semana,
  onClose,
  onGuardada,
  puedeQuitar = true,
}: {
  semana: Semana
  onClose: () => void
  onGuardada: () => void
  /** Quitar la semana borra la tarea y las entregas: solo administradores. */
  puedeQuitar?: boolean
}) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [tema, setTema] = useState(semana.tema)
  const [fecha, setFecha] = useState(semana.fecha)
  const [enunciado, setEnunciado] = useState(semana.enunciado)
  const [limite, setLimite] = useState(semana.fecha_limite)
  const [avisarP, setAvisarP] = useState(semana.avisar_presentacion ?? true)
  const [avisarG, setAvisarG] = useState(semana.avisar_grabacion ?? false)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      await editarSemana(
        semana.id,
        { tema, fecha, enunciado, fecha_limite: limite, avisar_presentacion: avisarP, avisar_grabacion: avisarG },
        token
      )
      toast.success('Semana guardada')
      onGuardada()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function quitar() {
    const ok = await confirmar(
      `¿Dejar de tratar «${semana.tema}» como semana? Se borran su tarea y las entregas de los alumnos. El capítulo y sus clases se quedan en el curso.`,
      { boton: 'Quitar la semana' }
    )
    if (!ok) return
    try {
      await borrarSemana(semana.id, token)
      toast.success('Ya no es una semana')
      onGuardada()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo quitar')
    }
  }

  return (
    <Ventana titulo="Editar semana" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3">
          <div>
            <label className={ETIQUETA}>Tema</label>
            <input value={tema} onChange={(e) => setTema(e.target.value)} className={CAMPO} />
          </div>
          <div>
            <label className={ETIQUETA}>Día de la clase</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
          </div>
        </div>
        <div>
          <label className={ETIQUETA}>Tarea (vacío = sin tarea)</label>
          <textarea value={enunciado} onChange={(e) => setEnunciado(e.target.value)} rows={4} placeholder={ENUNCIADO_EJEMPLO} className={CAMPO + ' resize-y'} />
          <div className="mt-2 flex items-center gap-2">
            <label className="text-[12px] font-semibold text-[#5A6480]">Entregar hasta</label>
            <input type="date" value={limite} onChange={(e) => setLimite(e.target.value)} className={CAMPO + ' max-w-[170px]'} />
            <span className="text-[12px] text-[#9CA3AF]">{limite ? '' : 'Vacío = el domingo'}</span>
          </div>
        </div>
        <CasillasCampana presentacion={avisarP} grabacion={avisarG} onPresentacion={setAvisarP} onGrabacion={setAvisarG} />
        <p className="text-[12px] text-[#6B7280]">
          La presentación, la grabación y los ejercicios se cambian en el editor del curso («Añadir clases»).
        </p>
        <div className="flex items-center justify-between gap-3">
          {puedeQuitar ? (
            <button onClick={quitar} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#B91C1C] hover:underline">
              <Trash2 size={14} /> Quitar la semana
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0b2da0] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#0a2690] disabled:opacity-60"
          >
            {guardando ? <Loader2 size={15} className="animate-spin" /> : null} Guardar
          </button>
        </div>
      </div>
    </Ventana>
  )
}
