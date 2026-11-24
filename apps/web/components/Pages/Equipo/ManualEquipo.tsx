'use client'
/**
 * Los procesos del equipo, los SOP (08/11/2026 el manual de los profes; desde
 * el 24/11/2026 de TODO el equipo, closers incluidos). A la izquierda los
 * procesos por área, con «Asignados a ti» arriba; a la derecha, el elegido.
 * El administrador los escribe, los asigna a personas y ve quién los ha
 * leído; cada asignado marca «Lo he leído» y, si el proceso cambia, le vuelve
 * a tocar. Sale en el panel (Procesos) y en la sala de profesores.
 * Servidor: apps/api/src/services/equipo/procesos.py.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronLeft, Check, Search, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmar } from '@/lib/nawar/confirmar'
import { bloquesDeTexto, trozosNegrita } from '@/lib/nawar/salaProfes'
import { borrarDoc, cambiarDoc, crearDoc, marcarLeido, plantillaManual, type DocManual, type Miembro } from '@services/equipo/equipo'
import { POPPINS } from './estilo'

/** Los enlaces pegados en el texto (Google Docs, Loom…) se pueden pulsar (09/11/2026). */
function ConEnlaces({ t }: { t: string }) {
  const trozos = t.split(/(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g)
  return (
    <>
      {trozos.map((x, i) =>
        i % 2 === 1 ? (
          <a key={i} href={x} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0b2da0] underline break-all">
            {x.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
          </a>
        ) : (
          <React.Fragment key={i}>{x}</React.Fragment>
        )
      )}
    </>
  )
}

function Linea({ texto }: { texto: string }) {
  return (
    <>
      {trozosNegrita(texto).map((t, i) =>
        t.negrita ? (
          <strong key={i} className="font-semibold text-[#0B1033]">
            <ConEnlaces t={t.t} />
          </strong>
        ) : (
          <ConEnlaces key={i} t={t.t} />
        )
      )}
    </>
  )
}

export function TextoManual({ texto }: { texto: string }) {
  return (
    <div className="text-[14.5px] text-[#1F2440] leading-relaxed">
      {bloquesDeTexto(texto).map((b, i) => {
        if (b.tipo === 'h2')
          return (
            <h3 key={i} className="text-[16px] font-bold text-[#0B1033] mt-5 mb-2 first:mt-0" style={POPPINS}>
              <Linea texto={b.texto} />
            </h3>
          )
        if (b.tipo === 'h3')
          return (
            <h4 key={i} className="text-[14.5px] font-semibold text-[#0B1033] mt-4 mb-1">
              <Linea texto={b.texto} />
            </h4>
          )
        if (b.tipo === 'ul')
          return (
            <ul key={i} className="space-y-1.5 mb-3">
              {b.items.map((t, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-[#0b2da0] shrink-0" />
                  <span>
                    <Linea texto={t} />
                  </span>
                </li>
              ))}
            </ul>
          )
        if (b.tipo === 'ol')
          return (
            <ol key={i} className="space-y-2 mb-3">
              {b.items.map((t, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="shrink-0 w-6 h-6 rounded-full border border-[#C9D4EC] text-[12px] font-semibold text-[#0b2da0] flex items-center justify-center mt-0.5">
                    {j + 1}
                  </span>
                  <span>
                    <Linea texto={t} />
                  </span>
                </li>
              ))}
            </ol>
          )
        return (
          <p key={i} className="mb-3">
            <Linea texto={'texto' in b ? b.texto : ''} />
          </p>
        )
      })}
    </div>
  )
}


const fecha = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '')

function ElegirPersonas({ miembros, elegidos, onCambio }: { miembros: Miembro[]; elegidos: number[]; onCambio: (ids: number[]) => void }) {
  const grupos = useMemo(() => {
    const g: { rol: string; gente: Miembro[] }[] = []
    for (const m of miembros) {
      const rol = m.rol || 'Equipo'
      const ya = g.find((x) => x.rol === rol)
      if (ya) ya.gente.push(m)
      else g.push({ rol, gente: [m] })
    }
    return g
  }, [miembros])
  if (!miembros.length) return <p className="text-[13px] text-[#6B7393]">No hay nadie más en el equipo todavía.</p>
  return (
    <div className="space-y-2">
      {grupos.map((g) => (
        <div key={g.rol}>
          <p className="text-[12px] text-[#6B7393] mb-1">{g.rol}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.gente.map((m) => {
              const on = elegidos.includes(m.id)
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => onCambio(on ? elegidos.filter((x) => x !== m.id) : [...elegidos, m.id])}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[13px] ${
                    on ? 'border-[#0b2da0] bg-[#EAF0FE] text-[#0b2da0] font-semibold' : 'border-[#DDE3EF] text-[#3B4262] hover:border-[#0b2da0]'
                  }`}
                >
                  {on ? <Check size={13} /> : null}
                  {m.nombre}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => onCambio(miembros.map((m) => m.id))} className="text-[12.5px] font-semibold text-[#0b2da0]">
          Todo el equipo
        </button>
        {elegidos.length ? (
          <button type="button" onClick={() => onCambio([])} className="text-[12.5px] font-semibold text-[#6B7393]">
            Nadie
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Editor({
  doc,
  secciones,
  miembros,
  onCancelar,
  onGuardar,
}: {
  doc: Partial<DocManual>
  secciones: string[]
  miembros: Miembro[]
  onCancelar: () => void
  onGuardar: (d: Parameters<typeof crearDoc>[1]) => Promise<void>
}) {
  const [titulo, setTitulo] = useState(doc.titulo || '')
  const [seccion, setSeccion] = useState(doc.seccion || '')
  const [resumen, setResumen] = useState(doc.resumen || '')
  const [texto, setTexto] = useState(doc.texto || '')
  const [visible, setVisible] = useState<'' | 'asignados'>(doc.visible || '')
  const [asignados, setAsignados] = useState<number[]>((doc.asignados || []).map((a) => a.id))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const campo = 'w-full rounded-lg border border-[#DDE3EF] bg-white px-3 py-2 text-[14px] text-[#0B1033] outline-none focus:border-[#0b2da0]'
  const etiqueta = 'block text-[12.5px] font-semibold text-[#3B4262] mb-1'
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-[1fr_240px] gap-3">
        <div>
          <label className={etiqueta}>Nombre del proceso</label>
          <input autoFocus className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Llamar a un lead nuevo" />
        </div>
        <div>
          <label className={etiqueta}>Área</label>
          <input className={campo} list="areas-procesos" value={seccion} onChange={(e) => setSeccion(e.target.value)} placeholder="Ventas, Clases, Operaciones…" />
          <datalist id="areas-procesos">
            {secciones.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>
      <div>
        <label className={etiqueta}>Para qué sirve, en una línea</label>
        <input className={campo} value={resumen} onChange={(e) => setResumen(e.target.value)} maxLength={300} placeholder="Qué consigue este proceso y cuándo se usa" />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <div>
          <label className={etiqueta}>Los pasos</label>
          <textarea className={`${campo} min-h-[320px] font-mono text-[13px]`} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <p className="mt-1.5 text-[12px] text-[#6B7393]">
            <code>## </code> título · <code>### </code> subtítulo · <code>- </code> punto · <code>1. </code> paso · <code>**así**</code> en negrita · los enlaces (Google Docs, Loom…) se pueden pulsar
          </p>
        </div>
        <div className="hidden lg:block">
          <p className={etiqueta}>Así se verá</p>
          <div className="rounded-lg border border-[#EEF1F7] bg-[#FAFBFE] p-4 min-h-[320px]">
            <TextoManual texto={texto} />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[#EEF1F7] p-4 space-y-3">
        <div>
          <p className={etiqueta}>Asignado a</p>
          <p className="text-[12.5px] text-[#6B7393] mb-2">A cada persona le sale en la campana y tiene que marcar «Lo he leído». Si cambias los pasos, le vuelve a tocar.</p>
          <ElegirPersonas miembros={miembros} elegidos={asignados} onCambio={setAsignados} />
        </div>
        <div>
          <p className={etiqueta}>Quién lo ve</p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['', 'Todo el equipo'],
                ['asignados', 'Solo las personas asignadas'],
              ] as const
            ).map(([v, t]) => (
              <button
                type="button"
                key={v}
                onClick={() => setVisible(v)}
                className={`h-8 px-3 rounded-full border text-[13px] ${visible === v ? 'border-[#0b2da0] bg-[#EAF0FE] text-[#0b2da0] font-semibold' : 'border-[#DDE3EF] text-[#3B4262]'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="h-10 px-4 rounded-lg border border-[#DDE3EF] text-[14px] font-semibold text-[#3B4262]">
          Cancelar
        </button>
        <button
          disabled={guardando}
          onClick={async () => {
            if (!titulo.trim()) return setError('Ponle un nombre al proceso')
            if (visible === 'asignados' && !asignados.length) return setError('Si solo lo ven las personas asignadas, asígnaselo a alguien')
            setGuardando(true)
            setError('')
            try {
              await onGuardar({ titulo, seccion, resumen, texto, visible, asignados })
            } catch (e: any) {
              setError(e?.message || 'No se pudo guardar')
              setGuardando(false)
            }
          }}
          className="h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

/** Lo que tiene que hacer quien tiene el proceso asignado. */
function ParaTi({ doc, onLeido }: { doc: DocManual; onLeido: (leido: boolean) => Promise<void> }) {
  const [enviando, setEnviando] = useState(false)
  const pulsar = async (v: boolean) => {
    setEnviando(true)
    try {
      await onLeido(v)
    } finally {
      setEnviando(false)
    }
  }
  if (doc.lectura === 'leido')
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-[#3B4262]">
        <span className="inline-flex items-center gap-1.5 text-[#16A34A] font-semibold">
          <Check size={15} strokeWidth={3} /> Lo leíste el {fecha(doc.leido_at)}
        </span>
        <button disabled={enviando} onClick={() => pulsar(false)} className="text-[12.5px] text-[#6B7393] underline">
          Deshacer
        </button>
      </div>
    )
  return (
    <div className="mt-4 rounded-xl border border-[#C9D4EC] bg-[#F5F8FF] px-4 py-3 flex flex-wrap items-center gap-3">
      <p className="text-[13.5px] text-[#1F2440] flex-1 min-w-[200px]">
        {doc.lectura === 'cambiado' ? (
          <>
            <strong className="font-semibold">Ha cambiado desde que lo leíste</strong> ({fecha(doc.leido_at)}). Léelo otra vez.
          </>
        ) : (
          <>
            <strong className="font-semibold">Este proceso es para ti.</strong> Léelo y, cuando lo tengas claro, márcalo.
          </>
        )}
      </p>
      <button disabled={enviando} onClick={() => pulsar(true)} className="h-9 px-4 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold disabled:opacity-60">
        Lo he leído
      </button>
    </div>
  )
}

/** Para el administrador: quién lo tiene y quién lo ha leído. */
function QuienLoLeyo({ doc }: { doc: DocManual }) {
  const gente = doc.asignados || []
  if (!gente.length) return <p className="mt-3 text-[13px] text-[#6B7393]">Sin asignar: lo ve el equipo, pero no le sale a nadie como tarea.</p>
  const leidos = gente.filter((a) => a.estado === 'leido').length
  return (
    <div className="mt-3">
      <p className="text-[12.5px] text-[#6B7393] mb-1.5">
        Asignado a {gente.length} · lo han leído {leidos}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {gente.map((a) => (
          <span
            key={a.id}
            title={a.estado === 'leido' ? `Leído el ${fecha(a.leido_at)}` : a.estado === 'cambiado' ? `Lo leyó el ${fecha(a.leido_at)}, antes del último cambio` : 'Aún no lo ha leído'}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-[#E2E6F0] text-[12.5px] text-[#1F2440]"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${a.estado === 'leido' ? 'bg-[#16A34A]' : a.estado === 'cambiado' ? 'bg-[#E4B252]' : 'bg-[#C3C9D9]'}`} />
            {a.nombre}
            <span className="text-[#8A91AD]">{a.estado === 'leido' ? fecha(a.leido_at) : a.estado === 'cambiado' ? 'ha cambiado' : 'sin leer'}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ManualEquipo({
  orgId,
  token,
  manual,
  setManual,
  admin,
  abrir,
  miembros = [],
}: {
  orgId: number
  token: string
  manual: DocManual[]
  setManual: React.Dispatch<React.SetStateAction<DocManual[]>>
  admin: boolean
  abrir?: number | null
  /** Todo el equipo, para asignar (solo lo usa el administrador). */
  miembros?: Miembro[]
}) {
  const misPendientes = manual.filter((d) => d.mio && d.lectura !== 'leido')
  const [elegida, setElegida] = useState<number | null>(abrir ?? misPendientes[0]?.id ?? manual[0]?.id ?? null)
  const [editando, setEditando] = useState<'nueva' | number | null>(null)
  const [verLista, setVerLista] = useState(!abrir)
  const [buscar, setBuscar] = useState('')
  const [error, setError] = useState('')
  // Si los procesos llegan después de abrir la pestaña, se abre el primero.
  useEffect(() => {
    if (elegida === null && manual.length) setElegida((manual.find((d) => d.mio && d.lectura !== 'leido') || manual[0]).id)
  }, [elegida, manual])
  useEffect(() => {
    if (abrir) {
      setElegida(abrir)
      setVerLista(false)
    }
  }, [abrir])
  const doc = manual.find((d) => d.id === elegida) || null
  const secciones = useMemo(() => Array.from(new Set(manual.map((d) => d.seccion).filter(Boolean))), [manual])
  const filtrados = useMemo(() => {
    const t = buscar.trim().toLowerCase()
    if (!t) return manual
    return manual.filter((d) => `${d.titulo} ${d.seccion} ${d.resumen || ''} ${d.texto}`.toLowerCase().includes(t))
  }, [manual, buscar])
  const grupos = useMemo(() => {
    const g: { seccion: string; docs: DocManual[] }[] = []
    const mios = filtrados.filter((d) => d.mio)
    if (mios.length && !buscar.trim()) g.push({ seccion: 'Asignados a ti', docs: mios })
    for (const d of filtrados) {
      const s = d.seccion || 'Otros'
      const ya = g.find((x) => x.seccion === s)
      if (ya) ya.docs.push(d)
      else g.push({ seccion: s, docs: [d] })
    }
    return g
  }, [filtrados, buscar])

  const poner = (c: DocManual) => setManual((m) => m.map((x) => (x.id === c.id ? c : x)))

  if (!manual.length && editando !== 'nueva') {
    return (
      <div className="rounded-2xl border border-[#E4E8F2] bg-white px-6 py-8 max-w-2xl">
        <h3 className="text-[18px] font-bold text-[#0B1033]" style={POPPINS}>
          {admin ? 'Aún no hay procesos' : 'Aún no hay procesos para ti'}
        </h3>
        <p className="mt-1.5 text-[14.5px] text-[#5B6382] leading-relaxed">
          Aquí va cómo se hace cada cosa en la escuela, por áreas: ventas, clases, alumnos, operaciones… Cada proceso con sus pasos, asignado a quien lo
          tiene que hacer. Así nadie tiene que preguntar por WhatsApp.
        </p>
        {admin ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => setEditando('nueva')} className="h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold">
              Escribir el primer proceso
            </button>
            <button
              onClick={async () => {
                try {
                  const r = await plantillaManual(orgId, token)
                  setManual(r.manual)
                  setElegida(r.manual[0]?.id ?? null)
                } catch (e: any) {
                  setError(e?.message || 'No se pudo crear')
                }
              }}
              className="h-10 px-4 rounded-lg border border-[#DDE3EF] text-[14px] font-semibold text-[#3B4262]"
            >
              Empezar con la plantilla de las clases
            </button>
          </div>
        ) : (
          <p className="mt-4 text-[13.5px] text-[#6B7393]">Los escribe la dirección de la escuela.</p>
        )}
        {error ? <p className="mt-3 text-[13px] text-red-700">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
      {/* La lista de procesos. En el móvil, una cosa cada vez. */}
      <aside className={`${verLista ? '' : 'hidden'} lg:block rounded-2xl border border-[#E4E8F2] bg-white p-2`}>
        <div className="relative m-1 mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A91AD]" />
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar un proceso"
            className="w-full h-9 pl-8 pr-2 rounded-lg border border-[#E2E6F0] text-[13.5px] outline-none focus:border-[#0b2da0]"
          />
        </div>
        {grupos.map((g) => (
          <div key={g.seccion} className="mb-2 last:mb-0">
            <p className={`px-2.5 pt-2 pb-1 text-[12px] font-semibold ${g.seccion === 'Asignados a ti' ? 'text-[#0b2da0]' : 'text-[#6B7393]'}`}>
              {g.seccion}
              {g.seccion === 'Asignados a ti' && misPendientes.length ? ` · ${misPendientes.length} por leer` : ''}
            </p>
            {g.docs.map((d) => (
              <button
                key={`${g.seccion}-${d.id}`}
                onClick={() => {
                  setElegida(d.id)
                  setEditando(null)
                  setVerLista(false)
                }}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-[14px] flex items-center gap-2 ${
                  d.id === elegida && editando === null ? 'bg-[#EAF0FE] text-[#0b2da0] font-semibold' : 'text-[#1F2440] hover:text-[#0b2da0]'
                }`}
              >
                <span className="flex-1 min-w-0">{d.titulo}</span>
                {d.visible === 'asignados' ? <Lock size={12} className="shrink-0 text-[#8A91AD]" /> : null}
                {d.mio && d.lectura !== 'leido' ? <span className="shrink-0 w-2 h-2 rounded-full bg-[#0b2da0]" title="Por leer" /> : null}
                {d.mio && d.lectura === 'leido' ? <Check size={13} strokeWidth={3} className="shrink-0 text-[#16A34A]" /> : null}
              </button>
            ))}
          </div>
        ))}
        {!grupos.length ? <p className="px-2.5 py-2 text-[13px] text-[#6B7393]">Ningún proceso con «{buscar}».</p> : null}
        {admin ? (
          <button
            onClick={() => {
              setEditando('nueva')
              setVerLista(false)
            }}
            className="w-full mt-1 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13.5px] font-semibold text-[#0b2da0]"
          >
            <Plus size={15} /> Nuevo proceso
          </button>
        ) : null}
      </aside>

      <article className={`${verLista ? 'hidden' : ''} lg:block rounded-2xl border border-[#E4E8F2] bg-white px-5 sm:px-7 py-5 sm:py-6 min-w-0`}>
        <button onClick={() => setVerLista(true)} className="lg:hidden inline-flex items-center gap-1 text-[13px] font-semibold text-[#0b2da0] mb-3">
          <ChevronLeft size={15} /> Todos los procesos
        </button>
        {editando !== null ? (
          <Editor
            doc={editando === 'nueva' ? {} : doc || {}}
            secciones={secciones}
            miembros={miembros}
            onCancelar={() => setEditando(null)}
            onGuardar={async (d) => {
              if (editando === 'nueva') {
                const nuevo = await crearDoc(orgId, d, token)
                setManual((m) => [...m, nuevo])
                setElegida(nuevo.id)
              } else {
                poner(await cambiarDoc(orgId, editando, d, token))
              }
              setEditando(null)
              toast.success('Proceso guardado')
            }}
          />
        ) : doc ? (
          <>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {doc.seccion ? <p className="text-[12.5px] font-semibold text-[#6B7393]">{doc.seccion}</p> : null}
                <h2 className="text-[22px] font-bold text-[#0B1033] leading-tight mt-0.5" style={POPPINS}>
                  {doc.titulo}
                </h2>
                {doc.resumen ? <p className="mt-1 text-[14.5px] text-[#4B5565]">{doc.resumen}</p> : null}
                {doc.visible === 'asignados' ? (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] text-[#6B7393]">
                    <Lock size={12} /> Solo lo ven las personas asignadas
                  </p>
                ) : null}
              </div>
              {admin ? (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setEditando(doc.id)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#DDE3EF] text-[13px] font-semibold text-[#3B4262] hover:border-[#0b2da0]"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    aria-label="Borrar el proceso"
                    onClick={async () => {
                      if (!(await confirmar(`¿Borrar el proceso «${doc.titulo}»?`, { boton: 'Sí, borrar' }))) return
                      try {
                        await borrarDoc(orgId, doc.id, token)
                        setManual((m) => m.filter((x) => x.id !== doc.id))
                        setElegida(manual.find((x) => x.id !== doc.id)?.id ?? null)
                      } catch (e: any) {
                        setError(e?.message || 'No se pudo borrar')
                      }
                    }}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-[#DDE3EF] text-[#B42318] hover:border-[#B42318]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : null}
            </div>
            {admin ? (
              <QuienLoLeyo doc={doc} />
            ) : doc.asignados?.length ? (
              <p className="mt-2 text-[12.5px] text-[#6B7393]">Asignado a {doc.asignados.map((a) => a.nombre).join(', ')}</p>
            ) : null}
            {doc.mio ? (
              <ParaTi
                doc={doc}
                onLeido={async (v) => {
                  try {
                    poner(await marcarLeido(orgId, doc.id, v, token))
                  } catch (e: any) {
                    toast.error(e?.message || 'No se pudo guardar')
                  }
                }}
              />
            ) : null}
            <div className="mt-5">
              <TextoManual texto={doc.texto} />
            </div>
            <p className="mt-6 pt-3 border-t border-[#EEF1F7] text-[12px] text-[#8A91AD]">
              {doc.actualizado_por ? `Última vez cambiado por ${doc.actualizado_por}` : ''}
              {doc.cambiado_at || doc.updated_at ? ` · ${new Date(doc.cambiado_at || doc.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}` : ''}
            </p>
            {error ? <p className="mt-2 text-[13px] text-red-700">{error}</p> : null}
          </>
        ) : (
          <p className="text-[14px] text-[#6B7393]">Elige un proceso.</p>
        )}
      </article>
    </div>
  )
}
