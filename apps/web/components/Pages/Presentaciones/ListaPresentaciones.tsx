'use client'
/**
 * Las presentaciones de UNA clase, en un solo sitio (22/11/2026).
 *
 * Usuario: «un profe subió una presentación que no era en pizarra y tomó
 * notas ahí; ahora cómo se saca esa, dónde está, dónde se guardó, cómo
 * metemos la que sí es… nadie sabemos dónde están las presentaciones ni cuál
 * está en pizarra».
 *
 * Cada PDF de la clase es una fila que dice: quién la ve (solo el equipo, o
 * también los alumnos antes de la clase), si tiene notas de la pizarra y de
 * quién, si es la que abre la pizarra y si de ella salió la versión que ven
 * los alumnos después. Cada presentación guarda SUS notas: cambiar de una a
 * otra no pisa nada, y las notas se pueden pasar de una a otra.
 *
 * Es la misma pieza en la ficha de la clase y dentro de la pizarra
 * (`compacta`). Los datos y las reglas: apps/api/src/services/tareas/pizarra.py.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { Loader2, MoreHorizontal, UploadCloud } from 'lucide-react'
import { confirmar } from '@/lib/nawar/confirmar'
import { actividadDe, archivoDe, cuandoFue, destinosPara, quienLaVe, textoNotas } from '@/lib/nawar/presentaciones'
import { updateActivity } from '@services/courses/activities'
import {
  borrarNotas,
  descargarFuente,
  getPizarra,
  getSesiones,
  listaDe,
  nombrarPresentacion,
  pasarASesion,
  pasarNotas,
  PIZARRA_EN_BLANCO,
  ponerEnPizarra,
  type ListaPresentaciones as Lista,
  type NotasSueltas,
  type OtraSesion,
  type Presentacion,
} from '@services/pizarra/pizarra'
import { cambiarArchivoProfe, diaCorto, getGemela, nombreProfe, quitarProfe, subirArchivoProfe, type Gemela } from '@services/tareas/tareas'
import { llevarNotas, ponerPresentacion } from '@components/Pages/Courses/PresentacionAlumnos'
import { VisorPresentacionClase } from '@components/Pages/Clases/pasosSemana'

export interface PropsListaPresentaciones {
  semanaId: number
  token: string
  /** El capítulo de la semana: con él se puede subir «también para los alumnos». */
  chapterId?: number | null
  /** Dentro de la pizarra: filas más bajas y sin la zona grande de subir. */
  compacta?: boolean
  /** En la pizarra: la que está abierta ahora (se marca y no se puede volver a abrir). */
  abierta?: string
  /** En la pizarra: abrir otra sin salir. Sin él, «Abrir en la pizarra» es un enlace. */
  onAbrir?: (id: string) => void | Promise<void>
  /** Antes de cambiar algo: que la pizarra guarde lo último que se escribió. */
  antesDeCambiar?: () => Promise<unknown>
  /** Al cambiar este número, la lista se vuelve a leer (algo cambió fuera). */
  version?: number
  /** Lo que ya se sabe (la pizarra ya lo ha leído): no se vuelve a pedir. */
  inicial?: Lista | null
  /** Tras cada cambio (y al leer la primera vez), con la lista nueva. */
  onCambio?: (lista: Lista, que: 'leida' | 'cambio') => void
}

const BOTON =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E2E7F0] bg-white px-3.5 text-[13.5px] font-semibold text-[#0B1033] transition-colors hover:border-[#C9D3E6] hover:bg-[#F7F9FD] disabled:opacity-50'
const BOTON_AZUL =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0b2da0] px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0a2690] disabled:opacity-60'
const ENLACE = 'text-[13px] font-semibold text-[#0b2da0] hover:underline disabled:opacity-50'

const esPdf = (f: File) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf'

