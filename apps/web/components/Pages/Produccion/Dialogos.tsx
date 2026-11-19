'use client'
/**
 * Las ventanas pequeñas de los tableros de producción (19/11/2026): curso
 * nuevo y sus ajustes, tablero nuevo, duplicar e importar de Nextcloud.
 */
import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Trash, X } from '@phosphor-icons/react'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import { confirmar } from '@/lib/nawar/confirmar'
import { COLORES } from '@/lib/nawar/produccion'
import {
  borrarCurso,
  borrarEtiqueta,
  cambiarCurso,
  cambiarEtiqueta,
  crearCurso,
  crearEtiqueta,
  crearTablero,
  duplicarTablero,
  importarNextcloud,
  listarNextcloud,
  type Curso,
  type ResultadoImportar,
  type TableroNextcloud,
  type TableroResumen,
} from '@services/produccion/produccion'
import EditorDescripcion from './EditorDescripcion'
import { POPPINS } from '@components/Pages/Equipo/estilo'

export const CAMPO = 'w-full h-10 rounded-lg border border-[#E2E7F0] px-3 text-[14px] outline-none focus:border-[#0b2da0] focus:ring-[3px] focus:ring-[#0b2da0]/10'
export const PRIMARIO = 'h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold hover:bg-[#0a2690] disabled:opacity-40'
export const SECUNDARIO = 'h-10 px-4 rounded-lg border border-[#E2E7F0] text-[14px] font-medium text-[#3B4262] hover:bg-[#F6F8FC]'

export function Ventana({ titulo, onCerrar, children, ancho = 520 }: { titulo: string; onCerrar: () => void; children: React.ReactNode; ancho?: number }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onCerrar])
  return (
    <EnElCuerpo>
      <div className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true">
        <button aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-[#0B1033]/40" />
        <div style={{ maxWidth: ancho }} className="relative w-full max-h-[92vh] bg-white rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#EEF1F7]">
            <h2 className="text-[17px] font-semibold text-[#0B1033]" style={POPPINS}>
              {titulo}
            </h2>
            <button onClick={onCerrar} aria-label="Cerrar" className="w-9 h-9 -mr-2 rounded-lg flex items-center justify-center text-[#4A5272] hover:bg-[#F1F4FA]">
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 sm:px-6 py-5">{children}</div>
        </div>
      </div>
    </EnElCuerpo>
  )
}

export function ElegirColor({ valor, onCambio }: { valor: string; onCambio: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onCambio(c)}
          aria-label={`Color ${c}`}
          className={`w-8 h-8 rounded-full ring-offset-2 ${valor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-[#0B1033]' : ''}`}
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <label className="block text-[13px] font-semibold text-[#0a1656] mb-1.5">{children}</label>
}

export function NuevoCurso({ orgId, token, onHecho, onCerrar }: { orgId: number; token: string; onHecho: (c: Curso) => void; onCerrar: () => void }) {
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES[2])
  const [enviando, setEnviando] = useState(false)
  async function crear() {
    setEnviando(true)
    try {
      onHecho(await crearCurso(orgId, { nombre, color }, token))
      onCerrar()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido crear')
    }
    setEnviando(false)
  }
  return (
    <Ventana titulo="Nuevo curso" onCerrar={onCerrar}>
      <p className="text-[13.5px] text-[#5B6382] mb-4">Cada curso (A0-A1, A1-A2…) tiene sus tableros, sus etiquetas y su plantilla para las tarjetas.</p>
      <Etiqueta>Nombre</Etiqueta>
      <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nombre.trim() && crear()} placeholder="A1-A2" className={CAMPO} />
      <div className="mt-4">
        <Etiqueta>Color</Etiqueta>
        <ElegirColor valor={color} onCambio={setColor} />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onCerrar} className={SECUNDARIO}>
          Cancelar
        </button>
        <button onClick={crear} disabled={!nombre.trim() || enviando} className={PRIMARIO}>
          Crear el curso
        </button>
      </div>
    </Ventana>
  )
}

