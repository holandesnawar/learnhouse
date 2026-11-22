'use client'
/**
 * La pestaña «Presentaciones» de la sala de profesores (22/11/2026).
 *
 * Usuario: «nadie sabemos dónde están las presentaciones ni cuál está en
 * pizarra». Aquí está, para todas las clases a la vez: qué presentación tiene
 * cada una, cuál abre la pizarra, si tiene notas y qué ven los alumnos. Arriba,
 * «Para revisar»: clases que están al caer sin presentación, notas que los
 * alumnos no tienen, notas de una presentación que ya no está y notas escritas
 * en una que no es la de la pizarra.
 *
 * No edita nada: «Pizarra» abre la pizarra de esa clase y «Ficha», su ficha en
 * la parte de Presentaciones, que es donde se sube, se cambia y se pasan
 * notas. El administrador ve todas; el profe, «Las mías / Todas»; el monitor,
 * su Spreekclub (el servidor ya le da solo esas clases).
 *
 * La lógica, sin pantalla, en `lib/nawar/presentacionesEquipo.ts`.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { esDe } from '@/lib/nawar/clasesProfes'
import { colorPersona, iniciales } from '@/lib/nawar/semanasTrabajo'
import { diaLegible, tituloDeClase, type SemanaEquipo } from '@/lib/nawar/salaProfes'
import { textoNotas } from '@/lib/nawar/presentaciones'
import { coincide, filasDePresentaciones, paraRevisar, porSemanas, queVenLosAlumnos, type FilaPresentaciones, type Revisar } from '@/lib/nawar/presentacionesEquipo'
import FichaClase from './FichaClase'
import type { ClaseEquipo } from './useClasesEquipo'
import { POPPINS } from './estilo'

const BOTON =
  'inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-[#E2E7F0] bg-white px-3.5 text-[13.5px] font-semibold text-[#0B1033] transition-colors hover:border-[#C9D3E6] hover:bg-[#F7F9FD]'
const BOTON_AZUL =
  'inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#0b2da0] px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0a2690]'

/** Un punto de color y su texto: así se dice el estado, sin cajitas. */
function Estado({ color, children, titulo }: { color?: string; children: React.ReactNode; titulo?: string }) {
  return (
    <span title={titulo} className={`inline-flex min-w-0 items-center gap-1.5 ${color ? 'text-[#2B3150]' : 'text-[#6B7393]'}`}>
      {color ? <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} /> : null}
      <span className="min-w-0">{children}</span>
    </span>
  )
}

function Fila({ f, hoy, onFicha }: { f: FilaPresentaciones; hoy: string; onFicha: () => void }) {
  const s = f.semana
  const enPizarra = f.lista.presentaciones.find((x) => x.en_pizarra)
  const otras = f.lista.presentaciones.filter((x) => !x.en_pizarra)
  const alumnos = queVenLosAlumnos(f, hoy)
  const esHoy = s.fecha === hoy
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-2.5 py-4 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-start">
      <div className="flex items-baseline gap-2 text-[13px] text-[#3B4262] sm:block">
        <p className={`font-semibold first-letter:uppercase ${esHoy ? 'text-[#0b2da0]' : 'text-[#0B1033]'}`}>{esHoy ? 'Hoy' : diaLegible(s.fecha).replace(/^(\S{3})\S*/, '$1')}</p>
        {f.hora ? <p className="tabular-nums">{f.hora}</p> : null}
      </div>
      <div className="min-w-0">
        <p className="text-[14.5px] font-semibold leading-snug text-[#0B1033]">
          <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: s.color }} />
          {s.curso}
          <span className="font-normal text-[#6B7393]"> · {tituloDeClase(s.tema, s.fecha)}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[#6B7393]">
          {f.profe ? (
            <>
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white" style={{ background: colorPersona(f.profe) }}>
                {iniciales(f.profe)}
              </span>
              La da {f.profe}
              {f.mia ? ' (tú)' : ''}
            </>
          ) : (
            <span className="text-[#8A6A2A]">Sin profe asignado</span>
          )}
        </p>
        <div className="mt-2 flex flex-col gap-1 text-[13px]">
          {enPizarra ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <Estado color="#0b2da0" titulo="La que se abre al pulsar «Pizarra»">
                En la pizarra: <b className="font-semibold text-[#0B1033]">{enPizarra.nombre}</b>
              </Estado>
              <span className={`text-[12.5px] ${enPizarra.notas ? 'text-[#2B3150]' : 'text-[#8A91AD]'}`}>{textoNotas(enPizarra.notas)}</span>
            </div>
          ) : (
            <Estado color={s.fecha >= hoy ? '#C8322B' : '#B8C0D2'}>Sin presentación</Estado>
          )}
          {otras.map((x) => (
            <p key={x.id} className="pl-[13px] text-[12.5px] leading-snug text-[#6B7393]">
              + {x.nombre}
              <span className="text-[#8A91AD]"> · {x.de === 'alumnos' ? 'los alumnos la ven antes' : x.de === 'blanco' ? 'sin PDF' : 'solo el equipo'}</span>
              {x.notas ? <span className="text-[#8A6A2A]"> · {textoNotas(x.notas).replace(/^Con/, 'con')}</span> : null}
            </p>
          ))}
          {f.lista.sueltas.length ? (
            <p className="pl-[13px] text-[12.5px] text-[#8A6A2A]">
              + {f.lista.sueltas.length === 1 ? 'Notas de una presentación que ya no está' : `Notas de ${f.lista.sueltas.length} presentaciones que ya no están`}
            </p>
          ) : null}
          {/* Lo que ven los alumnos es de la clase entera, no de una presentación: va aparte. */}
          {enPizarra || f.lista.publicada ? (
            <div className="text-[12.5px]">
              <Estado color={alumnos.color || undefined}>
                {alumnos.texto}
                {f.lista.publicada?.nombre && f.lista.presentaciones.length > 1 ? `, sacada de «${f.lista.publicada.nombre}»` : ''}
              </Estado>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2 sm:justify-end">
        {f.conPdf || f.lista.presentaciones.length ? (
          <a href={`/pizarra/${s.semanaId}`} className={BOTON}>
            Pizarra
          </a>
        ) : s.fecha >= hoy ? (
          // Solo las que están por dar piden la presentación; una ya dada sin ella, no.
          <button onClick={onFicha} className={BOTON_AZUL}>
            Subir
          </button>
        ) : null}
        <button onClick={onFicha} className={BOTON}>
          Ficha
        </button>
      </div>
    </li>
  )
}

