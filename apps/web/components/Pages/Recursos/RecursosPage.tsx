'use client'

/**
 * Recursos — lo que el equipo comparte con los alumnos: PDFs de las clases,
 * carpetas de Drive, audios, enlaces. Por carpetas, en el orden que decide el
 * administrador. Se abre todo en pestaña nueva.
 *
 * El administrador puede, desde aquí mismo (08/11, «poder añadir cosas, nuevas
 * secciones»): crear una sección, añadir a cada una un enlace o un archivo,
 * quitar lo que sobre y borrar una sección vacía. Quién ve cada sección y el
 * orden siguen en Panel → Material de venta → Recursos.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { FolderSimple } from '@phosphor-icons/react'
import { ExternalLink, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import {
  abrirUrl,
  anadirEnlace,
  borrarCarpeta,
  borrarItem,
  crearCarpeta,
  getRecursos,
  subirArchivo,
  tamano,
  tipoDe,
  type Carpeta,
} from '@services/recursos/recursos'
import { confirmar } from '@lib/nawar/confirmar'
import IconoRecurso from './IconoRecurso'
import Portada from '@components/Pages/Espacios/Portada'

const ETIQUETA: Record<ReturnType<typeof tipoDe>, string> = {
  drive: 'Google Drive',
  youtube: 'Vídeo',
  pdf: 'PDF',
  imagen: 'Imagen',
  audio: 'Audio',
  enlace: 'Enlace',
  archivo: 'Archivo',
}

/** `embebido`: en el panel (el closer, Ventas → Recursos), sin el título. */
export default function RecursosPage({ embebido = false }: { embebido?: boolean }) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const org = useOrg() as any
  const { isAdmin } = useAdminStatus() as any
  const puedeEditar = !!isAdmin && !embebido && !!org?.id
  const [carpetas, setCarpetas] = useState<Carpeta[] | null>(null)
  const [nuevaSeccion, setNuevaSeccion] = useState(false)
  const [anadirEn, setAnadirEn] = useState<number | null>(null)

  const cargar = useCallback(() => {
    if (!accessToken) return
    getRecursos(accessToken).then(setCarpetas)
  }, [accessToken])
  useEffect(() => {
    cargar()
  }, [cargar])

  async function quitarItem(id: number, titulo: string) {
    if (!(await confirmar(`¿Quitar «${titulo}» de Recursos?`, { peligro: true, boton: 'Quitar' }))) return
    await borrarItem(org.id, id, accessToken).catch(() => null)
    cargar()
  }
  async function quitarSeccion(c: Carpeta) {
    if (c.items.length) return
    if (!(await confirmar(`¿Borrar la sección «${c.name}»?`, { peligro: true, boton: 'Borrar' }))) return
    await borrarCarpeta(org.id, c.id, accessToken).catch(() => null)
    cargar()
  }

  const lista = carpetas || []
  const [filtro, setFiltro] = useState<string>('')
  const vistas = filtro ? lista.filter((c) => String(c.id) === filtro) : lista

  const contenido =
    carpetas === null ? (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    ) : carpetas.length === 0 && !puedeEditar ? (
      <div className="rounded-2xl border border-[#E4E8F2] bg-white p-6 text-[14px] text-[#4A5272]">
        Todavía no hay recursos. En cuanto el equipo suba algo, aparecerá aquí.
      </div>
    ) : (
      <div className="space-y-5">
        {puedeEditar ? (
          nuevaSeccion ? (
            <NuevaSeccion
              orgId={org.id}
              accessToken={accessToken}
              onCerrar={() => setNuevaSeccion(false)}
              onHecho={() => {
                setNuevaSeccion(false)
                cargar()
              }}
            />
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setNuevaSeccion(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold"
              >
                <Plus size={15} /> Nueva sección
              </button>
            </div>
          )
        ) : null}
        {vistas.map((c) => (
          <section key={c.id} id={`carpeta-${c.id}`} className="rounded-2xl border border-[#E4E8F2] bg-white">
            <div className="px-5 pt-4 pb-3 border-b border-[#EEF1F7] flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-[16px] font-bold text-[#0B1033]">{c.name}</h2>
                {c.description ? <p className="text-[13.5px] text-[#4A5272] mt-0.5">{c.description}</p> : null}
              </div>
              {puedeEditar ? (
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAnadirEn(c.id)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E4E8F2] text-[13px] font-semibold text-[#0b2da0]"
                  >
                    <Plus size={14} /> Añadir
                  </button>
                  {c.items.length === 0 ? (
                    <button type="button" onClick={() => quitarSeccion(c)} title="Borrar la sección" className="p-2 rounded-lg text-[#A3AAC2] hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {anadirEn === c.id ? (
              <AnadirRecurso
                orgId={org.id}
                carpetaId={c.id}
                accessToken={accessToken}
                onCerrar={() => setAnadirEn(null)}
                onHecho={() => {
                  setAnadirEn(null)
                  cargar()
                }}
              />
            ) : null}
            {c.items.length === 0 ? (
              <p className="px-5 py-4 text-[13.5px] text-[#8A91AD]">Esta carpeta está vacía.</p>
            ) : (
              <ul className="divide-y divide-[#EEF1F7]">
                {c.items.map((it) => (
                  <li key={it.id} className="flex items-center">
                    <a href={abrirUrl(it)} target="_blank" rel="noopener" className="flex-1 min-w-0 flex items-center gap-3 px-5 py-3">
                      <span className="shrink-0 text-[#6B7393]">
                        <IconoRecurso item={it} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14.5px] font-medium text-[#0B1033] truncate">{it.title}</span>
                        <span className="block text-[12.5px] text-[#8A91AD] truncate">
                          {ETIQUETA[tipoDe(it)]}
                          {it.size ? ` · ${tamano(it.size)}` : ''}
                        </span>
                      </span>
                      <ExternalLink size={15} className="text-[#A3AAC2] shrink-0" />
                    </a>
                    {puedeEditar ? (
                      <button type="button" onClick={() => quitarItem(it.id, it.title)} title="Quitar" className="mr-3 p-2 rounded-lg text-[#A3AAC2] hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    )

  if (embebido) return <div className="pb-10">{contenido}</div>

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-5">
      <Portada clave="recursos" titulo="Recursos" etiqueta="Empieza aquí" subtitulo="Materiales extra: vídeos, audios, carpetas compartidas y enlaces útiles.">
        {lista.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {[{ id: '', name: 'Todo' }, ...lista.map((c) => ({ id: String(c.id), name: c.name }))].map((c) => (
              <button
                key={c.id || 'todo'}
                type="button"
                onClick={() => setFiltro(c.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium border ${
                  filtro === c.id ? 'bg-[#EAF0FE] border-[#C9D6F5] text-[#0b2da0]' : 'bg-white border-[#E4E8F2] text-[#3B4262] hover:border-[#C9D4EC]'
                }`}
              >
                {c.id ? <FolderSimple size={14} /> : null}
                {c.name}
              </button>
            ))}
          </div>
        ) : null}
      </Portada>
      {contenido}
    </div>
  )
}

const CAMPO = 'w-full h-10 px-3 rounded-lg border border-[#DDE3F0] text-[14px] outline-none focus:border-[#0b2da0]'

function NuevaSeccion({ orgId, accessToken, onCerrar, onHecho }: { orgId: number; accessToken: string; onCerrar: () => void; onHecho: () => void }) {
  const [nombre, setNombre] = useState('')
  const [desc, setDesc] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    setError('')
    try {
      await crearCarpeta(orgId, nombre.trim(), desc.trim(), accessToken)
      onHecho()
    } catch (e: any) {
      setError(String(e?.message || 'No se pudo crear'))
    } finally {
      setGuardando(false)
    }
  }
  return (
    <section className="rounded-2xl border border-[#E4E8F2] bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-[#0B1033]">Nueva sección</h2>
        <button type="button" onClick={onCerrar} className="p-1.5 rounded-lg text-[#6B7393]" aria-label="Cerrar">
          <X size={17} />
        </button>
      </div>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (por ejemplo: Gramática, Audios del módulo 2)" className={CAMPO} autoFocus />
      <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Una frase sobre lo que hay dentro (opcional)" className={CAMPO} />
      <p className="text-[12px] text-[#6B7393]">La ven todos los de la escuela. Para cerrarla a un grupo: Panel → Material de venta → Recursos.</p>
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <button type="button" disabled={guardando || !nombre.trim()} onClick={guardar} className="h-9 px-4 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold disabled:opacity-50">
          {guardando ? 'Creando…' : 'Crear sección'}
        </button>
      </div>
    </section>
  )
}

function AnadirRecurso({
  orgId,
  carpetaId,
  accessToken,
  onCerrar,
  onHecho,
}: {
  orgId: number
  carpetaId: number
  accessToken: string
  onCerrar: () => void
  onHecho: () => void
}) {
  const [modo, setModo] = useState<'enlace' | 'archivo'>('enlace')
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const listo = modo === 'enlace' ? !!titulo.trim() && /^https?:\/\//i.test(url.trim()) : !!archivo
  async function guardar() {
    if (!listo) return
    setGuardando(true)
    setError('')
    try {
      if (modo === 'enlace') await anadirEnlace(orgId, carpetaId, titulo.trim(), url.trim(), accessToken)
      else if (archivo) await subirArchivo(orgId, carpetaId, archivo, titulo.trim(), accessToken)
      onHecho()
    } catch (e: any) {
      setError(String(e?.message || 'No se pudo añadir'))
    } finally {
      setGuardando(false)
    }
  }
  return (
    <div className="px-5 py-4 border-b border-[#EEF1F7] bg-[#FAFBFE] space-y-3">
      <div className="flex items-center gap-2">
        {(['enlace', 'archivo'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={`h-8 px-3 rounded-lg text-[13px] font-semibold border ${modo === m ? 'bg-[#0b2da0] border-[#0b2da0] text-white' : 'bg-white border-[#E4E8F2] text-[#3B4262]'}`}
          >
            {m === 'enlace' ? 'Un enlace' : 'Un archivo'}
          </button>
        ))}
        <button type="button" onClick={onCerrar} className="ml-auto p-1.5 rounded-lg text-[#6B7393]" aria-label="Cerrar">
          <X size={17} />
        </button>
      </div>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={modo === 'enlace' ? 'Título' : 'Título (si no, el nombre del archivo)'} className={CAMPO} />
      {modo === 'enlace' ? (
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={CAMPO} />
      ) : (
        <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-dashed border-[#C9D4EC] bg-white text-[13.5px] text-[#3B4262] cursor-pointer">
          <Upload size={15} className="text-[#0b2da0]" />
          <span className="truncate">{archivo ? archivo.name : 'Elegir un PDF, audio, imagen…'}</span>
          <input type="file" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
        </label>
      )}
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <button type="button" disabled={guardando || !listo} onClick={guardar} className="h-9 px-4 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold disabled:opacity-50">
          {guardando ? 'Añadiendo…' : 'Añadir'}
        </button>
      </div>
    </div>
  )
}
