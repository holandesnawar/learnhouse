'use client'

/**
 * El Estudio (10/11/2026): la pizarra del negocio, el banco de ideas de
 * contenido y los prompts ya preparados. Pedido del usuario: "tener todo en un
 * sitio… mi pizarra para escribir fácil (el mapa mental da pereza)… generador
 * de ideas con alcance, comunidad y ventas, y marcar: se subió a Instagram,
 * check; TikTok, check; blog, check".
 *
 * - **Pizarra**: escribir e Intro. Cada nota, en su área.
 * - **Ideas**: reels, carruseles, artículos… con su objetivo y dónde se publicó.
 * - **Prompts**: la escuela arma el encargo y se pega en Claude (sin clave de
 *   IA dentro de la escuela, a propósito). Lo que devuelve se pega de golpe.
 *
 * El closer solo ve la pizarra, y solo el área de ventas (lo decide el
 * servidor: `apps/api/src/services/estudio/estudio.py`).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, ClipboardPaste, Copy, ExternalLink, Lightbulb, Loader2, Pin, Sparkles, Trash2, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { confirmar } from '@/lib/nawar/confirmar'
import { haceCuanto } from '@/lib/nawar/haceCuanto'
import { useCajaQueCrece } from '@/lib/nawar/cajaQueCrece'
import {
  GENERADORES,
  materialDeLeccion,
  promptBlog,
  promptClase,
  promptComunidad,
  promptGuion,
  promptIdeas,
  promptRecurso,
  type Generador,
  type Objetivo,
  type TipoClase,
} from '@/lib/nawar/estudioPrompts'
import { getAllLessonsForModule, getLesson, getModules } from '@/lib/exercises-app/courseService'
import { borrarItem, cambiarItem, crearItem, crearVarias, getEstudio, type CambioItem, type EstudioDatos, type ItemEstudio } from '@services/estudio/estudio'
import { BOTON, BOTON_PRINCIPAL, META, TARJETA, filtro } from './ui'

type Vista = 'pizarra' | 'ideas' | 'prompts'
const CAMPO =
  'w-full rounded-lg border border-[#D5DDEC] bg-white px-3 py-2 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#025dc7] focus:ring-2 focus:ring-[#025dc7]/15'
const ETIQUETA = 'block text-[12px] font-semibold text-[#5A6480] mb-1'
const COLOR_OBJETIVO: Record<string, string> = { alcance: '#0E7490', comunidad: '#6D28D9', ventas: '#B45309' }

function nombreDe(lista: { id: string; nombre: string }[], id: string) {
  return lista.find((x) => x.id === id)?.nombre || ''
}

export default function EstudioPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [datos, setDatos] = useState<EstudioDatos | null>(null)
  const [error, setError] = useState('')
  const [vista, setVista] = useState<Vista>('pizarra')
  /** La idea que se manda al prompt del guion. */
  const [paraGuion, setParaGuion] = useState<ItemEstudio | null>(null)

  useEffect(() => {
    try {
      const g = localStorage.getItem('nawar.estudio.vista')
      if (g === 'pizarra' || g === 'ideas' || g === 'prompts') setVista(g)
    } catch {}
  }, [])
  const ir = (v: Vista) => {
    setVista(v)
    try {
      localStorage.setItem('nawar.estudio.vista', v)
    } catch {}
  }

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    try {
      setDatos(await getEstudio(org.id, token))
      setError('')
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el Estudio')
    }
  }, [org?.id, token])
  useEffect(() => {
    cargar()
  }, [cargar])

  /** Cambia un item en pantalla al momento y lo guarda; si falla, vuelve a leer. */
  const cambiar = useCallback(
    async (id: number, cambio: CambioItem) => {
      try {
        const nuevo = await cambiarItem(org.id, id, cambio, token)
        setDatos((d) => (d ? { ...d, items: d.items.map((i) => (i.id === id ? nuevo : i)) } : d))
      } catch (e: any) {
        toast.error(e?.message || 'No se pudo guardar')
        cargar()
      }
    },
    [org?.id, token, cargar]
  )
  const borrar = useCallback(
    async (item: ItemEstudio) => {
      if (!(await confirmar(`¿Borrar «${item.titulo.slice(0, 80)}»?`))) return
      try {
        await borrarItem(org.id, item.id, token)
        setDatos((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== item.id) } : d))
      } catch (e: any) {
        toast.error(e?.message || 'No se pudo borrar')
      }
    },
    [org?.id, token]
  )
  const anadir = useCallback((nuevos: ItemEstudio[]) => setDatos((d) => (d ? { ...d, items: [...nuevos, ...d.items] } : d)), [])

  if (error) return <p className="text-[13.5px] text-red-600">{error}</p>
  if (!datos)
    return (
      <p className={`${META} flex items-center gap-2`}>
        <Loader2 size={14} className="animate-spin" /> Cargando…
      </p>
    )

  const notas = datos.items.filter((i) => i.tipo === 'nota')
  const ideas = datos.items.filter((i) => i.tipo === 'idea')
  const accion = { orgId: org.id as number, token, datos, cambiar, borrar, anadir }

  return (
    <div className="space-y-4">
      {datos.admin ? (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button onClick={() => ir('pizarra')} className={filtro(vista === 'pizarra')}>
            Pizarra{notas.filter((n) => n.estado !== 'hecho').length ? ` · ${notas.filter((n) => n.estado !== 'hecho').length}` : ''}
          </button>
          <button onClick={() => ir('ideas')} className={filtro(vista === 'ideas')}>
            Ideas de contenido{ideas.length ? ` · ${ideas.length}` : ''}
          </button>
          <button onClick={() => ir('prompts')} className={filtro(vista === 'prompts')}>
            Prompts
          </button>
        </div>
      ) : null}

      {!datos.admin || vista === 'pizarra' ? (
        <Pizarra {...accion} notas={notas} />
      ) : vista === 'ideas' ? (
        <Ideas
          {...accion}
          ideas={ideas}
          onGuion={(i) => {
            setParaGuion(i)
            ir('prompts')
          }}
        />
      ) : (
        <Prompts {...accion} ideas={ideas} paraGuion={paraGuion} />
      )}
    </div>
  )
}

