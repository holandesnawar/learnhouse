'use client'
/**
 * La ficha de una clase (12/11/2026): TODO lo de esa clase en un solo sitio.
 *
 * Usuario: "primero me gustaría subir eso en eventos para que se vea qué le
 * toca a quién, luego ahí dentro ya meter yo el recurso… ¿y dónde se puede
 * revisar esto luego?… cada uno vea bien lo que ha hecho, sigo viéndolo algo
 * caótico". Antes había una ventana «Preparar la clase» y, para lo demás, la
 * página del curso, Grabaciones, Seguimiento y el Archivo.
 *
 * Se abre al tocar una clase en el calendario, en el Inicio de la sala o en
 * «Clases dadas». De arriba abajo:
 * - **Cabecera**: qué clase es, cuándo, quién la da y su estado (Por preparar,
 *   Lista, Hoy, Dada: `estadoDeClase`), con «Entrar a la sala» el día, «Abrir
 *   la pizarra» y «Abrir la página de la clase».
 * - **Después de la clase** (desde su día; arriba si ya pasó, abajo si es
 *   hoy): asistencia, la grabación de la sala, la pizarra con lo que se
 *   escribió, las tareas por corregir y «Cómo fue» (dos líneas del profe).
 * - **La clase**: tema, día y, el administrador, quién la da y un mensaje.
 * - **Presentaciones** (22/11/2026): UNA lista con todos los PDF de la clase
 *   (`ListaPresentaciones`): quién ve cada uno (solo el equipo, o también los
 *   alumnos antes de la clase), cuál abre la pizarra, cuál tiene notas y cuál
 *   ven los alumnos después. Antes eran dos secciones («Documento para dar la
 *   clase» y «Presentación para los alumnos») y nadie sabía cuál era cuál.
 * - **Otros archivos y enlaces**: lo que no es PDF (PowerPoint, audio, un
 *   enlace a Canva…), solo para el equipo.
 * - **Notas para el profe**.
 *
 * Los archivos se guardan al subirlos; lo demás, con «Guardar». Si la clase
 * tiene gemela (el otro grupo), la casilla de siempre lo copia allí.
 */
import Confirmados from './Confirmados'
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { CalendarDays, Check, Clock3, FileText, Link2, Trash2, UploadCloud, User, X } from 'lucide-react'
import ListaPresentaciones from '@components/Pages/Presentaciones/ListaPresentaciones'
import type { ListaPresentaciones as Lista } from '@services/pizarra/pizarra'
import {
  abrirArchivoProfe,
  borrarSemana,
  despuesProfe,
  editarSemana,
  enlaceProfe,
  getGemela,
  guardarNotasProfe,
  igualarGemela,
  mensajeProfe,
  quienProfe,
  quitarProfe,
  subirArchivoProfe,
  type ArchivoProfe,
  type Gemela,
  type MaterialProfe,
} from '@services/tareas/tareas'
import { cuando, diaLegible, estadoDeClase, queVioLaSala, quienDa, textoAsistencia, tieneDocumento, type SemanaEquipo } from '@/lib/nawar/salaProfes'
import { confirmar } from '@/lib/nawar/confirmar'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import GrabacionDeSala from '@components/Pages/Grabaciones/GrabacionDeSala'
import { PasarLista } from '@components/Pages/Profes/ListaYGrupo'
import { MensajeDelAdmin } from './PrepararClase'
import type { ClaseEquipo } from './useClasesEquipo'
import { POPPINS } from './estilo'

const BOTON =
  'shrink-0 h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg border border-[#E2E7F0] bg-white text-[13.5px] font-semibold text-[#0B1033] transition-colors hover:border-[#C9D3E6] hover:bg-[#F7F9FD]'
const BOTON_AZUL = 'shrink-0 h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold transition-colors hover:bg-[#0a2690]'
const CAMPO =
  'w-full rounded-lg border border-[#E2E7F0] bg-white px-3 py-2 text-[14px] text-[#0B1033] outline-none transition-colors placeholder:text-[#9AA1B9] hover:border-[#C9D3E6] focus:border-[#0b2da0] focus:ring-[3px] focus:ring-[#0b2da0]/10'
const ETIQUETA = 'text-[13px] font-medium text-[#3B4262]'