function Aviso({ r, onFicha }: { r: Revisar; onFicha: (s: SemanaEquipo) => void }) {
  const color = r.tipo === 'sin-presentacion' && r.urgente ? '#C8322B' : '#E4B252'
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1 basis-[240px] text-[13.5px] leading-snug text-[#0B1033]">{r.texto}</span>
      {r.ir === 'pizarra' ? (
        <a href={`/pizarra/${r.fila.semana.semanaId}`} className="shrink-0 text-[13px] font-semibold text-[#0b2da0] hover:underline">
          {r.boton}
        </a>
      ) : (
        <button onClick={() => onFicha(r.fila.semana)} className="shrink-0 text-[13px] font-semibold text-[#0b2da0] hover:underline">
          {r.boton}
        </button>
      )}
    </li>
  )
}

export default function PresentacionesEquipo({
  clases,
  semanas,
  hoy,
  ruta,
  miNombre,
  admin,
  monitor,
  token,
  recargar,
  nombres = [],
}: {
  clases: ClaseEquipo[]
  semanas: SemanaEquipo[] | null
  hoy: string
  ruta: (p: string) => string
  miNombre: string
  admin: boolean
  monitor: boolean
  token: string
  recargar: () => void
  nombres?: string[]
}) {
  const [soloMias, setSoloMias] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [anteriores, setAnteriores] = useState(false)
  // La ficha abierta (por su clave: así sigue al día cuando se recarga).
  const [ficha, setFicha] = useState('')

  // `?ficha=<semana>` (desde «Editar semana» en la página de la clase): se
  // abre ya la ficha de esa clase, una sola vez.
  const pedida = Number(useSearchParams()?.get('ficha') || 0)
  const yaAbierta = useRef(false)
  useEffect(() => {
    if (!pedida || yaAbierta.current || !semanas) return
    yaAbierta.current = true
    const s = semanas.find((x) => x.semanaId === pedida && !x.suelta)
    if (s) setFicha(s.key)
  }, [pedida, semanas])

  const todas = useMemo(() => (semanas ? filasDePresentaciones(clases, semanas, hoy, (p) => esDe(p, miNombre)) : []), [clases, semanas, hoy, miNombre])
  if (semanas === null) return <p className="text-[14px] text-[#6B7393]">Cargando las presentaciones…</p>

  const mias = todas.filter((f) => f.mia).length
  const conFiltroMias = !admin && !monitor && mias > 0
  const delGrupo = conFiltroMias && soloMias ? todas.filter((f) => f.mia) : todas
  const visibles = delGrupo.filter((f) => coincide(f, buscar))
  const revisar = buscar.trim() ? [] : paraRevisar(delGrupo, hoy)
  const grupos = porSemanas(visibles, hoy)
  const delante = grupos.filter((g) => !g.pasada)
  const detras = grupos.filter((g) => g.pasada)
  // Buscando se enseña todo: lo de antes no se queda escondido.
  const verDetras = anteriores || !!buscar.trim()
  const abierta: SemanaEquipo | null = (ficha && semanas.find((x) => x.key === ficha)) || null

  const lista = (items: FilaPresentaciones[]) => (
    <ul className="divide-y divide-[#EEF1F7] border-t border-[#E4E8F2]">
      {items.map((f) => (
        <Fila key={f.semana.key} f={f} hoy={hoy} onFicha={() => setFicha(f.semana.key)} />
      ))}
    </ul>
  )

  return (
    <div className="max-w-[920px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <p className="min-w-0 flex-1 basis-[260px] text-[13.5px] leading-relaxed text-[#5B6382]">
          Qué presentación tiene cada clase, cuál abre la pizarra y qué ven los alumnos. Para subir, cambiar o pasar notas de una a otra, abre la ficha de la clase.
        </p>
        {conFiltroMias ? (
          <div className="flex gap-1.5">
            {(
              [
                [false, `Todas · ${todas.length}`],
                [true, `Las mías · ${mias}`],
              ] as const
            ).map(([v, t]) => (
              <button
                key={String(v)}
                onClick={() => setSoloMias(v)}
                className={`h-8 rounded-full border px-3 text-[13px] font-semibold ${soloMias === v ? 'border-[#0b2da0] bg-[#0b2da0] text-white' : 'border-[#DDE3EF] bg-white text-[#3B4262]'}`}
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}
        <label className="relative w-full sm:w-[240px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A91AD]" />
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por tema o archivo"
            className="h-9 w-full rounded-lg border border-[#E2E7F0] bg-white pl-9 pr-3 text-[13.5px] text-[#0B1033] outline-none placeholder:text-[#8A91AD] focus:border-[#0b2da0]"
          />
        </label>
      </div>

      {revisar.length ? (
        <section className="mt-5 rounded-xl bg-[#F7F9FD] px-4 py-3">
          <h3 className="text-[13px] font-semibold text-[#3B4262]">Para revisar</h3>
          <ul className="mt-1">
            {revisar.slice(0, 8).map((r) => (
              <Aviso key={r.id} r={r} onFicha={(s) => setFicha(s.key)} />
            ))}
          </ul>
          {revisar.length > 8 ? <p className="mt-1 text-[12.5px] text-[#6B7393]">Y {revisar.length - 8} más: están marcadas abajo, en cada clase.</p> : null}
        </section>
      ) : null}

      {!todas.length ? (
        <p className="mt-6 rounded-xl border border-dashed border-[#D5DCEA] px-5 py-8 text-center text-[14px] text-[#6B7393]">
          Aún no hay clases creadas en estas semanas. Se crean en el Calendario.
        </p>
      ) : !visibles.length ? (
        <p className="mt-6 text-[14px] text-[#6B7393]">Ninguna clase con «{buscar.trim()}».</p>
      ) : (
        <>
          {delante.map((g) => (
            <section key={g.clave} className="mt-7">
              <h3 className="mb-2 text-[15px] font-semibold text-[#0B1033]" style={POPPINS}>
                {g.titulo}
              </h3>
              {lista(g.items)}
            </section>
          ))}
          {!delante.length && !verDetras ? <p className="mt-6 text-[14px] text-[#6B7393]">No hay clases creadas de esta semana en adelante.</p> : null}
          {detras.length ? (
            verDetras ? (
              detras.map((g) => (
                <section key={g.clave} className="mt-7">
                  <h3 className="mb-2 text-[15px] font-semibold text-[#0B1033]" style={POPPINS}>
                    {g.titulo}
                  </h3>
                  {lista(g.items)}
                </section>
              ))
            ) : (
              <button onClick={() => setAnteriores(true)} className="mt-6 text-[13.5px] font-semibold text-[#0b2da0] hover:underline">
                {(() => {
                  const n = detras.reduce((t, g) => t + g.items.length, 0)
                  return n === 1 ? 'Ver la clase de las semanas anteriores' : `Ver las ${n} clases de las semanas anteriores`
                })()}
              </button>
            )
          ) : null}
        </>
      )}

      {abierta ? (
        <FichaClase
          semana={abierta}
          clase={clases.find((c) => c.uuid === abierta.courseUuid)}
          hoy={hoy}
          ruta={ruta}
          admin={admin}
          nombres={nombres}
          token={token}
          onCerrar={() => setFicha('')}
          onCambio={recargar}
          irA="presentaciones"
        />
      ) : null}
    </div>
  )
}
