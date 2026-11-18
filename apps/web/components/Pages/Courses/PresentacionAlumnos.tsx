'use client'
/**
 * La presentación de los alumnos de UNA clase (un grupo), dicha clara
 * (18/11/2026).
 *
 * Usuario: "si el lunes se da la clase, que la profe al terminar le dé a
 * guardar y el alumno vea en su grupo del lunes su presentación ya editada…
 * pero si se va al grupo del miércoles, todavía no se vea y se vea la
 * presentación anterior… y si quiero cambiar la presentación en la semana que
 * estamos, que me deje, porque ahora en «Editar semana» solo puedo cambiar el
 * título".
 *
 * Cada grupo ve UNA sola presentación en su semana:
 * 1. **Antes de la clase**: el PDF que se sube aquí (una clase PDF del
 *    capítulo de la semana).
 * 2. **Después de la clase**: en cuanto el profe de ESE grupo pulsa «Guardar
 *    para los alumnos» en la pizarra, la versión de la clase sustituye a la de
 *    antes (`pasosDeSemana`). El otro grupo sigue con la suya.
 *
 * «Cambiar el PDF» sube el nuevo, lo publica y deja SIN PUBLICAR el de antes
 * (no se borra: un profe no puede borrar clases y así se puede deshacer en el
 * editor del curso). Con la casilla, lo mismo en la clase del otro grupo de
 * esa semana; nace marcada si allí aún no ha habido clase.
 */
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Check, FileText, Loader2, UploadCloud } from 'lucide-react'
import { createFileActivity, updateActivity } from '@services/courses/activities'
import { diaCorto, getGemela, type Gemela } from '@services/tareas/tareas'
import { VisorPresentacionClase } from '@components/Pages/Clases/pasosSemana'

type Pres = { activity_uuid: string; nombre: string }

export interface PropsPresentacion {
  semanaId: number
  chapterId?: number | null
  courseUuid: string
  fecha: string
  hoy: string
  presentaciones: Pres[]
  /** Cuándo guardó el profe la pizarra para los alumnos ('' si no). */
  publicadaAt?: string
  paginas?: number
  token: string
  ruta?: (p: string) => string
  onCambio?: () => void
}

const BOTON =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#E2E7F0] bg-white px-3 text-[13px] font-semibold text-[#0B1033] transition-colors hover:border-[#C9D3E6] hover:bg-[#F7F9FD] disabled:opacity-50'

export async function ponerPresentacion(f: File, chapterId: number, viejas: Pres[], token: string) {
  const act: any = await createFileActivity(f, 'documentpdf', { name: 'Presentación' }, chapterId, token)
  if (!act?.activity_uuid) throw new Error('No se ha podido subir la presentación')
  await updateActivity({ published: true }, act.activity_uuid, token)
  for (const v of viejas) {
    if (v.activity_uuid && v.activity_uuid !== act.activity_uuid) await updateActivity({ published: false }, v.activity_uuid, token)
  }
  return act.activity_uuid as string
}

