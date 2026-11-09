'use client'
/**
 * La sala de profes (08/11/2026, rama diseno): el Inicio del equipo de clases.
 *
 * Segunda vuelta, el mismo día: "el profe, su única tarea es preparar la clase
 * y darla: eso es lo que tiene que salir bien… y ver de forma fácil el archivo
 * de clases, y poco más… si al profe le toca esa semana x grupo y x clase, que
 * solo vea eso… simple pero útil". Por eso solo hay tres pestañas (`?vista=`):
 *
 * - **Mis clases**: cada clase que da (la del recuadro de la clase con su
 *   nombre) con su semana de esta semana, en pasos: presentación → dar la clase
 *   → pasar lista → grabación → corregir. Y una línea con la semana que viene.
 *   Si la semana aún no existe, «Crear la semana». El administrador ve todas;
 *   el profe, las suyas (con «Ver todas» si quiere).
 * - **Archivo**: todas las clases dadas, mes a mes, con quién la dio.
 * - **Manual**: los SOP (no al monitor).
 *
 * El monitor (grupo «Monitores», `services/equipo/monitores.py`) solo tiene el
 * Spreekclub: el servidor ya le da solo esas clases.
 *
 * Lo demás (seguimiento, consultas, clases y grupos) va como enlaces pequeños
 * abajo, no en la barra de la escuela.
 */
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import AvatarPersona from '@components/Objects/Persona/AvatarPersona'
import { getUriWithOrg } from '@services/config/config'
import { mediaSrc } from '@services/messages/direct'
import { getSalaProfes, type DocManual, type Miembro } from '@services/equipo/equipo'
import { PasarLista } from '@components/Pages/Profes/ListaYGrupo'
import { esDe } from '@/lib/nawar/clasesProfes'
import { paraPreparar, type SemanaEquipo } from '@/lib/nawar/salaProfes'
import TarjetaPreparar, { EditarSemanaProfe } from './PrepararClase'
import useClasesEquipo, { type ClaseEquipo } from './useClasesEquipo'
import ArchivoClases from './ArchivoClases'
import ManualEquipo from './ManualEquipo'
import { POPPINS } from './estilo'

type Vista = 'clases' | 'archivo' | 'manual'

const TARJETA = 'rounded-2xl border border-[#E4E8F2] bg-white'

