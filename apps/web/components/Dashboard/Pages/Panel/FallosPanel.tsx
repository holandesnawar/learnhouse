'use client'

/**
 * Panel → Formación → «Fallos avisados» (23/11/2026).
 *
 * Lo que los alumnos avisan con «¿Ves un fallo? Avísanos» de cada ejercicio,
 * **agrupado por ejercicio** (lo que importa es el ejercicio, no cada aviso):
 * la lección, lo que se veía, la respuesta que la escuela da por buena y lo
 * que dice cada alumno. «Copiar» saca un texto listo para pasárselo a quien
 * lo arregla (el contenido vive en `courseData.ts`, no se corrige aquí).
 * «Arreglado» / «No era un fallo» los cierran (solo administradores); si otro
 * alumno avisa después del mismo ejercicio, vuelve arriba.
 *
 * El servidor, en apps/api/src/services/ejercicios/avisos.py.
 */

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Check, Copy, Loader2, RotateCcw, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { cerrarFallo, listarFallos, type ListaDeFallos } from '@services/ejercicios/fallos'
import { cuantosAlumnos, nombreDeTipo, textoParaCopiar, type GrupoDeFallos } from '@/lib/nawar/fallosEjercicios'
import { haceCuanto } from '@/lib/nawar/haceCuanto'
import { BOTON, BOTON_PRINCIPAL, BOTON_TEXTO, ENLACE, Estado, Meta, Plegable, Seccion } from './ui'

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success('Copiado. Pégaselo a quien lo arregla.')
  } catch {
    toast.error('No se ha podido copiar')
  }
}

function Dato({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-[13.5px] leading-snug">
      <span className="w-[108px] shrink-0 text-[#8A93A3]">{nombre}</span>
      <span className="min-w-0 text-[#0B1020] break-words">{children}</span>
    </div>
  )
}

