'use client'

/**
 * Recursos, lado del administrador: crear carpetas, subir archivos (hasta
 * 25 MB), pegar enlaces (Drive, YouTube, lo que sea), ordenar y borrar.
 *
 * Los archivos van al mismo almacén que los adjuntos del chat (R2 si está
 * puesto, si no el volumen). Borrar un recurso lo quita de la lista pero NO
 * borra el archivo físico: perder un PDF por un clic no compensa.
 *
 * «Quién la ve» (06/10): todos, solo administradores, o solo los grupos de
 * usuarios que se marquen (Usuarios → Grupos) y/o «Alumnos». Así el grupo de
 * closers ve la carpeta comercial y nada más. Se filtra en el SERVIDOR; el
 * administrador las ve todas.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { FolderSimple } from '@phosphor-icons/react'
import { ArrowDown, ArrowUp, Check, Eye, Link2, Loader2, Lock, Pencil, Plus, Trash2, Upload, Users, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  abrirUrl,
  anadirEnlace,
  borrarCarpeta,
  borrarItem,
  crearCarpeta,
  editarCarpeta,
  getRecursosAdmin,
  ordenarCarpetas,
  ordenarItems,
  subirArchivo,
  tamano,
  type Carpeta,
  type Grupo,
  type QuienVe,
} from '@services/recursos/recursos'
import { getUserGroups } from '@services/usergroups/usergroups'
import IconoRecurso from '@components/Pages/Recursos/IconoRecurso'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-5'
const INPUT =
  'w-full bg-[#F0F5FF] rounded-xl px-3.5 py-2.5 text-[13.5px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 transition-colors'
const BTN = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60'
const BTN_PRI = `${BTN} bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656]`
const BTN_SEC = `${BTN} bg-[#F0F5FF] hover:bg-[#E4EDFF] text-[#1D0084]`

type GrupoUsuarios = { id: number; name: string }

/** «Todos», «Solo administradores» o «Solo: Closers, Alumnos». */
function resumenQuien(c: Carpeta, grupos: GrupoUsuarios[]): string {
  const gs = c.grupos || []
  if (gs.length) {
    return `Solo: ${gs
      .map((g) => (g === 'alumnos' ? 'Alumnos' : grupos.find((x) => x.id === g)?.name || 'un grupo borrado'))
      .join(', ')}`
  }
  return c.private ? 'Solo administradores' : 'Todos'
}

function mover<T>(lista: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= lista.length) return lista
  const copia = [...lista]
  ;[copia[i], copia[j]] = [copia[j], copia[i]]
  return copia
}

