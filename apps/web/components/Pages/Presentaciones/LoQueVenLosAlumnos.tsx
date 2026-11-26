'use client'
/**
 * «Lo que ven los alumnos de este grupo», dicho en dos líneas (26/11/2026).
 *
 * Usuario, con la semana de Groep blauw delante: «¿cómo veo la presentación
 * final que está subida? No sé cuál es, si la de repaso, si la final, si tiene
 * notas o no… quiero cambiarla por la final, que es un archivo nuevo, y no sé
 * cómo. Tiene que ser fácil y obvio».
 *
 * Arriba de las presentaciones de la semana (y en la ficha de la clase), sin
 * nada más:
 * - **Antes de la clase** ven: el PDF de los alumnos (o nada).
 * - **Desde el día de la clase** ven: la versión final subida a mano, o la de
 *   la pizarra con lo escrito (y también sin notas), o la de antes si no hay
 *   ninguna.
 * Con «Ver lo que ven» (la misma página que ellos) y **«Subir la versión
 * final (PDF)»**: el archivo, tal cual, pasa a ser lo que ven desde el día de
 * la clase (`subirVersionFinal`, `final=1` en apps/api/src/routers/pizarra.py).
 * Solo en ESTE grupo: el otro sigue con lo suyo.
 */
import React, { useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Eye, Loader2, UploadCloud } from 'lucide-react'
import { confirmar } from '@/lib/nawar/confirmar'
import { subirVersionFinal, type ListaPresentaciones as Lista } from '@services/pizarra/pizarra'

function fecha(at: string): string {
  if (!at) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).replace('.', '')
}

export function queVenDespues(lista: Lista | null): { texto: string; final: boolean } {
  const pub = lista?.publicada
  if (!pub) return { texto: '', final: false }
  const cuando = [fecha(pub.at) ? `el ${fecha(pub.at)}` : '', pub.por ? `por ${pub.por.split(' ')[0]}` : ''].filter(Boolean).join(' ')
  if (pub.fuente === 'final')
    return { texto: `«${pub.nombre || 'Presentación final'}», la versión final${cuando ? ` (subida ${cuando})` : ''}`, final: true }
  return {
    texto: `«${pub.nombre || 'La presentación'}» con lo escrito en la pizarra${cuando ? ` (guardada ${cuando})` : ''}${pub.limpia ? ', y también sin notas' : ''}`,
    final: false,
  }
}

export default function LoQueVenLosAlumnos({
  semanaId,
  fecha: diaClase,
  hoy,
  lista,
  token,
  ruta,
  onCambio,
  palabra = (t) => t,
}: {
  semanaId: number
  fecha: string
  hoy: string
  lista: Lista | null
  token: string
  ruta: (p: string) => string
  onCambio: () => void
  palabra?: (t: string) => string
}) {
  const [subiendo, setSubiendo] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const antes = (lista?.presentaciones || []).find((x) => x.de === 'alumnos')
  const despues = queVenDespues(lista)
  const yaFue = !!diaClase && !!hoy && diaClase <= hoy

  const elegido = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
      toast.error('Tiene que ser un PDF. En PowerPoint, Keynote o Canva: Exportar → PDF.')
      return
    }
    const ok = await confirmar(
      palabra(
        `«${f.name}» será lo que ven los alumnos de este grupo desde el día de la clase${despues.texto ? `, en lugar de ${despues.texto}` : ''}. Una sola versión, tal cual. El otro grupo no cambia.`
      ),
      { boton: 'Subir la versión final', peligro: false }
    )
    if (!ok) return
    setSubiendo(true)
    try {
      await subirVersionFinal(semanaId, f, token)
      toast.success(yaFue ? 'Listo: los alumnos ya ven la versión final.' : 'Listo: la verán desde el día de la clase.')
      onCambio()
    } catch (err: any) {
      toast.error(err?.message || 'No se ha podido subir')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#DCE4F5] bg-[#F7F9FE] px-4 py-3.5">
      <p className="text-[14.5px] font-semibold text-[#0B1033]">Lo que ven los alumnos de este grupo</p>
      <dl className="mt-2 space-y-1.5 text-[13.5px] leading-snug">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className={`w-[168px] shrink-0 ${yaFue ? 'text-[#8A93A3]' : 'font-semibold text-[#0B1033]'}`}>{palabra('Antes de la clase')}</dt>
          <dd className={yaFue ? 'text-[#6B7393]' : 'text-[#0B1033]'}>{antes ? `«${antes.nombre}»` : 'Nada todavía'}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className={`w-[168px] shrink-0 ${yaFue ? 'font-semibold text-[#0B1033]' : 'text-[#8A93A3]'}`}>{palabra('Desde el día de la clase')}</dt>
          <dd className={yaFue ? 'text-[#0B1033]' : 'text-[#6B7393]'}>
            {despues.texto || (antes ? 'La misma de antes (aún no hay versión final ni nada guardado desde la pizarra)' : 'Nada todavía')}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={ruta(`/presentacion/${semanaId}`)}
          prefetch={false}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E7F0] bg-white px-3.5 text-[13.5px] font-semibold text-[#0B1033] hover:bg-[#F7F9FD]"
        >
          <Eye size={15} /> Ver lo que ven
        </Link>
        <input ref={entrada} type="file" accept="application/pdf,.pdf" className="hidden" onChange={elegido} />
        <button
          onClick={() => entrada.current?.click()}
          disabled={subiendo}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0b2da0] px-3.5 text-[13.5px] font-semibold text-white hover:bg-[#0a2690] disabled:opacity-60"
        >
          {subiendo ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
          {despues.final ? 'Cambiar la versión final (PDF)' : 'Subir la versión final (PDF)'}
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-[#6B7393]">
        {palabra('La versión final sustituye a lo de la pizarra para los alumnos de este grupo, desde el día de la clase. Si después guardas otra vez desde la pizarra, vuelve a mandar la pizarra.')}
      </p>
    </div>
  )
}