function Ejercicio({
  g,
  admin,
  orgslug,
  ocupado,
  onCerrar,
}: {
  g: GrupoDeFallos
  admin: boolean
  orgslug: string
  ocupado: boolean
  onCerrar: (g: GrupoDeFallos, estado: 'arreglado' | 'no-era' | 'nuevo') => void
}) {
  const d = g.datos || {}
  const abierto = g.estado === 'nuevo'
  return (
    <article className="py-5 border-b border-[#F0F1F5] last:border-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#0B1020] leading-snug">{d.enunciado || 'Ejercicio sin enunciado'}</h3>
          <Meta
            className="mt-1"
            partes={[
              [d.modulo, d.leccion].filter(Boolean).join(' · ') || g.lesson_id,
              d.tipo ? nombreDeTipo(d.tipo) : '',
              <span key="id" className="font-mono text-[12px]">
                {g.exercise_id}
              </span>,
            ]}
          />
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {abierto ? (
            <Estado tono="ambar">
              {cuantosAlumnos(g.abiertos)} · {haceCuanto(g.ultimo)}
            </Estado>
          ) : (
            <Estado tono={g.estado === 'arreglado' ? 'verde' : 'gris'}>
              {g.estado === 'arreglado' ? 'Arreglado' : 'No era un fallo'}
              {g.cerrado_por ? ` · ${g.cerrado_por}` : ''}
            </Estado>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {d.enunciado_nl ? <Dato nombre="En neerlandés">{d.enunciado_nl}</Dato> : null}
        {d.opciones?.length ? <Dato nombre="Opciones">{d.opciones.join('  ·  ')}</Dato> : null}
        {d.parejas?.length ? <Dato nombre="Parejas">{d.parejas.map((p) => `${p.izquierda} = ${p.derecha}`).join('  ·  ')}</Dato> : null}
        {d.correcta ? (
          <Dato nombre="Da por buena">
            <span className="font-semibold">{d.correcta}</span>
            {d.tambien?.length ? <span className="text-[#6B7384]"> (también: {d.tambien.join(', ')})</span> : null}
          </Dato>
        ) : null}
      </div>

      <ul className="mt-3 space-y-2">
        {g.avisos.map((a, i) => (
          <li key={i} className="text-[13.5px] leading-snug text-[#0B1020]">
            <span className="font-medium">{a.nombre}</span>
            <span className="text-[#C5CAD6]"> · </span>
            <span className="text-[#4B5565]">{a.motivo_texto}</span>
            {a.respuesta_alumno ? (
              <>
                <span className="text-[#C5CAD6]"> · </span>
                <span className="text-[#4B5565]">contestó «{a.respuesta_alumno}»</span>
              </>
            ) : null}
            {a.comentario ? <p className="mt-0.5 text-[#0B1020] whitespace-pre-line">«{a.comentario}»</p> : null}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <button className={BOTON} onClick={() => copiar(textoParaCopiar(g))}>
          <Copy size={14} /> Copiar
        </button>
        {admin && abierto ? (
          <>
            <button className={BOTON_PRINCIPAL} disabled={ocupado} onClick={() => onCerrar(g, 'arreglado')}>
              <Check size={14} /> Arreglado
            </button>
            <button className={BOTON} disabled={ocupado} onClick={() => onCerrar(g, 'no-era')}>
              <X size={14} /> No era un fallo
            </button>
          </>
        ) : null}
        {admin && !abierto ? (
          <button className={BOTON_TEXTO} disabled={ocupado} onClick={() => onCerrar(g, 'nuevo')}>
            <RotateCcw size={14} /> Volver a abrir
          </button>
        ) : null}
        {g.lesson_id ? (
          <Link href={getUriWithOrg(orgslug, `/leccion/${g.lesson_id}`)} target="_blank" className={`${ENLACE} ml-1`}>
            Abrir la lección
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export default function FallosPanel() {
  const session = useLHSession() as any
  const org = useOrg() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [datos, setDatos] = useState<ListaDeFallos | null>(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState('')

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    const r = await listarFallos(org.id, token)
    if (r.ok) {
      setDatos(r.datos)
      setError('')
    } else setError(r.error)
  }, [org?.id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  const cerrar = async (g: GrupoDeFallos, estado: 'arreglado' | 'no-era' | 'nuevo') => {
    setOcupado(g.exercise_id)
    const r = await cerrarFallo(org.id, g, estado, token)
    setOcupado('')
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    toast.success(estado === 'arreglado' ? 'Marcado como arreglado' : estado === 'no-era' ? 'Cerrado: no era un fallo' : 'Abierto otra vez')
    cargar()
  }

  if (error) return <p className="text-[14px] text-[#4B5565]">{error}</p>
  if (!datos)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )

  const alumnos = datos.abiertos.reduce((n, g) => n + g.abiertos, 0)

  return (
    <div className="space-y-10">
      <Seccion
        titulo={datos.abiertos.length ? `Por mirar · ${datos.abiertos.length} ${datos.abiertos.length === 1 ? 'ejercicio' : 'ejercicios'}` : 'Por mirar'}
        nota={
          datos.abiertos.length
            ? `${alumnos === 1 ? 'Un aviso' : `${alumnos} avisos`} de los alumnos. Arriba, los ejercicios de los que avisa más gente.`
            : undefined
        }
        filete
        junto
      >
        {datos.abiertos.length ? (
          datos.abiertos.map((g) => (
            <Ejercicio key={`${g.lesson_id}|${g.exercise_id}`} g={g} admin={datos.admin} orgslug={org?.slug} ocupado={ocupado === g.exercise_id} onCerrar={cerrar} />
          ))
        ) : (
          <p className="py-6 text-[14px] text-[#4B5565]">
            Nadie ha avisado de ningún fallo. Los alumnos tienen el enlace «¿Ves un fallo? Avísanos» debajo de cada ejercicio de las lecciones.
          </p>
        )}
      </Seccion>

      {datos.cerrados.length ? (
        <Plegable titulo="Ya cerrados" cifra={datos.cerrados.length} recordarComo="fallos-cerrados" resumen="Arreglados o que no eran un fallo">
          <div>
            {datos.cerrados.map((g) => (
              <Ejercicio key={`${g.lesson_id}|${g.exercise_id}`} g={g} admin={datos.admin} orgslug={org?.slug} ocupado={ocupado === g.exercise_id} onCerrar={cerrar} />
            ))}
          </div>
        </Plegable>
      ) : null}
    </div>
  )
}