export function AjustesCurso({
  orgId,
  token,
  curso,
  onCambio,
  onBorrado,
  onCerrar,
}: {
  orgId: number
  token: string
  curso: Curso
  onCambio: () => void
  onBorrado: () => void
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState(curso.nombre)
  const [color, setColor] = useState(curso.color)
  const [plantilla, setPlantilla] = useState(curso.plantilla)
  const [etiquetas, setEtiquetas] = useState(curso.etiquetas)
  const [nueva, setNueva] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function guardar() {
    setEnviando(true)
    try {
      await cambiarCurso(orgId, curso.id, { nombre, color, plantilla }, token)
      toast.success('Guardado')
      onCambio()
      onCerrar()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido guardar')
    }
    setEnviando(false)
  }

  async function cambiarE(id: number, d: { nombre?: string; color?: string }) {
    try {
      const e = await cambiarEtiqueta(orgId, id, d, token)
      setEtiquetas((l) => l.map((x) => (x.id === id ? e : x)))
    } catch (err: any) {
      toast.error(err?.message || 'No se ha podido cambiar')
    }
  }

  async function quitarE(id: number, n: string) {
    if (!(await confirmar(`¿Borrar la etiqueta «${n}»? Se quita de todas las tarjetas del curso.`, { boton: 'Borrar', peligro: true }))) return
    try {
      await borrarEtiqueta(orgId, id, token)
      setEtiquetas((l) => l.filter((x) => x.id !== id))
    } catch (err: any) {
      toast.error(err?.message || 'No se ha podido borrar')
    }
  }

  async function anadirE() {
    if (!nueva.trim()) return
    try {
      const e = await crearEtiqueta(orgId, curso.id, { nombre: nueva.trim(), color: COLORES[etiquetas.length % COLORES.length] }, token)
      setEtiquetas((l) => (l.some((x) => x.id === e.id) ? l : [...l, e]))
      setNueva('')
    } catch (err: any) {
      toast.error(err?.message || 'No se ha podido crear')
    }
  }

  async function borrar() {
    const n = curso.tableros.length
    if (
      !(await confirmar(
        `¿Borrar el curso «${curso.nombre}»? Se borran sus ${n} tablero${n === 1 ? '' : 's'} con todas sus tarjetas, adjuntos y comentarios. No se puede deshacer.`,
        { boton: 'Borrar el curso', peligro: true }
      ))
    )
      return
    try {
      await borrarCurso(orgId, curso.id, token)
      onBorrado()
      onCerrar()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido borrar')
    }
  }

  return (
    <Ventana titulo={`Ajustes de ${curso.nombre}`} onCerrar={onCerrar} ancho={680}>
      <Etiqueta>Nombre</Etiqueta>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />
      <div className="mt-4">
        <Etiqueta>Color</Etiqueta>
        <ElegirColor valor={color} onCambio={setColor} />
      </div>

      <div className="mt-6">
        <Etiqueta>Etiquetas del curso</Etiqueta>
        <ul className="space-y-1.5">
          {etiquetas.map((e) => (
            <li key={e.id} className="flex items-center gap-2">
              <input
                type="color"
                value={e.color}
                onChange={(ev) => setEtiquetas((l) => l.map((x) => (x.id === e.id ? { ...x, color: ev.target.value } : x)))}
                onBlur={(ev) => cambiarE(e.id, { color: ev.target.value })}
                className="w-9 h-9 rounded-lg border border-[#E2E7F0] p-1 bg-white"
                aria-label="Color"
              />
              <input
                defaultValue={e.nombre}
                onBlur={(ev) => ev.target.value.trim() && ev.target.value.trim() !== e.nombre && cambiarE(e.id, { nombre: ev.target.value.trim() })}
                className={CAMPO}
              />
              <button onClick={() => quitarE(e.id, e.nombre)} aria-label="Borrar la etiqueta" className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-[#8A93B3] hover:text-[#B42318] hover:bg-[#FEF3F2]">
                <Trash size={16} />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input value={nueva} onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && anadirE()} placeholder="Etiqueta nueva" className={CAMPO} />
          <button onClick={anadirE} disabled={!nueva.trim()} className={SECUNDARIO}>
            Añadir
          </button>
        </div>
      </div>

      <div className="mt-6">
        <Etiqueta>Plantilla de las tarjetas nuevas</Etiqueta>
        <p className="text-[12.5px] text-[#6B7393] mb-1">Lo que lleva escrito cada tarjeta al crearla: la descripción, los objetivos, dónde van los entregables…</p>
        <div className="rounded-xl border border-[#E2E7F0] px-3">
          <EditorDescripcion id={curso.id} inicial={curso.plantilla} onCambio={setPlantilla} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <button onClick={borrar} className="h-10 px-3 rounded-lg text-[14px] font-medium text-[#B42318] hover:bg-[#FEF3F2]">
          Borrar el curso
        </button>
        <div className="flex gap-2">
          <button onClick={onCerrar} className={SECUNDARIO}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={!nombre.trim() || enviando} className={PRIMARIO}>
            Guardar
          </button>
        </div>
      </div>
    </Ventana>
  )
}

export function NuevoTablero({
  orgId,
  token,
  cursos,
  cursoId,
  onHecho,
  onCerrar,
}: {
  orgId: number
  token: string
  cursos: Curso[]
  cursoId: number
  onHecho: (t: TableroResumen) => void
  onCerrar: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [curso, setCurso] = useState(cursoId)
  const [color, setColor] = useState(cursos.find((c) => c.id === cursoId)?.color || COLORES[0])
  const [enviando, setEnviando] = useState(false)
  async function crear() {
    setEnviando(true)
    try {
      onHecho(await crearTablero(orgId, { titulo, color, curso_id: curso }, token))
      onCerrar()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido crear')
    }
    setEnviando(false)
  }
  return (
    <Ventana titulo="Nuevo tablero" onCerrar={onCerrar}>
      <Etiqueta>Nombre</Etiqueta>
      <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && titulo.trim() && crear()} placeholder="A2 · Module 01" className={CAMPO} />
      <div className="mt-4">
        <Etiqueta>Curso</Etiqueta>
        <select value={curso} onChange={(e) => setCurso(Number(e.target.value))} className={CAMPO}>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4">
        <Etiqueta>Color</Etiqueta>
        <ElegirColor valor={color} onCambio={setColor} />
      </div>
      <p className="mt-4 text-[12.5px] text-[#6B7393]">Nace con las columnas de siempre: Niet begonnen, Aan het opnemen, Ingeleverd, Revisie nodig y Klaar. Se pueden cambiar.</p>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onCerrar} className={SECUNDARIO}>
          Cancelar
        </button>
        <button onClick={crear} disabled={!titulo.trim() || enviando} className={PRIMARIO}>
          Crear el tablero
        </button>
      </div>
    </Ventana>
  )
}

export function Duplicar({
  orgId,
  token,
  cursos,
  tablero,
  onHecho,
  onCerrar,
}: {
  orgId: number
  token: string
  cursos: Curso[]
  tablero: TableroResumen
  onHecho: (t: TableroResumen) => void
  onCerrar: () => void
}) {
  const [titulo, setTitulo] = useState(`${tablero.titulo} (copia)`)
  const [curso, setCurso] = useState(tablero.curso_id)
  const [conTarjetas, setConTarjetas] = useState(true)
  const [enviando, setEnviando] = useState(false)
  async function crear() {
    setEnviando(true)
    try {
      onHecho(await duplicarTablero(orgId, tablero.id, { titulo, curso_id: curso, con_tarjetas: conTarjetas }, token))
      toast.success('Tablero duplicado')
      onCerrar()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido duplicar')
    }
    setEnviando(false)
  }
  return (
    <Ventana titulo="Duplicar el tablero" onCerrar={onCerrar}>
      <p className="text-[13.5px] text-[#5B6382] mb-4">Para preparar otro módulo u otro nivel a partir de este: por ejemplo, el «A1 Module 01» como base del «A2 Module 01».</p>
      <Etiqueta>Nombre de la copia</Etiqueta>
      <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} className={CAMPO} />
      <div className="mt-4">
        <Etiqueta>En el curso</Etiqueta>
        <select value={curso} onChange={(e) => setCurso(Number(e.target.value))} className={CAMPO}>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
      <label className="mt-4 flex items-start gap-2.5 text-[14px] text-[#1A2040]">
        <input type="checkbox" checked={conTarjetas} onChange={(e) => setConTarjetas(e.target.checked)} className="mt-1" />
        <span>
          Copiar también las tarjetas
          <span className="block text-[12.5px] text-[#6B7393]">Con su título, descripción, etiquetas y enlaces, todas en la primera columna. Sin fechas, personas, archivos ni comentarios.</span>
        </span>
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onCerrar} className={SECUNDARIO}>
          Cancelar
        </button>
        <button onClick={crear} disabled={!titulo.trim() || enviando} className={PRIMARIO}>
          Duplicar
        </button>
      </div>
    </Ventana>
  )
}

export function ImportarNextcloud({
  orgId,
  token,
  cursos,
  cursoId,
  onHecho,
  onCerrar,
}: {
  orgId: number
  token: string
  cursos: Curso[]
  cursoId: number
  onHecho: () => void
  onCerrar: () => void
}) {
  const [url, setUrl] = useState('https://portal.nawar.es')
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [lista, setLista] = useState<TableroNextcloud[] | null>(null)
  const [elegidos, setElegidos] = useState<number[]>([])
  const [curso, setCurso] = useState(cursoId)
  const [conArchivadas, setConArchivadas] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<ResultadoImportar | null>(null)

  async function conectar() {
    setEnviando(true)
    setError('')
    try {
      const l = await listarNextcloud(orgId, { url, usuario, clave }, token)
      setLista(l)
      setElegidos(l.filter((t) => !t.archivado).map((t) => t.id))
    } catch (e: any) {
      setError(e?.message || 'No se ha podido conectar')
    }
    setEnviando(false)
  }

  async function importar() {
    setEnviando(true)
    setError('')
    try {
      const r = await importarNextcloud(orgId, { url, usuario, clave, curso_id: curso, tableros: elegidos, con_archivadas: conArchivadas }, token)
      setResultado(r)
      setClave('')
      onHecho()
    } catch (e: any) {
      setError(e?.message || 'No se ha podido importar')
    }
    setEnviando(false)
  }

  return (
    <Ventana titulo="Traer los tableros de Nextcloud" onCerrar={onCerrar} ancho={620}>
      {resultado ? (
        <div>
          <p className="text-[14px] text-[#1A2040]">Hecho. Esto es lo que ha traído:</p>
          <ul className="mt-3 divide-y divide-[#EEF1F7] rounded-xl border border-[#E9EDF5]">
            {resultado.tableros.map((t) => (
              <li key={t.id} className="px-3.5 py-2.5 text-[13.5px]">
                <p className="font-semibold text-[#0B1033]">{t.titulo}</p>
                {t.error ? (
                  <p className="text-[#B42318]">No se ha podido: {t.error}</p>
                ) : (
                  <p className="text-[#5B6382]">
                    {t.creado ? 'Tablero nuevo' : 'Ya estaba: solo se añadió lo que faltaba'} · {t.nuevas || 0} tarjeta{t.nuevas === 1 ? '' : 's'} nueva{t.nuevas === 1 ? '' : 's'}
                    {t.ya_estaban ? ` · ${t.ya_estaban} ya estaban` : ''}
                  </p>
                )}
                {(t.avisos || []).map((a, i) => (
                  <p key={i} className="text-[12.5px] text-[#8A6A2A]">
                    {a}
                  </p>
                ))}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-[#6B7393]">
            Los archivos adjuntos se quedan en Nextcloud: cada tarjeta lleva un enlace a cada uno. Puedes volver a importar cuando quieras: lo que ya está no se repite.
          </p>
          <div className="mt-5 flex justify-end">
            <button onClick={onCerrar} className={PRIMARIO}>
              Ver los tableros
            </button>
          </div>
        </div>
      ) : !lista ? (
        <div>
          <p className="text-[13.5px] text-[#5B6382]">
            La escuela se conecta a tu Nextcloud solo para copiar los tableros. La contraseña <strong>no se guarda</strong>. Usa una contraseña de aplicación: en Nextcloud, tu foto → Configuración personal → Seguridad → «Crear nueva contraseña de aplicación». Cuando acabes, la puedes borrar ahí mismo.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Etiqueta>Dirección de Nextcloud</Etiqueta>
              <input value={url} onChange={(e) => setUrl(e.target.value)} className={CAMPO} />
            </div>
            <div>
              <Etiqueta>Usuario</Etiqueta>
              <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="off" className={CAMPO} />
            </div>
            <div>
              <Etiqueta>Contraseña de aplicación</Etiqueta>
              <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" className={CAMPO} />
            </div>
          </div>
          {error ? <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] text-red-700">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={onCerrar} className={SECUNDARIO}>
              Cancelar
            </button>
            <button onClick={conectar} disabled={!url.trim() || !usuario.trim() || !clave || enviando} className={PRIMARIO}>
              {enviando ? 'Conectando…' : 'Conectar'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <Etiqueta>Qué tableros traer</Etiqueta>
            <button onClick={() => setElegidos(elegidos.length === lista.length ? [] : lista.map((t) => t.id))} className="text-[12.5px] font-semibold text-[#0b2da0]">
              {elegidos.length === lista.length ? 'Ninguno' : 'Todos'}
            </button>
          </div>
          <ul className="max-h-[300px] overflow-y-auto rounded-xl border border-[#E9EDF5] divide-y divide-[#EEF1F7]">
            {lista.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-2.5 px-3 py-2 text-[14px]">
                  <input type="checkbox" checked={elegidos.includes(t.id)} onChange={(e) => setElegidos((l) => (e.target.checked ? [...l, t.id] : l.filter((x) => x !== t.id)))} />
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="flex-1 min-w-0 truncate">{t.titulo}</span>
                  {t.archivado ? <span className="text-[11.5px] text-[#8A93B3]">archivado</span> : null}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Etiqueta>Ponerlos en el curso</Etiqueta>
            <select value={curso} onChange={(e) => setCurso(Number(e.target.value))} className={CAMPO}>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13.5px] text-[#1A2040]">
            <input type="checkbox" checked={conArchivadas} onChange={(e) => setConArchivadas(e.target.checked)} />
            Traer también las tarjetas archivadas (quedan archivadas)
          </label>
          {error ? <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] text-red-700">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setLista(null)} className={SECUNDARIO}>
              Atrás
            </button>
            <button onClick={importar} disabled={!elegidos.length || enviando} className={PRIMARIO}>
              {enviando ? 'Importando… (puede tardar un minuto)' : `Importar ${elegidos.length} tablero${elegidos.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </Ventana>
  )
}