export default function RecursosAdmin() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [carpetas, setCarpetas] = useState<Carpeta[] | null>(null)
  const [nuevaCarpeta, setNuevaCarpeta] = useState('')
  const [creando, setCreando] = useState(false)
  const [grupos, setGrupos] = useState<GrupoUsuarios[]>([])

  useEffect(() => {
    if (!org?.id || !accessToken) return
    getUserGroups(org.id, accessToken)
      .then((r: any) => {
        if (r?.success && Array.isArray(r.data)) setGrupos(r.data.map((g: any) => ({ id: g.id, name: g.name })))
      })
      .catch(() => {})
  }, [org?.id, accessToken])

  const cargar = useCallback(async () => {
    if (!org?.id || !accessToken) return
    setCarpetas(await getRecursosAdmin(org.id, accessToken))
  }, [org?.id, accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  const crear = async () => {
    if (!nuevaCarpeta.trim()) return
    setCreando(true)
    try {
      await crearCarpeta(org.id, nuevaCarpeta.trim(), '', accessToken)
      setNuevaCarpeta('')
      await cargar()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo crear la carpeta')
    } finally {
      setCreando(false)
    }
  }

  const moverCarpeta = async (i: number, dir: -1 | 1) => {
    if (!carpetas) return
    const nuevas = mover(carpetas, i, dir)
    setCarpetas(nuevas)
    try {
      await ordenarCarpetas(org.id, nuevas.map((c) => c.id), accessToken)
    } catch {
      toast.error('No se pudo guardar el orden')
      cargar()
    }
  }

  return (
    <div className="h-full w-full bg-[#f8f8f8] px-4 sm:px-9 py-6 sm:py-9 pb-10 space-y-5 sm:space-y-6">
      <div className="flex items-center gap-2 min-w-0">
        <FolderSimple size={22} weight="fill" className="text-[#025dc7] shrink-0" />
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">Recursos</h1>
      </div>
      <p className="text-[13.5px] text-gray-600 -mt-2">
        Cada carpeta sale en <strong>Recursos</strong> a quien tú digas en «Quién la ve»: todos,
        solo administradores, o solo unos grupos (por ejemplo, la carpeta comercial solo para el
        grupo de closers, y la del curso solo para «Alumnos»). Tú las ves todas. Archivos de
        hasta 25 MB o enlaces: un Drive, un vídeo, una web.
      </p>

      <div className={`${CARD} flex flex-col sm:flex-row gap-2`}>
        <input
          value={nuevaCarpeta}
          onChange={(e) => setNuevaCarpeta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && crear()}
          placeholder="Nombre de la carpeta nueva (p. ej. «Módulo 1 · Apuntes»)"
          className={INPUT}
        />
        <button onClick={crear} disabled={creando || !nuevaCarpeta.trim()} className={BTN_PRI}>
          {creando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear carpeta
        </button>
      </div>

      {carpetas === null ? (
        <div className="flex items-center gap-2 text-[13.5px] text-gray-500 py-6">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : carpetas.length === 0 ? (
        <div className={CARD}>
          <p className="text-[13.5px] text-gray-700">Todavía no hay carpetas. Crea la primera arriba.</p>
        </div>
      ) : (
        carpetas.map((c, i) => (
          <CarpetaAdmin
            key={c.id}
            carpeta={c}
            grupos={grupos}
            esPrimera={i === 0}
            esUltima={i === carpetas.length - 1}
            onMover={(dir) => moverCarpeta(i, dir)}
            onCambio={cargar}
          />
        ))
      )}
    </div>
  )
}

function CarpetaAdmin({
  carpeta,
  grupos,
  esPrimera,
  esUltima,
  onMover,
  onCambio,
}: {
  carpeta: Carpeta
  grupos: GrupoUsuarios[]
  esPrimera: boolean
  esUltima: boolean
  onMover: (dir: -1 | 1) => void
  onCambio: () => Promise<void>
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(carpeta.name)
  const [descripcion, setDescripcion] = useState(carpeta.description)
  const [modo, setModo] = useState<'nada' | 'enlace' | 'archivo'>('nada')
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [eligiendo, setEligiendo] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const quienAhora: QuienVe = { private: carpeta.private, grupos: carpeta.grupos || [] }

  const guardarQuien = async (quien: QuienVe) => {
    setOcupado(true)
    try {
      await editarCarpeta(org.id, carpeta.id, carpeta.name, carpeta.description, accessToken, quien)
      await onCambio()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo cambiar')
    } finally {
      setOcupado(false)
    }
  }

  /** Marcar o desmarcar un grupo. Quitar el último deja la carpeta en
   * «Solo administradores», nunca abierta a todos sin querer. */
  const alternarGrupo = (g: Grupo) => {
    const gs = quienAhora.grupos.includes(g) ? quienAhora.grupos.filter((x) => x !== g) : [...quienAhora.grupos, g]
    guardarQuien({ private: gs.length === 0 ? true : false, grupos: gs })
  }

  const guardarNombre = async () => {
    setOcupado(true)
    try {
      await editarCarpeta(org.id, carpeta.id, nombre, descripcion, accessToken, quienAhora)
      setEditando(false)
      await onCambio()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    } finally {
      setOcupado(false)
    }
  }

  const borrar = async () => {
    if (!window.confirm(`¿Borrar la carpeta «${carpeta.name}» con todo lo que tiene?`)) return
    setOcupado(true)
    try {
      await borrarCarpeta(org.id, carpeta.id, accessToken)
      await onCambio()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo borrar')
    } finally {
      setOcupado(false)
    }
  }

  const anadir = async () => {
    setOcupado(true)
    try {
      if (modo === 'enlace') {
        await anadirEnlace(org.id, carpeta.id, titulo, url, accessToken)
      } else {
        const f = fileRef.current?.files?.[0]
        if (!f) {
          toast.error('Elige un archivo')
          return
        }
        await subirArchivo(org.id, carpeta.id, f, titulo, accessToken)
      }
      setTitulo('')
      setUrl('')
      setModo('nada')
      if (fileRef.current) fileRef.current.value = ''
      await onCambio()
      toast.success('Añadido')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo añadir')
    } finally {
      setOcupado(false)
    }
  }

  const quitar = async (id: number, t: string) => {
    if (!window.confirm(`¿Quitar «${t}»?`)) return
    try {
      await borrarItem(org.id, id, accessToken)
      await onCambio()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo quitar')
    }
  }

  const moverItem = async (i: number, dir: -1 | 1) => {
    const nuevos = mover(carpeta.items, i, dir)
    try {
      await ordenarItems(org.id, carpeta.id, nuevos.map((x) => x.id), accessToken)
      await onCambio()
    } catch {
      toast.error('No se pudo guardar el orden')
    }
  }

  return (
    <section className={CARD}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {editando ? (
            <div className="space-y-2">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={INPUT} placeholder="Nombre" />
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={INPUT} placeholder="Descripción (opcional)" />
              <div className="flex gap-2">
                <button onClick={guardarNombre} disabled={ocupado} className={BTN_PRI}>Guardar</button>
                <button onClick={() => setEditando(false)} className={BTN_SEC}>Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-[16px] font-bold text-[#1D0084] flex items-center gap-2 min-w-0">
                <FolderSimple size={18} weight="fill" className="text-[#025dc7] shrink-0" />
                <span className="truncate">{carpeta.name}</span>
              </h2>
              {carpeta.description ? <p className="text-[13px] text-gray-500 mt-0.5">{carpeta.description}</p> : null}
            </>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onMover(-1)} disabled={esPrimera} aria-label="Subir" className="p-1.5 rounded-lg text-gray-500 hover:bg-[#F0F5FF] disabled:opacity-30"><ArrowUp size={15} /></button>
          <button onClick={() => onMover(1)} disabled={esUltima} aria-label="Bajar" className="p-1.5 rounded-lg text-gray-500 hover:bg-[#F0F5FF] disabled:opacity-30"><ArrowDown size={15} /></button>
          <button onClick={() => setEditando((v) => !v)} aria-label="Renombrar" className="p-1.5 rounded-lg text-gray-500 hover:bg-[#F0F5FF]"><Pencil size={15} /></button>
          <button onClick={borrar} aria-label="Borrar carpeta" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
        </div>
      </div>

      {editando ? null : (
        <button
          onClick={() => setEligiendo((v) => !v)}
          className="mt-2 inline-flex items-start gap-1.5 text-[12.5px] text-gray-600 hover:text-[#025dc7] text-left"
          title="Cambiar quién ve esta carpeta"
        >
          <span className="mt-0.5 shrink-0">
            {quienAhora.grupos.length ? <Users size={13} /> : carpeta.private ? <Lock size={13} /> : <Eye size={13} />}
          </span>
          <span className="min-w-0">
            La ven: <strong className="font-semibold text-gray-900">{resumenQuien(carpeta, grupos)}</strong>{' '}
            <span className="text-[#025dc7] font-semibold whitespace-nowrap">· Cambiar</span>
          </span>
        </button>
      )}

      {eligiendo ? (
        <div className="mt-3 rounded-xl border border-[#E5E7EB] p-3 space-y-2.5">
          <p className="text-[13px] font-semibold text-gray-900">¿Quién ve esta carpeta?</p>
          <div className="flex flex-wrap gap-1.5">
            <Opcion activa={!quienAhora.grupos.length && !quienAhora.private} disabled={ocupado} onClick={() => guardarQuien({ private: false, grupos: [] })}>
              <Eye size={13} /> Todos
            </Opcion>
            <Opcion activa={!quienAhora.grupos.length && quienAhora.private} disabled={ocupado} onClick={() => guardarQuien({ private: true, grupos: [] })}>
              <Lock size={13} /> Solo administradores
            </Opcion>
          </div>
          <p className="text-[12.5px] text-gray-600">O solo estos (puedes marcar varios):</p>
          <div className="flex flex-wrap gap-1.5">
            <Opcion activa={quienAhora.grupos.includes('alumnos')} disabled={ocupado} onClick={() => alternarGrupo('alumnos')}>
              Alumnos
            </Opcion>
            {grupos.map((g) => (
              <Opcion key={g.id} activa={quienAhora.grupos.includes(g.id)} disabled={ocupado} onClick={() => alternarGrupo(g.id)}>
                {g.name}
              </Opcion>
            ))}
          </div>
          <p className="text-[12px] text-gray-500 leading-relaxed">
            «Alumnos» = todo el que tiene rol de alumno. Los demás son tus grupos de{' '}
            <a href="/dash/users/settings/usergroups" className="text-[#025dc7] font-semibold">
              Usuarios → Grupos
            </a>
            {grupos.length ? '' : ' (aún no tienes ninguno: crea uno, por ejemplo «Closers», y mete dentro a quien toque)'}.
            Los administradores las ven todas.
          </p>
          <button onClick={() => setEligiendo(false)} className={BTN_SEC}>Listo</button>
        </div>
      ) : null}

      {carpeta.items.length === 0 ? (
        <p className="text-[13px] text-[#9CA3AF] mt-3">Vacía. Añade un enlace o un archivo.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {carpeta.items.map((it, i) => (
            <li key={it.id} className="flex items-center gap-3 rounded-xl border border-[#DDE6F5] bg-[#F7FAFF] px-3 py-2">
              <span className="w-8 h-8 rounded-lg bg-white border border-[#DDE6F5] flex items-center justify-center shrink-0">
                <IconoRecurso item={it} size={16} />
              </span>
              <a href={abrirUrl(it)} target="_blank" rel="noopener" className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-semibold text-gray-900 truncate">{it.title}</span>
                <span className="block text-[12px] text-gray-500 truncate">
                  {it.kind === 'file' ? `${it.file_name}${it.size ? ` · ${tamano(it.size)}` : ''}` : it.url}
                </span>
              </a>
              <button onClick={() => moverItem(i, -1)} disabled={i === 0} aria-label="Subir" className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-30"><ArrowUp size={14} /></button>
              <button onClick={() => moverItem(i, 1)} disabled={i === carpeta.items.length - 1} aria-label="Bajar" className="p-1.5 rounded-lg text-gray-500 hover:bg-white disabled:opacity-30"><ArrowDown size={14} /></button>
              <button onClick={() => quitar(it.id, it.title)} aria-label="Quitar" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        {modo === 'nada' ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModo('enlace')} className={BTN_SEC}><Link2 size={14} /> Añadir enlace</button>
            <button onClick={() => setModo('archivo')} className={BTN_SEC}><Upload size={14} /> Subir archivo</button>
          </div>
        ) : (
          <div className="rounded-xl border border-[#DDE6F5] p-3 space-y-2">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={INPUT} placeholder={modo === 'enlace' ? 'Título (p. ej. «Audios del módulo 1»)' : 'Título (si lo dejas vacío, el nombre del archivo)'} />
            {modo === 'enlace' ? (
              <input value={url} onChange={(e) => setUrl(e.target.value)} className={INPUT} placeholder="https://drive.google.com/…" />
            ) : (
              <input ref={fileRef} type="file" className="block w-full text-[13px] text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#F0F5FF] file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-[#1D0084]" />
            )}
            <div className="flex gap-2">
              <button onClick={anadir} disabled={ocupado} className={BTN_PRI}>
                {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Añadir
              </button>
              <button onClick={() => setModo('nada')} className={BTN_SEC}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Opcion({
  activa,
  disabled,
  onClick,
  children,
}: {
  activa: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${
        activa ? 'border-[#025dc7] bg-[#025dc7] text-white' : 'border-[#E5E7EB] bg-white text-gray-700 hover:border-gray-400'
      }`}
    >
      {activa ? <Check size={13} /> : null}
      {children}
    </button>
  )
}
