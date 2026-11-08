'use client'
/**
 * El manual del equipo (08/11/2026): los SOP, cómo se hace cada cosa. A la
 * izquierda las páginas por apartado; a la derecha, la elegida. Lo lee todo el
 * equipo; lo escribe un administrador. Con el manual vacío, el administrador
 * puede empezar con la plantilla (el proceso que la escuela ya sigue).
 * Servidor: apps/api/src/services/equipo/equipo.py.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronLeft } from 'lucide-react'
import { confirmar } from '@/lib/nawar/confirmar'
import { bloquesDeTexto, trozosNegrita } from '@/lib/nawar/salaProfes'
import { borrarDoc, cambiarDoc, crearDoc, plantillaManual, type DocManual } from '@services/equipo/equipo'
import { POPPINS } from './TableroEquipo'

function Linea({ texto }: { texto: string }) {
  return (
    <>
      {trozosNegrita(texto).map((t, i) =>
        t.negrita ? (
          <strong key={i} className="font-semibold text-[#0B1033]">
            {t.t}
          </strong>
        ) : (
          <React.Fragment key={i}>{t.t}</React.Fragment>
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

function Editor({
  doc,
  secciones,
  onCancelar,
  onGuardar,
}: {
  doc: Partial<DocManual>
  secciones: string[]
  onCancelar: () => void
  onGuardar: (d: Partial<DocManual>) => Promise<void>
}) {
  const [titulo, setTitulo] = useState(doc.titulo || '')
  const [seccion, setSeccion] = useState(doc.seccion || '')
  const [texto, setTexto] = useState(doc.texto || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const campo = 'w-full rounded-lg border border-[#DDE3EF] bg-white px-3 py-2 text-[14px] text-[#0B1033] outline-none focus:border-[#0b2da0]'
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-[1fr_220px] gap-3">
        <div>
          <label className="block text-[12.5px] font-semibold text-[#3B4262] mb-1">Título</label>
          <input autoFocus className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Cómo preparar la semana" />
        </div>
        <div>
          <label className="block text-[12.5px] font-semibold text-[#3B4262] mb-1">Apartado</label>
          <input className={campo} list="apartados-manual" value={seccion} onChange={(e) => setSeccion(e.target.value)} placeholder="Cada semana de clase" />
          <datalist id="apartados-manual">
            {secciones.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <div>
          <label className="block text-[12.5px] font-semibold text-[#3B4262] mb-1">Texto</label>
          <textarea className={`${campo} min-h-[320px] font-mono text-[13px]`} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <p className="mt-1.5 text-[12px] text-[#6B7393]">
            <code>## </code> título · <code>### </code> subtítulo · <code>- </code> punto · <code>1. </code> paso · <code>**así**</code> en negrita
          </p>
        </div>
        <div className="hidden lg:block">
          <p className="block text-[12.5px] font-semibold text-[#3B4262] mb-1">Así se verá</p>
          <div className="rounded-lg border border-[#EEF1F7] bg-[#FAFBFE] p-4 min-h-[320px]">
            <TextoManual texto={texto} />
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
            if (!titulo.trim()) return setError('Ponle un título a la página')
            setGuardando(true)
            setError('')
            try {
              await onGuardar({ titulo, seccion, texto })
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

export default function ManualEquipo({
  orgId,
  token,
  manual,
  setManual,
  admin,
  abrir,
}: {
  orgId: number
  token: string
  manual: DocManual[]
  setManual: React.Dispatch<React.SetStateAction<DocManual[]>>
  admin: boolean
  abrir?: number | null
}) {
  const [elegida, setElegida] = useState<number | null>(abrir ?? manual[0]?.id ?? null)
  const [editando, setEditando] = useState<'nueva' | number | null>(null)
  const [verLista, setVerLista] = useState(!abrir)
  const [error, setError] = useState('')
  // Si el manual llega después de abrir la pestaña, se abre la primera página.
  useEffect(() => {
    if (elegida === null && manual.length) setElegida(manual[0].id)
  }, [elegida, manual])
  const doc = manual.find((d) => d.id === elegida) || null
  const secciones = useMemo(() => Array.from(new Set(manual.map((d) => d.seccion).filter(Boolean))), [manual])
  const grupos = useMemo(() => {
    const g: { seccion: string; docs: DocManual[] }[] = []
    for (const d of manual) {
      const s = d.seccion || 'Otras'
      const ya = g.find((x) => x.seccion === s)
      if (ya) ya.docs.push(d)
      else g.push({ seccion: s, docs: [d] })
    }
    return g
  }, [manual])

  if (!manual.length && editando !== 'nueva') {
    return (
      <div className="rounded-2xl border border-[#E4E8F2] bg-white px-6 py-8 max-w-2xl">
        <h3 className="text-[18px] font-bold text-[#0B1033]" style={POPPINS}>
          El manual del equipo está vacío
        </h3>
        <p className="mt-1.5 text-[14.5px] text-[#5B6382] leading-relaxed">
          Aquí va cómo se hace cada cosa en la escuela: preparar la semana, el día de la clase, corregir, los check-in… Así un profe nuevo no tiene que
          preguntar por WhatsApp.
        </p>
        {admin ? (
          <div className="mt-5 flex flex-wrap gap-2">
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
              className="h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold"
            >
              Empezar con la plantilla
            </button>
            <button onClick={() => setEditando('nueva')} className="h-10 px-4 rounded-lg border border-[#DDE3EF] text-[14px] font-semibold text-[#3B4262]">
              Escribir la primera página
            </button>
          </div>
        ) : (
          <p className="mt-4 text-[13.5px] text-[#6B7393]">Lo escribe la dirección de la escuela.</p>
        )}
        {admin ? (
          <p className="mt-3 text-[12.5px] text-[#6B7393]">
            La plantilla trae el proceso que la escuela ya sigue, en seis páginas. Luego se cambia todo lo que haga falta.
          </p>
        ) : null}
        {error ? <p className="mt-3 text-[13px] text-red-700">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
      {/* La lista de páginas. En el móvil, una cosa cada vez. */}
      <aside className={`${verLista ? '' : 'hidden'} lg:block rounded-2xl border border-[#E4E8F2] bg-white p-2`}>
        {grupos.map((g) => (
          <div key={g.seccion} className="mb-2 last:mb-0">
            <p className="px-2.5 pt-2 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">{g.seccion}</p>
            {g.docs.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setElegida(d.id)
                  setEditando(null)
                  setVerLista(false)
                }}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-[14px] ${
                  d.id === elegida && editando === null ? 'bg-[#EAF0FE] text-[#0b2da0] font-semibold' : 'text-[#1F2440] hover:text-[#0b2da0]'
                }`}
              >
                {d.titulo}
              </button>
            ))}
          </div>
        ))}
        {admin ? (
          <button
            onClick={() => {
              setEditando('nueva')
              setVerLista(false)
            }}
            className="w-full mt-1 inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13.5px] font-semibold text-[#0b2da0]"
          >
            <Plus size={15} /> Nueva página
          </button>
        ) : null}
      </aside>

      <article className={`${verLista ? 'hidden' : ''} lg:block rounded-2xl border border-[#E4E8F2] bg-white px-5 sm:px-7 py-5 sm:py-6 min-w-0`}>
        <button onClick={() => setVerLista(true)} className="lg:hidden inline-flex items-center gap-1 text-[13px] font-semibold text-[#0b2da0] mb-3">
          <ChevronLeft size={15} /> Todas las páginas
        </button>
        {editando !== null ? (
          <Editor
            doc={editando === 'nueva' ? {} : doc || {}}
            secciones={secciones}
            onCancelar={() => setEditando(null)}
            onGuardar={async (d) => {
              if (editando === 'nueva') {
                const nuevo = await crearDoc(orgId, d, token)
                setManual((m) => [...m, nuevo])
                setElegida(nuevo.id)
              } else {
                const c = await cambiarDoc(orgId, editando, d, token)
                setManual((m) => m.map((x) => (x.id === c.id ? c : x)))
              }
              setEditando(null)
            }}
          />
        ) : doc ? (
          <>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {doc.seccion ? <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7393]">{doc.seccion}</p> : null}
                <h2 className="text-[22px] font-bold text-[#0B1033] leading-tight mt-0.5" style={POPPINS}>
                  {doc.titulo}
                </h2>
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
                    aria-label="Borrar la página"
                    onClick={async () => {
                      if (!(await confirmar(`¿Borrar la página «${doc.titulo}» del manual?`, { boton: 'Sí, borrar' }))) return
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
            <div className="mt-4">
              <TextoManual texto={doc.texto} />
            </div>
            <p className="mt-6 pt-3 border-t border-[#EEF1F7] text-[12px] text-[#8A91AD]">
              {doc.actualizado_por ? `Última vez cambiada por ${doc.actualizado_por}` : ''}
              {doc.updated_at ? ` · ${new Date(doc.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}` : ''}
            </p>
            {error ? <p className="mt-2 text-[13px] text-red-700">{error}</p> : null}
          </>
        ) : (
          <p className="text-[14px] text-[#6B7393]">Elige una página.</p>
        )}
      </article>
    </div>
  )
}