/** Un punto de color y su texto: así se dice el estado, sin cajitas. */
function Estado({ color, children }: { color?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${color ? 'text-[#2B3150]' : 'text-[#8A91AD]'}`}>
      {color ? <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} /> : null}
      <span>{children}</span>
    </span>
  )
}

function IconoPdf({ blanco }: { blanco?: boolean }) {
  return (
    <span
      aria-hidden
      className="flex h-[42px] w-[34px] shrink-0 items-end justify-center rounded-[5px] border border-[#D5DCEA] pb-[5px] text-[9px] font-semibold tracking-[0.02em] text-[#8A93B0]"
      style={{ background: 'linear-gradient(#fff, #F7F9FD)' }}
    >
      {blanco ? '' : 'PDF'}
    </span>
  )
}

/** «3 páginas · Paul, el 12 nov» de unas notas sin presentación. */
function detalleSuelta(s: NotasSueltas): string {
  const paginas = s.paginas ? `${s.paginas} ${s.paginas === 1 ? 'página' : 'páginas'}` : ''
  return [paginas, [s.por, cuandoFue(s.at)].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
}

type Accion = { texto: string; nota?: string; rojo?: boolean; raya?: boolean; hacer: () => void }

/** El menú «⋯»: colgado del cuerpo de la página para que ningún panel lo corte. */
function Menu({ ancla, acciones, onCerrar }: { ancla: HTMLElement; acciones: Accion[]; onCerrar: () => void }) {
  const caja = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const r = ancla.getBoundingClientRect()
    const ancho = 264
    const alto = caja.current?.offsetHeight || 300
    const left = Math.max(8, Math.min(window.innerWidth - ancho - 8, r.right - ancho))
    const cabeAbajo = r.bottom + 6 + alto <= window.innerHeight - 8
    const top = cabeAbajo ? r.bottom + 6 : Math.max(8, r.top - 6 - alto)
    setPos({ left, top })
  }, [ancla, acciones.length])
  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      if (caja.current?.contains(e.target as Node) || ancla.contains(e.target as Node)) return
      onCerrar()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCerrar()
      }
    }
    const mover = () => onCerrar()
    window.addEventListener('pointerdown', fuera, true)
    window.addEventListener('keydown', tecla, true)
    window.addEventListener('resize', mover)
    window.addEventListener('scroll', mover, true)
    return () => {
      window.removeEventListener('pointerdown', fuera, true)
      window.removeEventListener('keydown', tecla, true)
      window.removeEventListener('resize', mover)
      window.removeEventListener('scroll', mover, true)
    }
  }, [ancla, onCerrar])
  return createPortal(
    <div
      ref={caja}
      role="menu"
      className="fixed z-[999] w-[264px] rounded-xl border border-[#E3E8F2] bg-white p-1.5 text-[13.5px] text-[#0B1033]"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, boxShadow: '0 12px 30px rgba(11,16,51,.12)' }}
    >
      {acciones.map((a, k) => (
        <React.Fragment key={a.texto}>
          {a.raya && k > 0 ? <div className="my-1 border-t border-[#EEF1F7]" /> : null}
          <button
            role="menuitem"
            onClick={() => {
              onCerrar()
              a.hacer()
            }}
            className={`block w-full rounded-[7px] px-2.5 py-2 text-left transition-colors hover:bg-[#F3F6FC] ${a.rojo ? 'text-[#B42323]' : ''}`}
          >
            {a.texto}
            {a.nota ? <span className="text-[#8A91AD]"> · {a.nota}</span> : null}
          </button>
        </React.Fragment>
      ))}
    </div>,
    document.body
  )
}