function MisClases({
  clases,
  semanas,
  hoy,
  ruta,
  miNombre,
  admin,
  monitor,
  recargar,
  token,
}: {
  clases: ClaseEquipo[]
  semanas: SemanaEquipo[] | null
  hoy: string
  ruta: (p: string) => string
  miNombre: string
  admin: boolean
  monitor: boolean
  recargar: () => void
  token: string
}) {
  const mias = clases.filter((c) => esDe(c.profe, miNombre))
  // El profe ve las suyas; si no tiene ninguna a su nombre (o es administrador o
  // monitor), todas las que le tocan ver.
  const [todas, setTodas] = useState(false)
  const soloMias = !admin && !monitor && mias.length > 0 && !todas
  const visibles = soloMias ? mias : clases
  const [lista, setLista] = useState<SemanaEquipo | null>(null)
  const [editar, setEditar] = useState<SemanaEquipo | null>(null)

  if (semanas === null) return <div className={`${TARJETA} px-5 py-6 text-[14px] text-[#6B7393]`}>Cargando tus clases…</div>
  if (!clases.length)
    return (
      <div className={`${TARJETA} px-5 py-6 text-[14.5px] text-[#3B4262]`}>
        Todavía no hay clases en directo{monitor ? ' del Spreekclub' : ''}.
      </div>
    )
  const filas = paraPreparar(visibles, semanas, hoy)

  return (
    <div className="space-y-4">
      {!admin && !monitor && mias.length === 0 ? (
        <p className="text-[13.5px] text-[#5B6382]">
          Ninguna clase lleva tu nombre en «La da», así que ves todas. Pide que te pongan en tus clases.
        </p>
      ) : null}
      {!admin && !monitor && mias.length > 0 && mias.length < clases.length ? (
        <div className="flex gap-1.5">
          {[
            [false, `Mis clases · ${mias.length}`],
            [true, `Todas · ${clases.length}`],
          ].map(([v, t]) => (
            <button
              key={String(v)}
              onClick={() => setTodas(v as boolean)}
              className={`h-8 px-3 rounded-full text-[13px] font-semibold border ${
                todas === v ? 'bg-[#0b2da0] border-[#0b2da0] text-white' : 'bg-white border-[#DDE3EF] text-[#3B4262]'
              }`}
            >
              {t as string}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {filas.map((f) => (
          <TarjetaPreparar
            key={f.clase.uuid}
            fila={f}
            hoy={hoy}
            ruta={ruta}
            token={token}
            puedeEditar
            onLista={setLista}
            onEditar={setEditar}
          />
        ))}
      </div>
      {editar ? (
        <EditarSemanaProfe
          semana={editar}
          token={token}
          onCerrar={() => setEditar(null)}
          onGuardada={() => {
            setEditar(null)
            recargar()
          }}
        />
      ) : null}
      {lista ? (
        <PasarLista
          semanaId={lista.semanaId}
          tema={lista.tema}
          curso={lista.curso}
          token={token}
          onCerrar={() => setLista(null)}
          onGuardada={() => {
            setLista(null)
            recargar()
          }}
        />
      ) : null}
    </div>
  )
}

export default function SalaProfes() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const orgslug: string = org?.slug || ''
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [manual, setManual] = useState<DocManual[]>([])
  const [yo, setYo] = useState<{ id: number; admin: boolean; monitor?: boolean }>({ id: 0, admin: false })
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState('')
  const [docAbrir, setDocAbrir] = useState<number | null>(null)
  const { clases, semanas, hoy, recargar } = useClasesEquipo(org, token)

  const monitor = !!yo.monitor
  const vistas: { id: Vista; titulo: string }[] = [
    { id: 'clases', titulo: 'Mis clases' },
    { id: 'archivo', titulo: 'Archivo' },
    ...(monitor ? [] : [{ id: 'manual' as Vista, titulo: 'Manual' }]),
  ]
  const pedida = (params?.get('vista') || 'clases') as Vista
  const vista: Vista = vistas.some((v) => v.id === pedida) ? pedida : 'clases'

  useEffect(() => {
    window.dispatchEvent(new Event('nawar-vista'))
  }, [vista])

  useEffect(() => {
    if (!org?.id || !token) return
    getSalaProfes(org.id, token)
      .then((d) => {
        setMiembros(d.miembros)
        setManual(d.manual)
        setYo(d.yo)
        setCargado(true)
      })
      .catch((e) => setError(e?.message || 'No se ha podido cargar la sala de profes'))
  }, [org?.id, token])

  const ruta = (p: string) => getUriWithOrg(orgslug, p)
  const irA = (v: Vista, doc?: number) => {
    setDocAbrir(doc ?? null)
    const q = new URLSearchParams(params?.toString() || '')
    if (v === 'clases') q.delete('vista')
    else q.set('vista', v)
    const s = q.toString()
    router.replace(`${pathname}${s ? `?${s}` : ''}`, { scroll: false })
  }

  const u = session?.data?.user || {}
  const nombre = u.first_name || u.username || ''
  const hora = new Date().getHours()
  const saludo = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header>
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Sala de profesores</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-[26px] sm:text-[30px] font-bold text-[#0B1033] tracking-tight leading-tight" style={POPPINS}>
              {saludo}
              {nombre ? `, ${nombre}` : ''}
            </h1>
            <p className="mt-1 text-[14.5px] text-[#5B6382]">
              {monitor ? 'Tu Spreekclub: prepara la sesión y dala.' : 'Tus clases de esta semana: prepáralas y dalas.'}
            </p>
          </div>
          {miembros.length ? (
            <div className="ml-auto flex items-center gap-2.5">
              <div className="flex -space-x-2">
                {miembros.slice(0, 6).map((m) => (
                  <span key={m.id} className="rounded-full ring-2 ring-white" title={`${m.nombre} · ${m.rol}`}>
                    <AvatarPersona nombre={m.nombre} src={m.avatar ? mediaSrc(m.avatar) : null} size={32} />
                  </span>
                ))}
              </div>
              <span className="text-[13px] text-[#5B6382]">El equipo · {miembros.length}</span>
            </div>
          ) : null}
        </div>
        <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-[#E4E8F2] -mx-4 px-4 sm:mx-0 sm:px-0">
          {vistas.map((v) => (
            <button
              key={v.id}
              onClick={() => irA(v.id)}
              className={`shrink-0 h-10 px-3 text-[14px] font-semibold border-b-2 -mb-px transition-colors ${
                vista === v.id ? 'border-[#0b2da0] text-[#0b2da0]' : 'border-transparent text-[#5B6382] hover:text-[#0B1033]'
              }`}
            >
              {v.titulo}
            </button>
          ))}
        </nav>
      </header>

      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</p> : null}

      <div className="mt-6">
        {vista === 'clases' ? (
          <MisClases
            clases={clases}
            semanas={cargado ? semanas : null}
            hoy={hoy}
            ruta={ruta}
            miNombre={nombre}
            admin={yo.admin}
            monitor={monitor}
            recargar={recargar}
            token={token}
          />
        ) : vista === 'archivo' ? (
          semanas === null ? (
            <p className="text-[14px] text-[#6B7393]">Cargando las clases…</p>
          ) : (
            <ArchivoClases orgslug={orgslug} semanas={semanas} clases={clases} hoy={hoy} token={token} />
          )
        ) : (
          <ManualEquipo key={docAbrir ?? 'm'} orgId={org?.id} token={token} manual={manual} setManual={setManual} admin={yo.admin} abrir={docAbrir} />
        )}
      </div>

      {/* Lo demás que hace el equipo, sin llenar la barra de la escuela. */}
      {!monitor && cargado ? (
        <footer className="mt-10 pt-5 border-t border-[#E4E8F2] flex flex-wrap gap-x-5 gap-y-2 text-[13.5px]">
          <span className="text-[#6B7393]">También:</span>
          <Link href={ruta('/seguimiento')} className="font-semibold text-[#0b2da0] hover:underline">
            Seguimiento de alumnos
          </Link>
          <Link href={ruta('/responder-consultas')} className="font-semibold text-[#0b2da0] hover:underline">
            Responder consultas
          </Link>
          <Link href={ruta('/organizar')} className="font-semibold text-[#0b2da0] hover:underline">
            Clases y grupos
          </Link>
        </footer>
      ) : null}
    </div>
  )
}