// El estado, como un punto y su texto (sin cajitas de colores).
const PUNTO: Record<string, string> = {
  'por-preparar': '#D9A23B',
  lista: '#16A34A',
  hoy: '#0b2da0',
  dada: '#9AA1B9',
}

/** Un PDF subido es una presentación: va en la lista de arriba, no en «Otros archivos». */
const esPresentacion = (a: ArchivoProfe) => a.tipo === 'archivo' && /\.pdf$/i.test(a.nombre || '')

/** Una parte de la ficha: título, para qué sirve y lo de dentro. */
function Seccion({ titulo, ayuda, children, derecha }: { titulo: string; ayuda?: string; children: React.ReactNode; derecha?: React.ReactNode }) {
  return (
    <section className="px-5 py-6 sm:px-7 border-b border-[#EEF1F6] last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-[#0B1033]" style={POPPINS}>
            {titulo}
          </h3>
          {ayuda ? <p className="mt-0.5 text-[13px] leading-relaxed text-[#6B7393]">{ayuda}</p> : null}
        </div>
        {derecha}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  )
}

function Linea({ hecho, titulo, detalle, accion }: { hecho: boolean; titulo: string; detalle?: string; accion?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={`shrink-0 w-[21px] h-[21px] rounded-full border-2 flex items-center justify-center ${hecho ? 'border-[#16A34A] text-[#16A34A]' : 'border-[#C5CEE2]'}`}>
        {hecho ? <Check size={12} strokeWidth={3.4} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] leading-snug text-[#0B1033]">{titulo}</p>
        {detalle ? <p className="text-[12.5px] text-[#6B7393]">{detalle}</p> : null}
      </div>
      {accion}
    </li>
  )
}

function FichaDentro({
  semana,
  clase,
  hoy,
  ruta,
  admin,
  nombres,
  token,
  onCerrar,
  onCambio,
}: {
  semana: SemanaEquipo
  clase: ClaseEquipo | undefined
  hoy: string
  ruta: (p: string) => string
  admin: boolean
  nombres: string[]
  token: string
  onCerrar: () => void
  /** Algo ha cambiado: que quien abre la ficha vuelva a leer las clases. */
  onCambio: () => void
}) {
  const [tema, setTema] = useState(semana.tema)
  const [fecha, setFecha] = useState(semana.fecha)
  const [profe, setProfe] = useState(semana.material?.profe || '')
  const [mensaje, setMensaje] = useState(semana.material?.mensaje?.texto || '')
  const [notas, setNotas] = useState(semana.material?.notas || '')
  const [despues, setDespues] = useState(semana.material?.despues?.texto || '')
  const [material, setMaterial] = useState<MaterialProfe>(semana.material || { notas: '', archivos: [] })
  // Las presentaciones de la clase, como las da la lista (22/11/2026).
  const [pres, setPres] = useState<Lista | null>(null)
  const [versionPres, setVersionPres] = useState(0)
  const [nombreEnlace, setNombreEnlace] = useState('')
  const [url, setUrl] = useState('')
  const [conEnlace, setConEnlace] = useState(false)
  const [ocupado, setOcupado] = useState('')
  const [encima, setEncima] = useState(false)
  const [lista, setLista] = useState(false)
  const [archivosTocados, setArchivosTocados] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  // La misma clase en el otro grupo (10/11/2026): se edita una vez.
  const [gemela, setGemela] = useState<Gemela | null>(null)
  const [tambien, setTambien] = useState(true)

  useEffect(() => {
    let vivo = true
    getGemela(semana.semanaId, token)
      .then((r) => {
        if (!vivo) return
        setGemela(r.gemela)
        // Temas distintos: puede no ser la misma clase. La casilla nace quitada (16/11/2026).
        setTambien(!!r.gemela && r.gemela.mismo_tema !== false)
      })
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [semana.semanaId, token])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !lista && cerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  const uuid = semana.courseUuid.replace(/^course_/, '')
  const profeClase = clase?.profe || ''
  // El estado, con lo que hay ahora mismo en la ficha (también lo recién subido).
  const ahora: SemanaEquipo = {
    ...semana,
    tema,
    fecha,
    material: { ...material, profe, archivos: pres ? material.archivos.filter((a) => !esPresentacion(a)) : material.archivos },
    // Con la lista leída, manda ella: sabe lo recién subido o quitado.
    presentaciones: pres ? (pres.presentaciones.some((x) => x.de !== 'blanco') ? [{ activity_uuid: 'hay', nombre: 'Presentación' }] : []) : semana.presentaciones,
  }
  const estado = estadoDeClase(ahora, hoy, profeClase)
  const yaFue = !!semana.fecha && semana.fecha <= hoy
  const esHoy = semana.fecha === hoy
  const da = quienDa(ahora, profeClase)
  const pizarra = material.pizarra
  const hayPdf = tieneDocumento(ahora)
  // Lo de la pizarra, dicho con la lista (qué presentación tiene notas y cuál ven los alumnos).
  const conNotas = (pres?.presentaciones || []).filter((x) => x.notas)
  const publicadaAt = pres ? pres.publicada?.at || '' : pizarra?.publicada_at || ''
  const hayNotas = pres ? conNotas.length > 0 || pres.sueltas.length > 0 : !!pizarra?.guardada_at
  const otros = material.archivos.filter((a) => !esPresentacion(a))

  const igualar = async () => {
    if (!gemela || !tambien) return
    try {
      await igualarGemela(semana.semanaId, token)
    } catch (e: any) {
      toast.error(`Guardado aquí, pero no en ${gemela.curso}: ${e?.message || 'vuelve a intentarlo'}`)
    }
  }

  const subir = async (lista: FileList | File[] | null | undefined) => {
    const archivos = Array.from(lista || [])
    if (!archivos.length) return
    setOcupado('subir')
    try {
      let m = material
      for (const f of archivos) m = await subirArchivoProfe(semana.semanaId, f, token)
      setMaterial(m)
      setArchivosTocados(true)
      // Un PDF es una presentación: que la lista de arriba lo enseñe.
      if (archivos.some((f) => /\.pdf$/i.test(f.name))) setVersionPres((v) => v + 1)
      toast.success(archivos.length === 1 ? 'Subido' : `${archivos.length} archivos subidos`)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido subir')
    } finally {
      setOcupado('')
      if (entrada.current) entrada.current.value = ''
    }
  }
  const anadirEnlace = async () => {
    setOcupado('enlace')
    try {
      setMaterial(await enlaceProfe(semana.semanaId, nombreEnlace, url, token))
      setNombreEnlace('')
      setUrl('')
      setConEnlace(false)
      setArchivosTocados(true)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido añadir')
    } finally {
      setOcupado('')
    }
  }
  const quitar = async (a: ArchivoProfe) => {
    setOcupado(a.id)
    try {
      setMaterial(await quitarProfe(semana.semanaId, a.id, token))
      setArchivosTocados(true)
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido quitar')
    } finally {
      setOcupado('')
    }
  }
  const cambiado =
    tema.trim() !== semana.tema ||
    fecha !== semana.fecha ||
    notas.trim() !== (semana.material?.notas || '').trim() ||
    despues.trim() !== (semana.material?.despues?.texto || '').trim() ||
    (admin && profe.trim() !== (semana.material?.profe || '').trim()) ||
    (admin && mensaje.trim() !== (semana.material?.mensaje?.texto || '').trim())

  const guardar = async () => {
    if (!fecha) return toast.error('Falta el día de la clase')
    setOcupado('guardar')
    try {
      if (tema.trim() !== semana.tema || fecha !== semana.fecha) await editarSemana(semana.semanaId, { tema: tema.trim(), fecha }, token)
      if (notas.trim() !== (semana.material?.notas || '').trim()) await guardarNotasProfe(semana.semanaId, notas, token)
      if (despues.trim() !== (semana.material?.despues?.texto || '').trim()) await despuesProfe(semana.semanaId, despues, token)
      if (admin && profe.trim() !== (semana.material?.profe || '').trim()) await quienProfe(semana.semanaId, profe, token)
      if (admin && mensaje.trim() !== (semana.material?.mensaje?.texto || '').trim()) await mensajeProfe(semana.semanaId, mensaje, token)
      await igualar()
      toast.success(gemela && tambien ? 'Guardado en las dos clases' : 'Guardado')
      onCambio()
      onCerrar()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido guardar')
    } finally {
      setOcupado('')
    }
  }
  const cerrar = async () => {
    if (archivosTocados) {
      // Se añadió o quitó algún archivo: que el otro grupo tenga lo mismo.
      await igualar()
      onCambio()
    }
    onCerrar()
  }
  const quitarClase = async () => {
    const ok = await confirmar(
      `¿Quitar esta clase?\n\n${semana.curso} · ${diaLegible(semana.fecha)}${semana.tema ? ` · ${semana.tema}` : ''}.\n\nDeja de salir en el calendario y en la página de los alumnos. Si tenía tareas entregadas, se borran.`,
      { boton: 'Quitar la clase', peligro: true }
    )
    if (!ok) return
    setOcupado('quitar')
    try {
      await borrarSemana(semana.semanaId, token)
      toast.success('Clase quitada')
      onCambio()
      onCerrar()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido quitar')
      setOcupado('')
    }
  }

  // La ficha tiene dos caras: preparar la clase y lo de después. Ya dada,
  // se abre en «Después» (lo que queda es ver qué pasó).
  const [cara, setCara] = useState<'preparar' | 'despues'>(yaFue && !esHoy ? 'despues' : 'preparar')
  const pendientesDespues = (semana.porCorregir || 0) + (hayNotas && !publicadaAt ? 1 : 0)

  const despuesDeLaClase = yaFue ? (
    <>
      <Seccion titulo={esHoy ? 'Hoy, al terminar' : 'Lo que pasó en la clase'} ayuda="Lo que queda por cerrar de esta clase. Se marca solo cuando está hecho.">
        <ul className="divide-y divide-[#EEF1F6] rounded-xl border border-[#E6EAF2] bg-white px-4">
          <Linea
            hecho={!!(semana.lista?.pasada || semana.lista?.vinieron)}
            titulo={textoAsistencia(semana.lista)}
            detalle={
              [queVioLaSala(semana.lista), semana.lista?.pasada ? '' : 'Quien está 10 minutos en la sala cuenta solo. Si alguien vino por otro sitio, corrígelo.']
                .filter(Boolean)
                .join('. ') || undefined
            }
            accion={
              <button onClick={() => setLista(true)} className={BOTON}>
                {semana.lista?.pasada ? 'Ver la lista' : 'Corregir'}
              </button>
            }
          />
          <Linea
            hecho={!!publicadaAt}
            titulo={
              publicadaAt
                ? `Pizarra: los alumnos de este grupo ya ven la versión de la clase`
                : hayNotas
                  ? conNotas.length
                    ? `Pizarra: hay notas en «${conNotas[0].nombre}»${conNotas.length > 1 ? ` y en ${conNotas.length - 1} más` : ''}, sin guardar para los alumnos`
                    : 'Pizarra: hay cosas escritas, sin guardar para los alumnos'
                  : 'Pizarra: no se escribió nada'
            }
            detalle={
              publicadaAt
                ? `${pres?.publicada?.nombre ? `De «${pres.publicada.nombre}» · ` : ''}${pres?.publicada?.paginas || pizarra?.paginas || 0} páginas, en lugar de la presentación de antes`
                : undefined
            }
            accion={
              hayPdf || hayNotas ? (
                <a href={`/pizarra/${semana.semanaId}`} className={BOTON}>
                  Abrir
                </a>
              ) : null
            }
          />
          {semana.tieneTarea ? (
            <Linea
              hecho={!semana.porCorregir}
              titulo={semana.porCorregir ? `${semana.porCorregir} ${semana.porCorregir === 1 ? 'tarea por corregir' : 'tareas por corregir'}` : 'Tareas: nada por corregir'}
              accion={
                semana.porCorregir ? (
                  <Link href={ruta('/seguimiento')} className={BOTON}>
                    Corregir
                  </Link>
                ) : null
              }
            />
          ) : null}
        </ul>
      </Seccion>
      <Seccion titulo="La grabación" ayuda="Lo que grabó la sala ese día. Recórtala y publícala, o pega el enlace si se grabó en otro sitio.">
        <GrabacionDeSala semana={{ id: semana.semanaId, tema: semana.tema, fecha: semana.fecha }} courseUuid={uuid} hoy={hoy} />
      </Seccion>
      <Seccion titulo="Cómo fue la clase" ayuda="Dos líneas para quien dé la siguiente.">
        <textarea
          value={despues}
          onChange={(e) => setDespues(e.target.value)}
          rows={3}
          placeholder="Hasta dónde llegasteis, qué costó, qué repetir la próxima vez."
          className={`${CAMPO} resize-y`}
        />
        {semana.material?.despues?.por ? <span className="mt-1.5 block text-[12.5px] text-[#6B7393]">Lo escribió {semana.material.despues.por}.</span> : null}
      </Seccion>
    </>
  ) : null

  const preparar = (
    <>
      <Seccion titulo="La clase">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="block">
            <span className={ETIQUETA}>Tema</span>
            <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Se puede poner después" className={`${CAMPO} mt-1.5`} />
          </label>
          <label className="block">
            <span className={ETIQUETA}>Día</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${CAMPO} mt-1.5`} />
          </label>
        </div>
        {admin ? (
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className={ETIQUETA}>Quién la da</span>
              <input
                value={profe}
                onChange={(e) => setProfe(e.target.value)}
                list="nawar-ficha-nombres"
                placeholder={profeClase ? `Vacío = ${profeClase} (quien da esta clase)` : 'Nombre del profe o del monitor'}
                className={`${CAMPO} mt-1.5`}
              />
              <datalist id="nawar-ficha-nombres">
                {nombres.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <span className="mt-1.5 block text-[12.5px] text-[#6B7393]">Su nombre de pila, como en su cuenta. Le sale en su sala de profes.</span>
            </label>
            <label className="block">
              <span className={ETIQUETA}>Mensaje para quien la da</span>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={2}
                placeholder="Lo verá arriba de esta clase, con tu nombre, y lo marcará como leído."
                className={`${CAMPO} mt-1.5 resize-y`}
              />
              {semana.material?.mensaje?.texto ? (
                <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#6B7393]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: semana.material.mensaje.leido_por ? '#16A34A' : '#D9A23B' }} />
                  {semana.material.mensaje.leido_por ? `Leído por ${semana.material.mensaje.leido_por}.` : 'Aún sin leer.'}
                </span>
              ) : null}
            </label>
          </div>
        ) : null}
      </Seccion>

      <Seccion titulo="Presentaciones" ayuda="Todos los PDF de esta clase, en un solo sitio. Cada uno guarda sus propias notas de la pizarra: cambiar de uno a otro no borra nada.">
        <ListaPresentaciones
          semanaId={semana.semanaId}
          chapterId={semana.chapterId}
          token={token}
          version={versionPres}
          onCambio={(l, que) => {
            setPres(l)
            if (que === 'cambio') {
              setArchivosTocados(true)
              onCambio()
            }
          }}
        />
      </Seccion>

      <Seccion titulo="Otros archivos y enlaces" ayuda="Lo que no es un PDF: el PowerPoint original, un audio, un enlace a Canva… Solo lo ve el equipo.">
        {otros.length ? (
          <ul className="mb-2.5 divide-y divide-[#EEF1F6] rounded-xl border border-[#E6EAF2]">
            {otros.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3.5 py-2.5">
                {a.tipo === 'enlace' ? <Link2 size={17} className="shrink-0 text-[#6B7393]" /> : <FileText size={17} className="shrink-0 text-[#6B7393]" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[#0B1033]">{a.nombre}</span>
                  {a.por ? <span className="block text-[12px] text-[#8A91AD]">Lo añadió {a.por}</span> : null}
                </span>
                <button onClick={() => abrirArchivoProfe(semana.semanaId, a, token).catch((e) => toast.error(e?.message || 'No se ha podido abrir'))} className={BOTON}>
                  Abrir
                </button>
                <button onClick={() => quitar(a)} disabled={ocupado === a.id} aria-label="Quitar" title="Quitar" className="rounded-lg p-1.5 text-[#8A91AD] transition-colors hover:bg-[#FBEDEC] hover:text-[#B42323]">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          ref={entrada}
          type="file"
          multiple
          accept=".pptx,.ppt,.key,.odp,.docx,.doc,.png,.jpg,.jpeg,.webp,.mp3,.m4a,.mp4"
          className="hidden"
          onChange={(e) => subir(e.target.files)}
        />
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setEncima(true)
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault()
            setEncima(false)
            subir(e.dataTransfer.files)
          }}
          disabled={!!ocupado}
          className={`flex w-full items-center gap-3.5 rounded-xl border border-dashed px-4 py-3 text-left transition-colors ${
            encima ? 'border-[#0b2da0] bg-[#F5F8FF]' : 'border-[#CDD5E5] bg-[#FAFBFD] hover:border-[#0b2da0] hover:bg-[#F7F9FF]'
          }`}
        >
          <UploadCloud size={22} strokeWidth={1.6} className="shrink-0 text-[#0b2da0]" />
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-[#0B1033]">{ocupado === 'subir' ? 'Subiendo…' : 'Añadir un archivo'}</span>
            <span className="block text-[12.5px] text-[#6B7393]">PowerPoint, Keynote, Word, imagen, audio o vídeo, hasta 80 MB. Los PDF van arriba, en Presentaciones.</span>
          </span>
        </button>
        {conEnlace ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <input value={nombreEnlace} onChange={(e) => setNombreEnlace(e.target.value)} placeholder="Nombre (opcional)" className={CAMPO} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enlace (Google Slides, Canva, un vídeo…)" className={CAMPO} />
            <button onClick={anadirEnlace} disabled={!url.trim() || !!ocupado} className={`${BOTON} disabled:opacity-50`}>
              Añadir
            </button>
          </div>
        ) : (
          <button onClick={() => setConEnlace(true)} className="mt-2 text-[13px] font-semibold text-[#0b2da0] hover:underline">
            O añadir un enlace
          </button>
        )}
      </Seccion>

      <Seccion titulo="Notas para quien la da" ayuda="Cómo dar la clase, qué repasar, qué hacer si sobra tiempo. Solo las ve el equipo.">
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={4} placeholder="Escribe aquí…" className={`${CAMPO} resize-y`} />
        {gemela ? (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#E6EAF2] bg-[#FAFBFD] px-4 py-3.5">
            <input type="checkbox" checked={tambien} onChange={(e) => setTambien(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0b2da0]" />
            <span className="text-[13px] leading-snug text-[#3B4262]">
              <span className="block text-[13.5px] font-semibold text-[#0B1033]">
                Guardar también en {gemela.curso} ({diaLegible(gemela.fecha)})
              </span>
              {gemela.mismo_tema === false ? <>Ojo: allí el tema es «{gemela.tema || 'sin tema'}». Márcalo solo si es la misma clase. </> : null}
              El tema, la tarea, las notas y las presentaciones y archivos del equipo (lo vacío aquí no se borra allí). Cada grupo conserva su día, quién la da, la presentación de sus alumnos, sus notas de la pizarra y su grabación.
            </span>
          </label>
        ) : null}
        {admin ? (
          <button onClick={quitarClase} disabled={!!ocupado} className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#B42323] hover:underline">
            <Trash2 size={14} /> Quitar esta clase
          </button>
        ) : null}
      </Seccion>
    </>
  )

  const meta = [
    fecha ? { icono: <CalendarDays size={15} />, texto: esHoy ? `Hoy, ${diaLegible(fecha)}` : diaLegible(fecha) } : null,
    clase?.hora || semana.hora ? { icono: <Clock3 size={15} />, texto: clase?.hora || semana.hora } : null,
    { icono: <User size={15} />, texto: da || 'Sin profe puesto' },
  ].filter(Boolean) as { icono: React.ReactNode; texto: string }[]

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-[#0B1033]/35 backdrop-blur-[1px]" onClick={cerrar}>
      <div
        className="flex h-full w-full flex-col bg-white sm:max-w-[700px]"
        style={{ boxShadow: '-24px 0 48px -24px rgba(16,24,64,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <header className="shrink-0 px-5 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-center gap-3">
            <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium text-[#4A5272]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: semana.color }} />
              <span className="truncate">{semana.curso}</span>
            </p>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E6EAF2] px-2.5 py-1 text-[12.5px] font-medium text-[#3B4262]">
              <span className="h-2 w-2 rounded-full" style={{ background: PUNTO[estado.estado] || '#9AA1B9' }} />
              {estado.texto}
            </span>
            <button onClick={cerrar} aria-label="Cerrar" className="-mr-2 shrink-0 rounded-lg p-1.5 text-[#6B7393] transition-colors hover:bg-[#F2F4F8] hover:text-[#0B1033]">
              <X size={20} />
            </button>
          </div>
          <h2 className="mt-2 text-[24px] font-bold leading-tight text-[#0B1033]" style={POPPINS}>
            {tema.trim() || <span className="text-[#9AA1B9]">Sin tema todavía</span>}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] text-[#3B4262]">
            {meta.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 first-letter:uppercase">
                <span className="text-[#8A91AD]">{m.icono}</span>
                {m.texto}
              </span>
            ))}
          </div>
          {!yaFue || esHoy ? (
            <div className="mt-2.5">
              <Confirmados c={semana.confirmaciones} compacto />
            </div>
          ) : null}
          {estado.faltan.length && estado.estado !== 'dada' ? (
            <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-[#8A6A2A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D9A23B]" /> Falta: {estado.faltan.join(', ')}.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {esHoy ? (
              <Link href={ruta(`/sala/${uuid}`)} className={BOTON_AZUL}>
                Entrar a la sala
              </Link>
            ) : null}
            <a href={`/pizarra/${semana.semanaId}`} className={esHoy || !hayPdf ? BOTON : BOTON_AZUL} title={hayPdf ? undefined : 'Sin presentación, se abre en blanco'}>
              Abrir la pizarra
            </a>
            <Link href={ruta(`/course/${uuid}`)} className={BOTON}>
              Página de la clase
            </Link>
          </div>
          {/* Las dos caras de la ficha */}
          {yaFue ? (
            <nav className="-mx-1 mt-5 flex gap-1 border-b border-[#EEF1F6]" role="tablist">
              {(
                [
                  ['preparar', 'Preparar'],
                  ['despues', 'Después de la clase'],
                ] as const
              ).map(([k, t]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={cara === k}
                  onClick={() => setCara(k)}
                  className={`relative -mb-px flex items-center gap-1.5 px-3 pb-3 pt-1 text-[14px] font-semibold transition-colors ${
                    cara === k ? 'text-[#0B1033]' : 'text-[#8A91AD] hover:text-[#3B4262]'
                  }`}
                >
                  {t}
                  {k === 'despues' && pendientesDespues ? (
                    <span className="rounded-full bg-[#F2F4F8] px-1.5 text-[11.5px] font-semibold text-[#3B4262]">{pendientesDespues}</span>
                  ) : null}
                  {cara === k ? <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#0b2da0]" /> : null}
                </button>
              ))}
            </nav>
          ) : (
            <div className="mt-5 border-b border-[#EEF1F6]" />
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* El mensaje del administrador, tal como lo ve el profe */}
          {!admin && semana.material?.mensaje?.texto ? (
            <div className="px-5 pt-5 sm:px-7">
              <MensajeDelAdmin semana={semana} admin={false} token={token} onLeido={onCambio} />
            </div>
          ) : null}
          {yaFue && cara === 'despues' ? despuesDeLaClase : preparar}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#EEF1F6] bg-white px-5 py-3 sm:px-7">
          {semana.fecha > hoy ? <span className="mr-auto text-[12.5px] text-[#6B7393] first-letter:uppercase">{cuando(semana.fecha, hoy)}</span> : null}
          {cambiado ? <span className="mr-auto text-[12.5px] text-[#8A6A2A] sm:mr-2">Cambios sin guardar</span> : null}
          <button onClick={cerrar} className="h-10 rounded-lg border border-[#E2E7F0] px-4 text-[14px] font-semibold text-[#3B4262] transition-colors hover:bg-[#F7F9FD]">
            Cerrar
          </button>
          <button
            onClick={guardar}
            disabled={!!ocupado || !cambiado}
            className="h-10 rounded-lg bg-[#0b2da0] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0a2690] disabled:opacity-40"
          >
            {ocupado === 'guardar' ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>

      {lista ? (
        <div onClick={(e) => e.stopPropagation()}>
          <PasarLista
            semanaId={semana.semanaId}
            tema={semana.tema}
            curso={semana.curso}
            token={token}
            onCerrar={() => setLista(false)}
            onGuardada={() => {
              setLista(false)
              onCambio()
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

/** A toda la ventana, por encima de la barra de la escuela (ver `EnElCuerpo`). */
export default function FichaClase(props: React.ComponentProps<typeof FichaDentro>) {
  return (
    <EnElCuerpo>
      <FichaDentro key={props.semana.key} {...props} />
    </EnElCuerpo>
  )
}