export default function ListaPresentaciones(p: PropsListaPresentaciones) {
  const { semanaId, token, compacta } = p
  const [lista, setLista] = useState<Lista | null>(p.inicial || null)
  const [fallo, setFallo] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [menu, setMenu] = useState<{ id: string; ancla: HTMLElement } | null>(null)
  const [pasando, setPasando] = useState('') // de cuál se están pasando las notas
  // A otra sesión de la misma clase: cuál se pasa y las sesiones que hay.
  const [aSesion, setASesion] = useState('')
  const [sesiones, setSesiones] = useState<OtraSesion[] | null>(null)
  const [renombrando, setRenombrando] = useState<{ id: string; nombre: string } | null>(null)
  const [paraQuien, setParaQuien] = useState<'equipo' | 'alumnos'>('equipo')
  const [encima, setEncima] = useState(false)
  const [pendiente, setPendiente] = useState<File | null>(null) // para los alumnos: se confirma antes
  const [gemela, setGemela] = useState<Gemela | null>(null)
  const [tambien, setTambien] = useState(false)
  const [viendo, setViendo] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const entradaCambio = useRef<HTMLInputElement>(null)
  const cambiando = useRef('')
  const onCambio = useRef(p.onCambio)
  onCambio.current = p.onCambio

  const poner = useCallback((l: Lista, que: 'leida' | 'cambio' = 'cambio') => {
    setLista(l)
    onCambio.current?.(l, que)
  }, [])

  const leer = useCallback(
    async (que: 'leida' | 'cambio' = 'cambio') => {
      try {
        poner(listaDe(await getPizarra(semanaId, token)), que)
        setFallo('')
      } catch (e: any) {
        setFallo(e?.message || 'No se han podido leer las presentaciones')
      }
    },
    [semanaId, token, poner]
  )

  useEffect(() => {
    if (p.inicial) setLista(p.inicial)
    else if (token) leer('leida')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaId, token, p.inicial])

  useEffect(() => {
    if (p.version) leer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.version])

  // La clase del otro grupo, para ofrecer cambiar allí también la de los alumnos.
  useEffect(() => {
    if (!p.chapterId || compacta) return
    let vivo = true
    getGemela(semanaId, token)
      .then((r) => vivo && setGemela(r.gemela))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [semanaId, token, p.chapterId, compacta])

  /** Hace algo con el aviso de «ocupado» y los errores en español. */
  const hacer = async (clave: string, tarea: () => Promise<void>) => {
    setOcupado(clave)
    try {
      await p.antesDeCambiar?.()
      await tarea()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido hacer')
    } finally {
      setOcupado('')
    }
  }

  const deAlumnos = (lista?.presentaciones || []).filter((x) => x.de === 'alumnos')

  // ── Subir ───────────────────────────────────────────────────────────────
  const elegir = (archivos: FileList | File[] | null | undefined) => {
    const todos = Array.from(archivos || [])
    if (entrada.current) entrada.current.value = ''
    if (!todos.length) return
    const pdfs = todos.filter(esPdf)
    if (!pdfs.length) {
      toast.error('Tiene que ser un PDF. Desde PowerPoint, Keynote, Canva o Claude: «Exportar → PDF».')
      return
    }
    if (paraQuien === 'alumnos' && p.chapterId) {
      setPendiente(pdfs[0])
      // Allí aún no ha habido clase (ni tiene su versión): lo normal es cambiarla también.
      setTambien(!!gemela?.chapter_id && !gemela?.pasada && !gemela?.hoy && !gemela?.con_notas)
      return
    }
    hacer('subir', async () => {
      const antes = new Set((lista?.presentaciones || []).map((x) => x.id))
      for (const f of pdfs) await subirArchivoProfe(semanaId, f, token)
      const nueva = listaDe(await getPizarra(semanaId, token))
      const recien = nueva.presentaciones.filter((x) => !antes.has(x.id))
      // En la pizarra, la que se acaba de subir es la que se quiere usar: se abre.
      if (p.onAbrir && recien.length === 1) {
        setLista(nueva)
        await p.onAbrir(recien[0].id)
      } else poner(nueva)
      toast.success(pdfs.length === 1 ? 'Presentación subida' : `${pdfs.length} presentaciones subidas`)
    })
  }

  /** La nueva de los alumnos: sustituye a las de antes y se lleva sus notas. */
  const ponerLaDeAlumnos = async (archivo: File, enLaOtra: boolean) => {
    if (!p.chapterId) return
    const viejas = deAlumnos.map((x) => ({ activity_uuid: actividadDe(x.id), nombre: x.nombre }))
    const nueva = await ponerPresentacion(archivo, p.chapterId, viejas, token)
    // Lo escrito sobre la de antes pasa a la nueva (cambia de id: si no, se quedaría suelto).
    await llevarNotas(semanaId, viejas, nueva, token, archivo.name)
    // Si la pizarra de la clase estaba en blanco, esta pasa a ser la suya.
    if (lista?.fuente === PIZARRA_EN_BLANCO) await ponerEnPizarra(semanaId, `clase:${nueva}`, token).catch(() => undefined)
    if (enLaOtra && gemela?.chapter_id) {
      try {
        const nuevaAlli = await ponerPresentacion(archivo, gemela.chapter_id, gemela.presentaciones || [], token)
        await llevarNotas(gemela.id, gemela.presentaciones || [], nuevaAlli, token, archivo.name)
      } catch (e: any) {
        toast.error(`Cambiada aquí, pero no en ${gemela.curso}: ${e?.message || 'vuelve a intentarlo'}`)
      }
    }
    await leer()
  }

  const confirmarAlumnos = () => {
    const archivo = pendiente
    if (!archivo) return
    hacer('subir', async () => {
      await ponerLaDeAlumnos(archivo, tambien)
      setPendiente(null)
      toast.success(tambien && gemela ? 'Presentación de los alumnos cambiada en los dos grupos' : 'Los alumnos de este grupo ya la ven en su semana')
    })
  }

  // ── Lo de cada fila ─────────────────────────────────────────────────────
  const enPizarra = (x: Presentacion) =>
    hacer(x.id, async () => {
      poner(await ponerEnPizarra(semanaId, x.id, token))
      toast.success(`La pizarra de esta clase abre ahora «${x.nombre}»`)
    })

  const pasar = (de: string, a: Presentacion, nombreDe: string) =>
    hacer(de, async () => {
      const r = await pasarNotas(semanaId, de, a.id, token)
      setPasando('')
      poner(r)
      if (r.pasadas) toast.success(`Las notas de «${nombreDe}» están ahora en «${a.nombre}»`)
      else toast('Esa presentación no tenía notas que pasar')
    })

  /** «Se subió en la sesión que no era»: se elige la buena debajo de la fila. */
  const elegirSesion = (id: string) => {
    setPasando('')
    setASesion(id)
    if (sesiones) return
    getSesiones(semanaId, token)
      .then((r) => setSesiones(r.sesiones || []))
      .catch((e: any) => {
        setASesion('')
        toast.error(e?.message || 'No se han podido leer las sesiones de esta clase')
      })
  }

  const pasarALaSesion = (id: string, nombre: string, s: OtraSesion) =>
    hacer(id, async () => {
      const r = await pasarASesion(semanaId, id, s.id, token)
      setASesion('')
      poner(r)
      const donde = `${s.tema || 'la sesión'} (${diaCorto(s.fecha)})`
      toast.success(r.pasada.archivo ? `«${nombre}» está ahora en ${donde}, con lo escrito encima` : `Las notas están ahora en ${donde}`)
    })

  const borrar = async (id: string, nombre: string) => {
    const ok = await confirmar(`¿Borrar lo escrito en la pizarra sobre «${nombre}»?\n\nSe borran las notas, no la presentación. No se puede deshacer.`, { boton: 'Borrar las notas', peligro: true })
    if (!ok) return
    hacer(id, async () => {
      poner(await borrarNotas(semanaId, id, token))
      toast.success('Notas borradas')
    })
  }

  const quitar = async (x: Presentacion) => {
    const conNotas = x.notas ? '\n\nTiene notas de la pizarra: NO se borran. Quedan guardadas abajo, como «notas de una presentación que ya no está», y las puedes pasar a otra.' : ''
    if (x.de === 'alumnos') {
      const ok = await confirmar(`¿Dejar de enseñar «${x.nombre}» a los alumnos?\n\nDeja de salir en su semana. El archivo no se borra: queda sin publicar en el curso.${conNotas}`, { boton: 'Dejar de enseñarla', peligro: true })
      if (!ok) return
      return hacer(x.id, async () => {
        await updateActivity({ published: false }, actividadDe(x.id), token)
        await leer()
        toast.success('Los alumnos ya no la ven')
      })
    }
    const ok = await confirmar(`¿Quitar «${x.nombre}» de esta clase?${conNotas}`, { boton: 'Quitar la presentación', peligro: true })
    if (!ok) return
    hacer(x.id, async () => {
      await quitarProfe(semanaId, archivoDe(x.id), token)
      await leer()
      toast.success('Presentación quitada')
    })
  }

  const cambiarArchivo = (archivos: FileList | null) => {
    const f = archivos?.[0]
    const id = cambiando.current
    if (entradaCambio.current) entradaCambio.current.value = ''
    if (!f || !id) return
    if (!esPdf(f)) return void toast.error('Tiene que ser un PDF')
    hacer(id, async () => {
      if (id.startsWith('clase:')) await ponerLaDeAlumnos(f, false)
      else {
        await cambiarArchivoProfe(semanaId, archivoDe(id), f, token)
        await leer()
      }
      toast.success('Archivo cambiado. Lo escrito encima se conserva.')
    })
  }

  const guardarNombre = () => {
    const r = renombrando
    if (!r) return
    const nombre = r.nombre.trim()
    setRenombrando(null)
    if (!nombre) return
    hacer(r.id, async () => {
      // La de los alumnos: solo cambia el nombre con el que la ve el equipo.
      if (r.id.startsWith('clase:')) poner(await nombrarPresentacion(semanaId, r.id, nombre, token))
      else {
        await nombreProfe(semanaId, archivoDe(r.id), nombre, token)
        await leer()
      }
    })
  }

  const descargar = (x: Presentacion) =>
    hacer(x.id, async () => {
      await descargarFuente(semanaId, x.id, x.nombre, token)
    })

  const abrirConNotas = (id: string) => window.open(`/pizarra/${semanaId}?fuente=${encodeURIComponent(id)}&descargar=1`, '_blank', 'noopener')

  const accionesDe = (x: Presentacion): Accion[] => {
    const hayDestino = !!lista && destinosPara(x.id, lista).length > 0
    const out: Accion[] = []
    if (!x.en_pizarra) out.push({ texto: 'Poner en la pizarra', hacer: () => enPizarra(x) })
    if (x.de !== 'blanco') out.push({ texto: 'Descargar', hacer: () => descargar(x) })
    if (x.notas) out.push({ texto: 'Descargar con las notas', hacer: () => abrirConNotas(x.id) })
    if (x.notas && hayDestino) out.push({ texto: 'Pasar las notas a otra presentación…', hacer: () => (setASesion(''), setPasando(x.id)) })
    if (x.de === 'equipo') out.push({ texto: 'Pasar a otra sesión…', nota: x.notas ? 'con sus notas' : undefined, hacer: () => elegirSesion(x.id) })
    if (x.de === 'equipo' || (x.de === 'alumnos' && p.chapterId))
      out.push({
        texto: 'Cambiar el archivo',
        nota: 'conserva las notas',
        raya: true,
        hacer: () => {
          cambiando.current = x.id
          entradaCambio.current?.click()
        },
      })
    if (x.de === 'equipo') out.push({ texto: 'Cambiar el nombre', hacer: () => setRenombrando({ id: x.id, nombre: x.nombre.replace(/\.pdf$/i, '') }) })
    if (x.de === 'alumnos') out.push({ texto: 'Cambiar el nombre', nota: 'solo lo ve el equipo', hacer: () => setRenombrando({ id: x.id, nombre: x.nombre.replace(/\.pdf$/i, '') }) })
    if (x.notas) out.push({ texto: 'Borrar sus notas', rojo: true, raya: true, hacer: () => borrar(x.id, x.nombre) })
    if (x.de === 'equipo') out.push({ texto: 'Quitar la presentación', rojo: true, raya: !x.notas, hacer: () => quitar(x) })
    if (x.de === 'alumnos') out.push({ texto: 'Dejar de enseñarla a los alumnos', rojo: true, raya: !x.notas, hacer: () => quitar(x) })
    return out
  }

  // ── Pantalla ────────────────────────────────────────────────────────────
  if (!lista) {
    return fallo ? (
      <p className="text-[13.5px] text-[#B42323]">
        {fallo}{' '}
        <button onClick={() => leer('leida')} className={ENLACE}>
          Reintentar
        </button>
      </p>
    ) : (
      <p className="flex items-center gap-2 text-[13.5px] text-[#6B7393]">
        <Loader2 size={15} className="animate-spin" /> Leyendo las presentaciones…
      </p>
    )
  }

  const filas = lista.presentaciones
  const pubSinFila = lista.publicada && !filas.some((x) => x.publicada)
  const laQuePasa = pasando ? filas.find((x) => x.id === pasando) || lista.sueltas.find((x) => x.id === pasando) : null
  const nombreDeLaQuePasa = laQuePasa ? laQuePasa.nombre || 'una presentación que ya no está' : ''

  const fila = (x: Presentacion) => {
    const abierta = p.abierta === x.id
    const trabajando = ocupado === x.id
    const acciones = accionesDe(x)
    return (
      <li key={x.id} className={`${compacta ? 'py-3' : 'py-3.5'} first:border-t-0 border-t border-[#EEF1F6]`}>
        <div className="flex items-start gap-3.5">
          {compacta ? null : <IconoPdf blanco={x.de === 'blanco'} />}
          <div className="min-w-0 flex-1">
            {renombrando?.id === x.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  guardarNombre()
                }}
                className="flex items-center gap-2"
              >
                <input
                  autoFocus
                  value={renombrando.nombre}
                  onChange={(e) => setRenombrando({ id: x.id, nombre: e.target.value })}
                  onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setRenombrando(null))}
                  maxLength={140}
                  aria-label="Nombre de la presentación"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-[#0b2da0] bg-white px-2.5 text-[14px] text-[#0B1033] outline-none ring-[3px] ring-[#0b2da0]/10"
                />
                <button type="submit" className={ENLACE}>
                  Guardar
                </button>
                <button type="button" onClick={() => setRenombrando(null)} className="text-[13px] font-semibold text-[#6B7393] hover:underline">
                  Cancelar
                </button>
              </form>
            ) : (
              <p className="break-words text-[14.5px] font-semibold leading-snug text-[#0B1033]">{x.nombre}</p>
            )}
            <p className="mt-px text-[12.5px] leading-snug text-[#6B7393]">{quienLaVe(x)}</p>
            <p className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] leading-snug">
              {x.en_pizarra ? <Estado color="#0b2da0">En la pizarra</Estado> : null}
              {x.notas ? <Estado color={x.en_pizarra || x.publicada ? '#16A34A' : '#E4B252'}>{textoNotas(x.notas)}</Estado> : <Estado>Sin notas</Estado>}
              {x.publicada ? (
                <Estado color="#16A34A">
                  Los alumnos ven esta versión, guardada {cuandoFue(x.publicada.at) || 'en la pizarra'}{' '}
                  <button onClick={() => setViendo(true)} className="font-semibold text-[#0b2da0] hover:underline">
                    Ver
                  </button>
                </Estado>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {abierta ? (
              <span className="px-2 text-[12.5px] font-semibold text-[#0b2da0]">Abierta</span>
            ) : p.onAbrir ? (
              <button onClick={() => p.onAbrir?.(x.id)} disabled={!!ocupado} className={x.en_pizarra ? BOTON_AZUL : BOTON}>
                {trabajando ? <Loader2 size={14} className="animate-spin" /> : null}
                Abrir
              </button>
            ) : (
              <a href={`/pizarra/${semanaId}?fuente=${encodeURIComponent(x.id)}`} className={`${x.en_pizarra ? BOTON_AZUL : BOTON} max-sm:hidden`}>
                {trabajando ? <Loader2 size={14} className="animate-spin" /> : null}
                Abrir en la pizarra
              </a>
            )}
            {acciones.length ? (
              <button
                onClick={(e) => {
                  const ancla = e.currentTarget
                  setMenu((m) => (m?.id === x.id ? null : { id: x.id, ancla }))
                }}
                aria-label={`Más opciones de ${x.nombre}`}
                title="Más opciones"
                className="flex h-9 w-8 items-center justify-center rounded-lg text-[#6B7393] transition-colors hover:bg-[#F2F4F8] hover:text-[#0B1033]"
              >
                <MoreHorizontal size={18} />
              </button>
            ) : null}
          </div>
        </div>
        {/* En el móvil el botón va debajo, a lo ancho: al lado no cabe. */}
        {!abierta && !p.onAbrir ? (
          <a href={`/pizarra/${semanaId}?fuente=${encodeURIComponent(x.id)}`} className={`${x.en_pizarra ? BOTON_AZUL : BOTON} mt-2.5 w-full sm:hidden`}>
            Abrir en la pizarra
          </a>
        ) : null}
        {pasando === x.id ? pasarAOtra() : null}
        {aSesion === x.id ? aOtraSesion(x.id, x.nombre, true) : null}
      </li>
    )
  }

  /** A cuál se pasan las notas: se elige aquí mismo, debajo de la fila. */
  const pasarAOtra = () => {
    const destinos = destinosPara(pasando, lista)
    return (
      <div className="mt-3 rounded-xl border border-[#E3E8F2] bg-[#FAFBFD] px-4 py-3.5">
        <p className="text-[13.5px] font-semibold text-[#0B1033]">Pasar las notas de «{nombreDeLaQuePasa}» a:</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#6B7393]">
          Cada página va a su misma página; las páginas en blanco, al final. Si la otra ya tiene notas, se juntan. Esta se queda sin notas.
        </p>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {destinos.map((d) => (
            <button
              key={d.id}
              onClick={() => pasar(pasando, d, nombreDeLaQuePasa)}
              disabled={!!ocupado}
              className="flex items-center gap-3 rounded-lg border border-[#E2E7F0] bg-white px-3 py-2 text-left transition-colors hover:border-[#0b2da0] disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[13.5px] font-semibold text-[#0B1033]">{d.nombre}</span>
                <span className="block text-[12px] text-[#6B7393]">
                  {d.en_pizarra ? 'En la pizarra · ' : ''}
                  {d.notas ? 'ya tiene notas: se juntan' : 'sin notas'}
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-[#0b2da0]">{ocupado === pasando ? 'Pasando…' : 'Pasar aquí'}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setPasando('')} className="mt-2.5 text-[13px] font-semibold text-[#6B7393] hover:underline">
          Cancelar
        </button>
      </div>
    )
  }

  /** A qué sesión de la misma clase se pasa: se elige aquí mismo. */
  const aOtraSesion = (id: string, nombre: string, conArchivo: boolean) => (
    <div className="mt-3 rounded-xl border border-[#E3E8F2] bg-[#FAFBFD] px-4 py-3.5">
      <p className="text-[13.5px] font-semibold text-[#0B1033]">{conArchivo ? `Pasar «${nombre}» a otra sesión de esta clase:` : 'Pasar estas notas a otra sesión de esta clase:'}</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#6B7393]">
        {conArchivo
          ? 'Se va de esta sesión y aparece en la que elijas, con lo escrito encima. Lo que ya ven los alumnos de esta sesión no cambia.'
          : 'Dejan de estar en esta sesión y aparecen en la que elijas.'}
      </p>
      {sesiones === null ? (
        <p className="mt-2.5 flex items-center gap-2 text-[13px] text-[#6B7393]">
          <Loader2 size={14} className="animate-spin" /> Leyendo las sesiones…
        </p>
      ) : sesiones.length ? (
        <div className="mt-2.5 flex max-h-[232px] flex-col gap-1.5 overflow-y-auto">
          {sesiones.map((s) => (
            <button
              key={s.id}
              onClick={() => pasarALaSesion(id, nombre, s)}
              disabled={!!ocupado}
              className="flex items-center gap-3 rounded-lg border border-[#E2E7F0] bg-white px-3 py-2 text-left transition-colors hover:border-[#0b2da0] disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[13.5px] font-semibold text-[#0B1033]">{s.tema || 'Sin tema todavía'}</span>
                <span className="block text-[12px] text-[#6B7393] first-letter:uppercase">{s.fecha ? diaCorto(s.fecha) : 'sin día'}</span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold text-[#0b2da0]">{ocupado === id ? 'Pasando…' : 'Pasar aquí'}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2.5 text-[13px] text-[#6B7393]">Esta clase no tiene más sesiones creadas. Crea la sesión en el calendario de la sala de profesores y vuelve.</p>
      )}
      <button onClick={() => setASesion('')} className="mt-2.5 text-[13px] font-semibold text-[#6B7393] hover:underline">
        Cancelar
      </button>
    </div>
  )

  const suelta = (s: NotasSueltas) => (
    <div key={s.id} className="mt-3 rounded-xl border border-[#F0E3C4] bg-[#FFFBF2] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-[240px] text-[13px] leading-snug text-[#6B5320]">
          <span className="font-semibold text-[#3F3110]">Notas de una presentación que ya no está</span>
          {s.nombre ? <> · «{s.nombre}»</> : null}
          {detalleSuelta(s) ? <> · {detalleSuelta(s)}</> : null}
        </p>
        <span className="flex shrink-0 items-center gap-4">
          {filas.length ? (
            <button onClick={() => (setASesion(''), setPasando(s.id))} disabled={!!ocupado} className={ENLACE}>
              Pasarlas a…
            </button>
          ) : null}
          {s.id.startsWith('clase:') ? null : (
            <button onClick={() => elegirSesion(s.id)} disabled={!!ocupado} className={ENLACE}>
              A otra sesión…
            </button>
          )}
          <button onClick={() => abrirConNotas(s.id)} className={ENLACE}>
            Descargar
          </button>
          <button onClick={() => borrar(s.id, s.nombre || 'esa presentación')} disabled={!!ocupado} className="text-[13px] font-semibold text-[#B42323] hover:underline disabled:opacity-50">
            Borrar
          </button>
        </span>
      </div>
      {pasando === s.id ? pasarAOtra() : null}
      {aSesion === s.id ? aOtraSesion(s.id, s.nombre, false) : null}
    </div>
  )

  const abierto = menu ? filas.find((x) => x.id === menu.id) : null

  return (
    <div>
      {filas.length ? (
        <ul className={compacta ? '' : 'border-y border-[#E3E8F2]'}>{filas.map(fila)}</ul>
      ) : (
        <p className={`text-[13.5px] text-[#6B7393] ${compacta ? 'py-2' : 'rounded-xl border border-[#E6EAF2] bg-[#FAFBFD] px-4 py-3.5'}`}>
          Aún no hay ninguna presentación en esta clase.{compacta ? '' : ' Sube el PDF aquí abajo: es lo que se abre al pulsar «Pizarra» en la sala.'}
        </p>
      )}

      {pubSinFila && lista.publicada ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-[#6B7393]">
          <Estado color="#16A34A">
            Los alumnos ven la versión de la clase guardada {cuandoFue(lista.publicada.at) || 'en la pizarra'}
            {lista.publicada.nombre ? `, de «${lista.publicada.nombre}»` : ''} (esa presentación ya no está).{' '}
            <button onClick={() => setViendo(true)} className="font-semibold text-[#0b2da0] hover:underline">
              Ver
            </button>
          </Estado>
        </p>
      ) : null}

      {/* Subir: una sola puerta, que pregunta quién la ve */}
      {pendiente ? (
        <div className="mt-4 rounded-xl border border-[#E3E8F2] bg-[#FAFBFD] px-4 py-3.5">
          <p className="break-words text-[13.5px] font-semibold text-[#0B1033]">{pendiente.name}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#6B7393]">
            Los alumnos de este grupo la verán en su semana antes de la clase.
            {deAlumnos.length ? ` Sustituye a «${deAlumnos[0].nombre}», que deja de enseñarse (no se borra); lo escrito sobre ella en la pizarra pasa a la nueva.` : ''}
          </p>
          {gemela?.chapter_id ? (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={tambien} onChange={(e) => setTambien(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0b2da0]" />
              <span className="text-[13px] leading-snug text-[#2B3150]">
                <span className="font-semibold text-[#0B1033]">Cambiarla también en {gemela.curso}</span>
                <span className="block text-[12.5px] text-[#6B7393]">
                  {gemela.pasada || gemela.hoy
                    ? `Ese grupo ya tuvo su clase (${diaCorto(gemela.fecha)})${gemela.con_notas ? ' y ve la versión de su clase' : ''}: normalmente, déjala como está.`
                    : `Su clase es el ${diaCorto(gemela.fecha)}: aún no ha empezado.`}
                </span>
              </span>
            </label>
          ) : null}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button onClick={() => setPendiente(null)} disabled={ocupado === 'subir'} className="h-9 rounded-lg px-3 text-[13.5px] font-semibold text-[#3B4262] hover:bg-white">
              Cancelar
            </button>
            <button onClick={confirmarAlumnos} disabled={ocupado === 'subir'} className={BOTON_AZUL}>
              {ocupado === 'subir' ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              {ocupado === 'subir' ? 'Subiendo…' : tambien ? 'Subir en los dos grupos' : 'Subir para los alumnos'}
            </button>
          </div>
        </div>
      ) : compacta ? (
        <button onClick={() => entrada.current?.click()} disabled={!!ocupado} className={`${ENLACE} mt-3 inline-flex items-center gap-1.5`}>
          {ocupado === 'subir' ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={15} />}
          {ocupado === 'subir' ? 'Subiendo…' : filas.length ? 'Subir otra presentación (PDF)' : 'Subir una presentación (PDF)'}
        </button>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setEncima(true)
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault()
            setEncima(false)
            elegir(e.dataTransfer.files)
          }}
          className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border-[1.5px] border-dashed px-4 py-3.5 transition-colors ${
            encima ? 'border-[#0b2da0] bg-[#F5F8FF]' : 'border-[#C9D2E6] bg-white'
          }`}
        >
          <button type="button" onClick={() => entrada.current?.click()} disabled={!!ocupado} className="flex min-w-0 flex-1 basis-[230px] items-center gap-3 text-left disabled:opacity-60">
            {ocupado === 'subir' ? <Loader2 size={21} className="shrink-0 animate-spin text-[#0b2da0]" /> : <UploadCloud size={21} strokeWidth={1.7} className="shrink-0 text-[#0b2da0]" />}
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-[#0B1033]">{ocupado === 'subir' ? 'Subiendo…' : 'Subir presentación'}</span>
              <span className="block text-[12.5px] text-[#6B7393]">PDF. Arrástralo aquí o pulsa para elegirlo</span>
            </span>
          </button>
          {p.chapterId ? (
            <fieldset className="flex shrink-0 flex-col gap-1.5 text-[13px] text-[#2B3150]">
              <legend className="sr-only">Quién la ve</legend>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name={`quien-${semanaId}`} checked={paraQuien === 'equipo'} onChange={() => setParaQuien('equipo')} className="h-[15px] w-[15px] accent-[#0b2da0]" />
                Solo el equipo
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name={`quien-${semanaId}`} checked={paraQuien === 'alumnos'} onChange={() => setParaQuien('alumnos')} className="h-[15px] w-[15px] accent-[#0b2da0]" />
                También los alumnos, antes de la clase
              </label>
            </fieldset>
          ) : null}
        </div>
      )}
      <input ref={entrada} type="file" accept="application/pdf,.pdf" multiple={paraQuien === 'equipo'} className="hidden" onChange={(e) => elegir(e.target.files)} />
      <input ref={entradaCambio} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => cambiarArchivo(e.target.files)} />

      {lista.sueltas.map(suelta)}

      {menu && abierto ? <Menu ancla={menu.ancla} acciones={accionesDe(abierto)} onCerrar={() => setMenu(null)} /> : null}
      {viendo ? <VisorPresentacionClase semanaId={semanaId} titulo="La versión de la clase" onClose={() => setViendo(false)} /> : null}
    </div>
  )
}