interface Accion {
  orgId: number
  token: string
  datos: EstudioDatos
  cambiar: (id: number, cambio: CambioItem) => Promise<void>
  borrar: (item: ItemEstudio) => Promise<void>
  anadir: (nuevos: ItemEstudio[]) => void
}

/* ── Pizarra ─────────────────────────────────────────────────────────── */

function Pizarra({ orgId, token, datos, cambiar, borrar, anadir, notas }: Accion & { notas: ItemEstudio[] }) {
  const [texto, setTexto] = useState('')
  const [area, setArea] = useState(datos.areas[0]?.id || 'otros')
  const [ver, setVer] = useState('todas')
  const [verHechas, setVerHechas] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const caja = useRef<HTMLTextAreaElement>(null)
  useCajaQueCrece(caja, texto)

  useEffect(() => {
    try {
      const g = localStorage.getItem('nawar.estudio.area')
      if (g && datos.areas.some((a) => a.id === g)) setArea(g)
    } catch {}
  }, [datos.areas])

  async function apuntar() {
    const limpio = texto.trim()
    if (!limpio || guardando) return
    // La primera línea es la nota; lo demás, el detalle.
    const [primera, ...resto] = limpio.split('\n')
    setGuardando(true)
    try {
      const nueva = await crearItem(orgId, { tipo: 'nota', area, titulo: primera.slice(0, 300), texto: resto.join('\n').trim() }, token)
      anadir([nueva])
      setTexto('')
      try {
        localStorage.setItem('nawar.estudio.area', area)
      } catch {}
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo apuntar')
    } finally {
      setGuardando(false)
      caja.current?.focus()
    }
  }

  const delArea = ver === 'todas' ? notas : notas.filter((n) => n.area === ver)
  const abiertas = delArea.filter((n) => n.estado !== 'hecho').sort((a, b) => Number(b.fijada) - Number(a.fijada))
  const hechas = delArea.filter((n) => n.estado === 'hecho')
  const cuenta = (id: string) => notas.filter((n) => n.area === id && n.estado !== 'hecho').length

  return (
    <div className="space-y-4">
      <div className={`${TARJETA} p-3 sm:p-4`}>
        <textarea
          ref={caja}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              apuntar()
            }
          }}
          rows={1}
          autoFocus
          placeholder={datos.admin ? 'Escribe lo que tengas en la cabeza y pulsa Intro…' : 'Apunta algo de ventas (una objeción nueva, una idea, algo que preguntan mucho) y pulsa Intro…'}
          className="w-full resize-none bg-transparent text-[15px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {datos.areas.length > 1
            ? datos.areas.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setArea(a.id)}
                  className={`h-7 px-2.5 rounded-md text-[12.5px] font-medium border transition-colors ${
                    area === a.id ? 'bg-[#EAF0FE] border-[#B9CBEA] text-[#0b2da0]' : 'bg-white border-[#E2E8F4] text-[#5A6480] hover:border-[#B9CBEA]'
                  }`}
                >
                  {a.nombre}
                </button>
              ))
            : null}
        </div>
        <div className="mt-2 flex items-center justify-end gap-3">
          <span className="hidden sm:inline text-[12px] text-[#9CA3AF]">Mayús + Intro para otra línea</span>
          <button onClick={apuntar} disabled={!texto.trim() || guardando} className={BOTON_PRINCIPAL}>
            {guardando ? <Loader2 size={14} className="animate-spin" /> : null} Apuntar
          </button>
        </div>
      </div>

      {datos.areas.length > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button onClick={() => setVer('todas')} className={filtro(ver === 'todas')}>
            Todo
          </button>
          {datos.areas.map((a) => (
            <button key={a.id} onClick={() => setVer(a.id)} className={filtro(ver === a.id)}>
              {a.nombre}
              {cuenta(a.id) ? ` · ${cuenta(a.id)}` : ''}
            </button>
          ))}
        </div>
      ) : null}

      {abiertas.length ? (
        <ul className={`${TARJETA} divide-y divide-[#EEF2F9]`}>
          {abiertas.map((n) => (
            <Nota key={n.id} nota={n} datos={datos} cambiar={cambiar} borrar={borrar} />
          ))}
        </ul>
      ) : (
        <p className={`${TARJETA} px-4 py-6 text-center text-[13.5px] text-[#6B7280]`}>
          {notas.length ? 'Nada pendiente aquí.' : 'La pizarra está vacía. Lo que apuntes arriba se queda aquí, ordenado por área.'}
        </p>
      )}

      {hechas.length ? (
        <div>
          <button onClick={() => setVerHechas((v) => !v)} className="text-[13px] font-medium text-[#025dc7] hover:underline">
            {verHechas ? 'Ocultar' : 'Ver'} las {hechas.length} hechas
          </button>
          {verHechas ? (
            <ul className={`${TARJETA} mt-2 divide-y divide-[#EEF2F9]`}>
              {hechas.map((n) => (
                <Nota key={n.id} nota={n} datos={datos} cambiar={cambiar} borrar={borrar} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Nota({ nota, datos, cambiar, borrar }: { nota: ItemEstudio; datos: EstudioDatos } & Pick<Accion, 'cambiar' | 'borrar'>) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const caja = useRef<HTMLTextAreaElement>(null)
  useCajaQueCrece(caja, editando ? texto : '')
  const mia = datos.admin || nota.autor_id === datos.yo
  const hecha = nota.estado === 'hecho'

  function abrir() {
    if (!mia) return
    setTexto(nota.texto ? `${nota.titulo}\n${nota.texto}` : nota.titulo)
    setEditando(true)
  }
  async function guardar() {
    const [primera, ...resto] = texto.trim().split('\n')
    setEditando(false)
    if (!primera?.trim()) return
    const detalle = resto.join('\n').trim()
    if (primera.trim() !== nota.titulo || detalle !== nota.texto) await cambiar(nota.id, { titulo: primera.trim().slice(0, 300), texto: detalle })
  }

  return (
    <li className="group flex items-start gap-3 px-3.5 sm:px-4 py-3">
      <button
        onClick={() => mia && cambiar(nota.id, { estado: hecha ? 'idea' : 'hecho' })}
        disabled={!mia}
        aria-label={hecha ? 'Volver a pendiente' : 'Marcar como hecha'}
        className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
          hecha ? 'border-[#16A34A] text-[#16A34A]' : 'border-[#CBD5E1] text-transparent hover:border-[#16A34A]'
        }`}
      >
        <Check size={12} strokeWidth={3.2} />
      </button>
      <div className="min-w-0 flex-1">
        {editando ? (
          <textarea
            ref={caja}
            value={texto}
            autoFocus
            onChange={(e) => setTexto(e.target.value)}
            onBlur={guardar}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                guardar()
              }
              if (e.key === 'Escape') setEditando(false)
            }}
            className={CAMPO + ' resize-none'}
          />
        ) : (
          <div onClick={abrir} className={mia ? 'cursor-text' : ''}>
            <p className={`text-[14.5px] leading-snug ${hecha ? 'text-[#9CA3AF] line-through' : 'text-[#111827]'}`}>
              {nota.fijada ? <Pin size={12} className="inline -mt-0.5 mr-1 text-[#025dc7]" /> : null}
              {nota.titulo}
            </p>
            {nota.texto ? <p className="mt-1 text-[13.5px] text-[#4B5563] whitespace-pre-wrap">{nota.texto}</p> : null}
          </div>
        )}
        <p className="mt-1 text-[12px] text-[#9CA3AF]">
          {datos.admin ? (
            // El nombre a la vista y, encima e invisible, el desplegable: así
            // ocupa lo que mide su texto y no lo que mide el área más larga.
            <span className="relative inline-block mr-1 font-medium text-[#5A6480] hover:text-[#025dc7]">
              {nombreDe(datos.areas, nota.area) || 'Otros'} ·
              <select
                value={nota.area}
                onChange={(e) => cambiar(nota.id, { area: e.target.value })}
                aria-label="Cambiar de área"
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              >
                {datos.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </span>
          ) : null}
          {nota.autor} · {haceCuanto(nota.created_at)}
        </p>
      </div>
      {mia ? (
        <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {datos.admin ? (
            <>
              <button
                onClick={() => cambiar(nota.id, { fijada: !nota.fijada })}
                title={nota.fijada ? 'Quitar de arriba' : 'Fijar arriba'}
                className={`w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#F3F6FD] ${nota.fijada ? 'text-[#025dc7]' : 'text-[#9CA3AF]'}`}
              >
                <Pin size={14} />
              </button>
              <button
                onClick={() => cambiar(nota.id, { tipo: 'idea', area: 'contenido', estado: 'idea' })}
                title="Pasarla a idea de contenido"
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:bg-[#F3F6FD] hover:text-[#025dc7]"
              >
                <Lightbulb size={14} />
              </button>
            </>
          ) : null}
          <button onClick={() => borrar(nota)} title="Borrar" className="w-7 h-7 rounded-md flex items-center justify-center text-[#9CA3AF] hover:bg-red-50 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      ) : null}
    </li>
  )
}

/* ── Ideas ───────────────────────────────────────────────────────────── */

function Ideas({ orgId, token, datos, cambiar, borrar, anadir, ideas, onGuion }: Accion & { ideas: ItemEstudio[]; onGuion: (i: ItemEstudio) => void }) {
  const [titulo, setTitulo] = useState('')
  const [formato, setFormato] = useState('reel')
  const [objetivo, setObjetivo] = useState('alcance')
  const [verObjetivo, setVerObjetivo] = useState('')
  const [verFormato, setVerFormato] = useState('')
  const [ver, setVer] = useState<'pendientes' | 'publicadas' | 'todas'>('pendientes')
  const [busca, setBusca] = useState('')
  const [abierta, setAbierta] = useState<number | null>(null)
  const [pegando, setPegando] = useState(false)

  async function crear() {
    if (!titulo.trim()) return
    try {
      const nueva = await crearItem(orgId, { tipo: 'idea', area: 'contenido', titulo: titulo.trim(), formato, objetivo }, token)
      anadir([nueva])
      setTitulo('')
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar')
    }
  }

  const publicada = (i: ItemEstudio) => Object.keys(i.canales).length > 0
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return ideas.filter(
      (i) =>
        (!verObjetivo || i.objetivo === verObjetivo) &&
        (!verFormato || i.formato === verFormato) &&
        (ver === 'todas' || (ver === 'publicadas' ? publicada(i) : !publicada(i))) &&
        (!q || `${i.titulo} ${i.texto}`.toLowerCase().includes(q))
    )
  }, [ideas, verObjetivo, verFormato, ver, busca])
  const nPublicadas = ideas.filter(publicada).length

  return (
    <div className="space-y-4">
      <div className={`${TARJETA} p-3 sm:p-4`}>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && crear()}
            placeholder="Una idea nueva: «Llevas dos años diciendo esto mal en el súper»"
            className={CAMPO + ' flex-1'}
          />
          <select value={formato} onChange={(e) => setFormato(e.target.value)} className={CAMPO + ' sm:w-40'}>
            {datos.formatos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
          <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={CAMPO + ' sm:w-36'}>
            {datos.objetivos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
          <button onClick={crear} disabled={!titulo.trim()} className={BOTON_PRINCIPAL + ' h-[38px]'}>
            Guardar
          </button>
        </div>
        <button onClick={() => setPegando(true)} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#025dc7] hover:underline">
          <ClipboardPaste size={14} /> Pegar varias de golpe (lo que te devuelve Claude)
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setVer('pendientes')} className={filtro(ver === 'pendientes')}>
          Por publicar · {ideas.length - nPublicadas}
        </button>
        <button onClick={() => setVer('publicadas')} className={filtro(ver === 'publicadas')}>
          Publicadas · {nPublicadas}
        </button>
        <button onClick={() => setVer('todas')} className={filtro(ver === 'todas')}>
          Todas
        </button>
        <span className="w-px h-5 bg-[#E2E8F4] mx-1" />
        {datos.objetivos.map((o) => (
          <button key={o.id} onClick={() => setVerObjetivo(verObjetivo === o.id ? '' : o.id)} className={filtro(verObjetivo === o.id)}>
            {o.nombre}
          </button>
        ))}
        <select value={verFormato} onChange={(e) => setVerFormato(e.target.value)} className="h-8 rounded-lg border border-[#E2E8F4] bg-white px-2 text-[13px] text-[#374151]">
          <option value="">Todos los formatos</option>
          {datos.formatos.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="h-8 w-40 rounded-lg border border-[#E2E8F4] bg-white px-2.5 text-[13px] outline-none focus:border-[#025dc7]" />
      </div>

      {lista.length ? (
        <ul className={`${TARJETA} divide-y divide-[#EEF2F9]`}>
          {lista.map((i) => (
            <Idea
              key={i.id}
              idea={i}
              datos={datos}
              abierta={abierta === i.id}
              onAbrir={() => setAbierta(abierta === i.id ? null : i.id)}
              cambiar={cambiar}
              borrar={borrar}
              onGuion={() => onGuion(i)}
            />
          ))}
        </ul>
      ) : (
        <p className={`${TARJETA} px-4 py-6 text-center text-[13.5px] text-[#6B7280]`}>
          {ideas.length ? 'Ninguna idea con esos filtros.' : 'Aún no hay ideas. Escribe una arriba o saca diez de golpe en «Prompts».'}
        </p>
      )}

      {pegando ? <PegarVarias orgId={orgId} token={token} datos={datos} formato={formato} objetivo={objetivo} onClose={() => setPegando(false)} onCreadas={anadir} /> : null}
    </div>
  )
}

function Idea({
  idea,
  datos,
  abierta,
  onAbrir,
  cambiar,
  borrar,
  onGuion,
}: { idea: ItemEstudio; datos: EstudioDatos; abierta: boolean; onAbrir: () => void; onGuion: () => void } & Pick<Accion, 'cambiar' | 'borrar'>) {
  const [titulo, setTitulo] = useState(idea.titulo)
  const [texto, setTexto] = useState(idea.texto)
  const caja = useRef<HTMLTextAreaElement>(null)
  useCajaQueCrece(caja, abierta ? texto : '', 0.5, 480)
  useEffect(() => {
    setTitulo(idea.titulo)
    setTexto(idea.texto)
  }, [idea.titulo, idea.texto, abierta])

  return (
    <li className="px-3.5 sm:px-4 py-3">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
        <button onClick={onAbrir} className="min-w-0 flex-1 text-left">
          <p className="text-[14.5px] font-medium text-[#111827] leading-snug">{idea.titulo}</p>
          <p className="mt-0.5 text-[12.5px] text-[#6B7280]">
            {nombreDe(datos.formatos, idea.formato) || 'Sin formato'}
            {idea.objetivo ? (
              <>
                {' · '}
                <span className="font-semibold" style={{ color: COLOR_OBJETIVO[idea.objetivo] }}>
                  {nombreDe(datos.objetivos, idea.objetivo)}
                </span>
              </>
            ) : null}
            {idea.texto ? ' · con guion' : ''}
            {idea.fecha ? ` · para el ${idea.fecha.slice(8, 10)}/${idea.fecha.slice(5, 7)}` : ''}
          </p>
        </button>
        <div className="flex flex-wrap items-center gap-1">
          {datos.canales.map((c) => {
            const dia = idea.canales[c.id]
            return (
              <button
                key={c.id}
                onClick={() => cambiar(idea.id, { canales: { [c.id]: !dia } })}
                title={dia ? `Publicado en ${c.nombre} el ${dia.slice(8, 10)}/${dia.slice(5, 7)}. Toca para quitarlo.` : `Marcar como publicado en ${c.nombre}`}
                className={`inline-flex items-center gap-1 h-7 pl-1.5 pr-2 rounded-md border text-[12px] font-medium transition-colors ${
                  dia ? 'border-[#BBE5C8] bg-[#F0FAF3] text-[#15803D]' : 'border-[#E2E8F4] bg-white text-[#6B7280] hover:border-[#B9CBEA]'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center ${dia ? 'border-[#16A34A]' : 'border-[#CBD5E1]'}`}>
                  {dia ? <Check size={9} strokeWidth={3.4} /> : null}
                </span>
                {c.nombre}
              </button>
            )
          })}
        </div>
      </div>

      {abierta ? (
        <div className="mt-3 space-y-3 rounded-lg bg-[#F7F9FE] p-3">
          <div>
            <label className={ETIQUETA}>La idea</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onBlur={() => titulo.trim() && titulo.trim() !== idea.titulo && cambiar(idea.id, { titulo: titulo.trim() })}
              className={CAMPO}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className={ETIQUETA}>Formato</label>
              <select value={idea.formato} onChange={(e) => cambiar(idea.id, { formato: e.target.value })} className={CAMPO}>
                <option value="">Sin formato</option>
                {datos.formatos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={ETIQUETA}>Objetivo</label>
              <select value={idea.objetivo} onChange={(e) => cambiar(idea.id, { objetivo: e.target.value })} className={CAMPO}>
                <option value="">Sin objetivo</option>
                {datos.objetivos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={ETIQUETA}>Para cuándo</label>
              <input type="date" value={idea.fecha} onChange={(e) => cambiar(idea.id, { fecha: e.target.value })} className={CAMPO} />
            </div>
          </div>
          <div>
            <label className={ETIQUETA}>Guion y notas</label>
            <textarea
              ref={caja}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={() => texto !== idea.texto && cambiar(idea.id, { texto })}
              rows={3}
              placeholder="Pega aquí el guion que te devuelva Claude, o apunta lo que quieras decir."
              className={CAMPO + ' resize-none'}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {idea.formato === 'reel' || idea.formato === 'carrusel' || idea.formato === 'tiktok' ? (
              <button onClick={onGuion} className={BOTON}>
                <Sparkles size={14} /> Prompt del guion
              </button>
            ) : null}
            <span className="flex-1" />
            <span className="text-[12px] text-[#9CA3AF]">
              {idea.autor} · {haceCuanto(idea.created_at)}
            </span>
            <button onClick={() => borrar(idea)} className="inline-flex items-center gap-1 text-[13px] font-medium text-red-600 hover:underline">
              <Trash2 size={13} /> Borrar
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

function PegarVarias({
  orgId,
  token,
  datos,
  formato: formatoInicial,
  objetivo: objetivoInicial,
  area = 'contenido',
  onClose,
  onCreadas,
}: {
  orgId: number
  token: string
  datos: EstudioDatos
  formato: string
  objetivo: string
  area?: string
  onClose: () => void
  onCreadas: (items: ItemEstudio[]) => void
}) {
  const [texto, setTexto] = useState('')
  const [formato, setFormato] = useState(formatoInicial)
  const [objetivo, setObjetivo] = useState(objetivoInicial)
  const [guardando, setGuardando] = useState(false)
  const lineas = texto.split('\n').filter((l) => l.trim().length > 2).length

  async function guardar() {
    setGuardando(true)
    try {
      const r = await crearVarias(orgId, { texto, formato, objetivo, area }, token)
      onCreadas(r.items)
      toast.success(`${r.items.length} ideas guardadas`)
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'No se pudieron guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[900] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl bg-white p-4 sm:p-5 pb-24 sm:pb-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-[#0a1656]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}>
            Pegar varias ideas
          </h3>
          <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F6FD]">
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-[13px] text-[#6B7280]">Una idea por línea. Los números y las viñetas de delante se quitan solos.</p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={9} autoFocus placeholder={'1. Reel · «…» · …\n2. Carrusel · «…» · …'} className={CAMPO + ' mt-3 resize-y'} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select value={formato} onChange={(e) => setFormato(e.target.value)} className={CAMPO}>
            <option value="">Sin formato</option>
            {datos.formatos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
          <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={CAMPO}>
            <option value="">Sin objetivo</option>
            {datos.objetivos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className={BOTON}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={!lineas || guardando} className={BOTON_PRINCIPAL}>
            {guardando ? <Loader2 size={14} className="animate-spin" /> : null} Guardar {lineas || ''} {lineas === 1 ? 'idea' : 'ideas'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Prompts ─────────────────────────────────────────────────────────── */

function Prompts({ orgId, token, datos, anadir, ideas, paraGuion }: Accion & { ideas: ItemEstudio[]; paraGuion: ItemEstudio | null }) {
  const [gen, setGen] = useState<Generador['id']>(paraGuion ? 'guion' : 'ideas')
  // Ideas para redes
  const [objetivo, setObjetivo] = useState<Objetivo>('alcance')
  const [formato, setFormato] = useState<'reel' | 'carrusel' | 'mezcla'>('mezcla')
  const [tema, setTema] = useState('')
  const [cuantas, setCuantas] = useState(10)
  // Guion
  const [idea, setIdea] = useState(paraGuion?.titulo || '')
  const [formatoGuion, setFormatoGuion] = useState<'reel' | 'carrusel'>(paraGuion?.formato === 'carrusel' ? 'carrusel' : 'reel')
  const [notas, setNotas] = useState(paraGuion?.texto || '')
  // Blog
  const [busqueda, setBusqueda] = useState('')
  // Clase
  const [tipo, setTipo] = useState<TipoClase>('semanal')
  const [minutos, setMinutos] = useState(60)
  const [alumnos, setAlumnos] = useState(8)
  const [modulo, setModulo] = useState('')
  const [leccion, setLeccion] = useState('')
  // Recurso
  const [tipoRecurso, setTipoRecurso] = useState<'guia' | 'frases' | 'carta' | 'sonido'>('frases')
  const [pegando, setPegando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!paraGuion) return
    setGen('guion')
    setIdea(paraGuion.titulo)
    setFormatoGuion(paraGuion.formato === 'carrusel' ? 'carrusel' : 'reel')
    setNotas(paraGuion.texto || '')
  }, [paraGuion])

  const modulos = useMemo(() => getModules(), [])
  const lecciones = useMemo(() => (modulo ? getAllLessonsForModule(modulo) : []), [modulo])
  const material = useMemo(() => {
    if (!modulo || !leccion) return ''
    const l: any = getLesson(modulo, leccion)
    return l ? materialDeLeccion(l.title || leccion, l.blocks || []) : ''
  }, [modulo, leccion])

  const elegido = GENERADORES.find((g) => g.id === gen) || GENERADORES[0]
  const prompt = useMemo(() => {
    if (gen === 'ideas')
      return promptIdeas({ objetivo, formato, tema, cuantas, yaTenemos: ideas.filter((i) => !i.objetivo || i.objetivo === objetivo).map((i) => i.titulo) })
    if (gen === 'guion') return promptGuion({ idea, formato: formatoGuion, objetivo: (paraGuion?.titulo === idea ? (paraGuion?.objetivo as Objetivo) : '') || '', notas })
    if (gen === 'blog') return promptBlog({ tema, busqueda })
    if (gen === 'comunidad') return promptComunidad({ semana: tema, cuantas: Math.min(cuantas, 15) })
    if (gen === 'clase') return promptClase({ tipo, tema, minutos, alumnos, material, notas })
    return promptRecurso({ tema, tipo: tipoRecurso })
  }, [gen, objetivo, formato, tema, cuantas, ideas, idea, formatoGuion, notas, busqueda, tipo, minutos, alumnos, material, tipoRecurso, paraGuion])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      toast.error('No se pudo copiar: selecciona el texto y cópialo a mano')
    }
  }

  const TEMA: Record<Generador['id'], { etiqueta: string; ejemplo: string }> = {
    ideas: { etiqueta: 'Tema de la tanda (opcional)', ejemplo: 'Pronunciación · la vida en el súper · Black Friday…' },
    guion: { etiqueta: '', ejemplo: '' },
    blog: { etiqueta: 'De qué va el artículo', ejemplo: 'Cómo pedir cita con el huisarts en neerlandés' },
    comunidad: { etiqueta: 'De qué va la semana (opcional)', ejemplo: 'Esta semana la clase es «Mijn huis»; el martes es Sint-Maarten' },
    clase: { etiqueta: 'Tema de la clase', ejemplo: 'Mijn huis' },
    recurso: { etiqueta: 'De qué es el recurso', ejemplo: 'Pedir cita y explicar qué te pasa en el huisarts' },
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
      <div className="flex lg:flex-col gap-1.5 overflow-x-auto pb-0.5">
        {GENERADORES.map((g) => (
          <button
            key={g.id}
            onClick={() => setGen(g.id)}
            className={`shrink-0 lg:shrink text-left rounded-lg border px-3 py-2.5 transition-colors ${
              gen === g.id ? 'border-[#1D0084] bg-[#F4F2FF]' : 'border-[#E2E8F4] bg-white hover:border-[#B9CBEA]'
            }`}
          >
            <span className="block text-[13.5px] font-semibold text-[#0a1656] whitespace-nowrap lg:whitespace-normal">{g.nombre}</span>
            <span className="hidden lg:block mt-0.5 text-[12.5px] leading-snug text-[#6B7280]">{g.que}</span>
          </button>
        ))}
      </div>

      <div className="min-w-0 space-y-3">
        <div className={`${TARJETA} p-3 sm:p-4 space-y-3`}>
          <p className="lg:hidden text-[13px] text-[#6B7280]">{elegido.que}</p>

          {gen === 'ideas' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className={ETIQUETA}>Qué buscas</label>
                <select value={objetivo} onChange={(e) => setObjetivo(e.target.value as Objetivo)} className={CAMPO}>
                  <option value="alcance">Alcance (que nos descubran)</option>
                  <option value="comunidad">Comunidad (que comenten y guarden)</option>
                  <option value="ventas">Ventas (que pidan la llamada)</option>
                </select>
              </div>
              <div>
                <label className={ETIQUETA}>Formato</label>
                <select value={formato} onChange={(e) => setFormato(e.target.value as any)} className={CAMPO}>
                  <option value="mezcla">Reels y carruseles</option>
                  <option value="reel">Solo reels</option>
                  <option value="carrusel">Solo carruseles</option>
                </select>
              </div>
              <div>
                <label className={ETIQUETA}>Cuántas</label>
                <input type="number" min={3} max={30} value={cuantas} onChange={(e) => setCuantas(Number(e.target.value) || 10)} className={CAMPO} />
              </div>
            </div>
          ) : null}

          {gen === 'guion' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-2">
                <div>
                  <label className={ETIQUETA}>La idea</label>
                  <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Reel · «Llevas dos años diciendo esto mal en el súper»" className={CAMPO} />
                </div>
                <div>
                  <label className={ETIQUETA}>Formato</label>
                  <select value={formatoGuion} onChange={(e) => setFormatoGuion(e.target.value as any)} className={CAMPO}>
                    <option value="reel">Reel o TikTok</option>
                    <option value="carrusel">Carrusel</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={ETIQUETA}>Lo que ya tienes pensado (opcional)</label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={CAMPO + ' resize-y'} />
              </div>
            </>
          ) : null}

          {gen === 'clase' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className={ETIQUETA}>Qué clase</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoClase)} className={CAMPO}>
                  <option value="semanal">Clase semanal (dossier A4)</option>
                  <option value="masterclass">Masterclass (diapositivas)</option>
                  <option value="spreekclub">Spreekclub (guía de conversación)</option>
                </select>
              </div>
              <div>
                <label className={ETIQUETA}>Minutos</label>
                <input type="number" min={20} max={120} value={minutos} onChange={(e) => setMinutos(Number(e.target.value) || 60)} className={CAMPO} />
              </div>
              <div>
                <label className={ETIQUETA}>Alumnos (más o menos)</label>
                <input type="number" min={1} max={60} value={alumnos} onChange={(e) => setAlumnos(Number(e.target.value) || 8)} className={CAMPO} />
              </div>
            </div>
          ) : null}

          {gen === 'recurso' ? (
            <div>
              <label className={ETIQUETA}>Qué tipo de recurso</label>
              <select value={tipoRecurso} onChange={(e) => setTipoRecurso(e.target.value as any)} className={CAMPO}>
                <option value="frases">Frases para una situación</option>
                <option value="guia">Un trámite paso a paso</option>
                <option value="carta">Una carta explicada</option>
                <option value="sonido">Un sonido difícil</option>
              </select>
            </div>
          ) : null}

          {TEMA[gen].etiqueta ? (
            <div>
              <label className={ETIQUETA}>{TEMA[gen].etiqueta}</label>
              <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder={TEMA[gen].ejemplo} className={CAMPO} />
            </div>
          ) : null}

          {gen === 'blog' ? (
            <div>
              <label className={ETIQUETA}>Lo que escribe en Google quien tiene que llegar (opcional)</label>
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="pedir cita médico holanda en neerlandés" className={CAMPO} />
            </div>
          ) : null}

          {gen === 'clase' ? (
            <>
              <div>
                <label className={ETIQUETA}>Lección de la escuela de la que parte (opcional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={modulo}
                    onChange={(e) => {
                      setModulo(e.target.value)
                      setLeccion('')
                    }}
                    className={CAMPO}
                  >
                    <option value="">Elige un módulo…</option>
                    {modulos.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                  <select value={leccion} onChange={(e) => setLeccion(e.target.value)} disabled={!modulo} className={CAMPO}>
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
                    {material ? 'El prompt lleva el vocabulario y las frases de esa lección, para que la clase siga lo que ya han visto.' : 'Esa lección no tiene vocabulario ni frases que pasar.'}
                  </p>
                ) : null}
              </div>
              <div>
                <label className={ETIQUETA}>Algo que quieras en esta clase (opcional)</label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Que la situación real sea llamar al casero. Que repasen los sonidos ui y eu." className={CAMPO + ' resize-y'} />
              </div>
            </>
          ) : null}
        </div>

        <div className={`${TARJETA} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF2F9] px-3 sm:px-4 py-2.5">
            <p className="flex-1 min-w-0 text-[13px] text-[#374151]">
              <span className="font-semibold text-[#0a1656]">El prompt.</span> Cópialo y pégalo en un proyecto nuevo de {elegido.donde}.
            </p>
            <button onClick={copiar} className={BOTON_PRINCIPAL}>
              {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? 'Copiado' : 'Copiar'}
            </button>
            <a href="https://claude.ai/new" target="_blank" rel="noreferrer" className={BOTON}>
              Abrir Claude <ExternalLink size={13} />
            </a>
          </div>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words px-3 sm:px-4 py-3 text-[12.5px] leading-relaxed text-[#1F2937] font-sans">{prompt}</pre>
        </div>

        {gen === 'ideas' || gen === 'comunidad' ? (
          <button onClick={() => setPegando(true)} className={BOTON}>
            <ClipboardPaste size={14} /> Pegar lo que te ha devuelto y guardarlo como ideas
          </button>
        ) : null}
        {gen === 'clase' ? (
          <p className="text-[12.5px] text-[#6B7280]">
            Cuando Claude Design te dé el PDF, súbelo en la clase («Nueva semana» o «Nueva sesión»). Sirve el mismo para los dos grupos.
          </p>
        ) : null}
      </div>

      {pegando ? (
        <PegarVarias
          orgId={orgId}
          token={token}
          datos={datos}
          formato={gen === 'comunidad' ? 'comunidad' : formato === 'mezcla' ? '' : formato}
          objetivo={gen === 'comunidad' ? 'comunidad' : objetivo}
          area={gen === 'comunidad' ? 'comunidad' : 'contenido'}
          onClose={() => setPegando(false)}
          onCreadas={anadir}
        />
      ) : null}
    </div>
  )
}