export default function PresentacionAlumnos(p: PropsPresentacion) {
  const [pres, setPres] = useState<Pres[]>(p.presentaciones)
  const [gemela, setGemela] = useState<Gemela | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [tambien, setTambien] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [viendo, setViendo] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const confirmacion = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (archivo) confirmacion.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [archivo])
  const ruta = p.ruta || ((x: string) => x)
  const uuid = p.courseUuid.replace(/^course_/, '')

  useEffect(() => setPres(p.presentaciones), [p.presentaciones])
  useEffect(() => {
    let vivo = true
    getGemela(p.semanaId, p.token)
      .then((r) => vivo && setGemela(r.gemela))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [p.semanaId, p.token])

  const yaFue = !!p.fecha && p.fecha <= p.hoy
  const conVersion = !!p.publicadaAt
  const ahoraVen: 'antes' | 'despues' | 'nada' = conVersion && yaFue ? 'despues' : pres.length ? 'antes' : 'nada'
  const gemelaUtil = !!gemela?.chapter_id

  const elegir = (f?: File | null) => {
    if (!f) return
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') return toast.error('Tiene que ser un PDF')
    setArchivo(f)
    // Allí aún no ha habido clase (ni tiene su versión): lo normal es cambiarla también.
    setTambien(gemelaUtil && !gemela?.pasada && !gemela?.hoy && !gemela?.con_notas)
    if (entrada.current) entrada.current.value = ''
  }

  const confirmar = async () => {
    if (!archivo || !p.chapterId) return
    setSubiendo(true)
    try {
      const nueva = await ponerPresentacion(archivo, p.chapterId, pres, p.token)
      setPres([{ activity_uuid: nueva, nombre: 'Presentación' }])
      if (tambien && gemela?.chapter_id) {
        try {
          await ponerPresentacion(archivo, gemela.chapter_id, gemela.presentaciones || [], p.token)
        } catch (e: any) {
          toast.error(`Cambiada aquí, pero no en ${gemela.curso}: ${e?.message || 'vuelve a intentarlo'}`)
        }
      }
      toast.success(tambien && gemela ? 'Presentación cambiada en los dos grupos' : 'Presentación cambiada en este grupo')
      setArchivo(null)
      p.onCambio?.()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido subir')
    } finally {
      setSubiendo(false)
    }
  }

  const actividad = (a: Pres) => ruta(`/course/${uuid}/activity/${a.activity_uuid.replace('activity_', '')}`)

  return (
    <div className="rounded-xl border border-[#E6EAF2] bg-white">
      <ol className="relative">
        {/* La raya que une los dos momentos */}
        <span aria-hidden className="absolute left-[27px] top-[38px] bottom-[38px] w-px bg-[#E6EAF2]" />
        <Momento
          activo={ahoraVen === 'antes'}
          hecho={pres.length > 0}
          titulo="Antes de la clase"
          detalle={
            pres.length
              ? `${pres.length > 1 ? `${pres.length} PDF` : 'Un PDF'} para llegar con el tema visto`
              : 'Sin presentación. Opcional: un PDF que miran antes de venir.'
          }
          acciones={
            <>
              {pres[0] ? (
                <Link href={actividad(pres[0])} target="_blank" className={BOTON}>
                  Ver
                </Link>
              ) : null}
              {p.chapterId ? (
                <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo} className={BOTON}>
                  {pres.length ? 'Cambiar el PDF' : 'Subir PDF'}
                </button>
              ) : null}
            </>
          }
        />
        <Momento
          activo={ahoraVen === 'despues'}
          hecho={conVersion}
          titulo="Después de la clase"
          detalle={
            conVersion
              ? `La versión de la clase, con lo que se escribió en la pizarra${p.paginas ? ` · ${p.paginas} páginas` : ''}${p.publicadaAt ? ` · guardada el ${diaCorto(p.publicadaAt.slice(0, 10))}` : ''}`
              : 'Al terminar, el profe pulsa «Guardar para los alumnos» en la pizarra y este grupo pasa a ver esa versión. El otro grupo sigue con la de antes hasta su clase.'
          }
          acciones={
            conVersion ? (
              <button type="button" onClick={() => setViendo(true)} className={BOTON}>
                Ver
              </button>
            ) : null
          }
        />
      </ol>

      {archivo ? (
        <div ref={confirmacion} className="border-t border-[#E6EAF2] bg-[#FAFBFD] px-4 py-3.5 sm:px-5">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[#0B1033]">
            <FileText size={15} className="shrink-0 text-[#0b2da0]" />
            <span className="min-w-0 truncate">{archivo.name}</span>
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#6B7393]">
            Sustituye a la de antes de la clase en este grupo. La de antes no se borra: se deja de enseñar.
          </p>
          {gemelaUtil ? (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={tambien} onChange={(e) => setTambien(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0b2da0]" />
              <span className="text-[13px] leading-snug text-[#2B3150]">
                <span className="font-semibold text-[#0B1033]">Cambiarla también en {gemela!.curso}</span>
                <span className="block text-[12.5px] text-[#6B7393]">
                  {gemela!.pasada || gemela!.hoy
                    ? `Ese grupo ya tuvo su clase (${diaCorto(gemela!.fecha)})${gemela!.con_notas ? ' y ve la versión de su clase' : ''}: normalmente, déjala como está.`
                    : `Su clase es el ${diaCorto(gemela!.fecha)}: aún no ha empezado.`}
                </span>
              </span>
            </label>
          ) : null}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setArchivo(null)} disabled={subiendo} className="h-9 rounded-lg px-3 text-[13.5px] font-semibold text-[#3B4262] hover:bg-white">
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={subiendo}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0b2da0] px-4 text-[13.5px] font-semibold text-white hover:bg-[#0a2690] disabled:opacity-60"
            >
              {subiendo ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              {subiendo ? 'Subiendo…' : tambien ? 'Cambiar en los dos grupos' : 'Cambiar en este grupo'}
            </button>
          </div>
        </div>
      ) : null}
      <input ref={entrada} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
      {viendo ? <VisorPresentacionClase semanaId={p.semanaId} titulo="La versión de la clase" onClose={() => setViendo(false)} /> : null}
    </div>
  )
}

function Momento({ activo, hecho, titulo, detalle, acciones }: { activo: boolean; hecho: boolean; titulo: string; detalle: string; acciones?: React.ReactNode }) {
  return (
    <li className="relative flex items-start gap-3.5 px-4 py-3.5 sm:px-5">
      <span
        className={`relative z-[1] mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 bg-white ${
          hecho ? 'border-[#16A34A] text-[#16A34A]' : 'border-[#C9D1E3]'
        }`}
      >
        {hecho ? <Check size={12} strokeWidth={3.4} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14.5px] font-semibold text-[#0B1033]">
          {titulo}
          {activo ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#15803D]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" /> Es la que ven ahora
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#6B7393]">{detalle}</p>
      </div>
      {acciones ? <div className="flex shrink-0 flex-wrap justify-end gap-1.5">{acciones}</div> : null}
    </li>
  )
}
