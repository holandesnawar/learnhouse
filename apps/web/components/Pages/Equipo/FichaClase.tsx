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
 * - **El documento de la clase**: se arrastra aquí. El PDF es lo que se abre
 *   al pulsar «Pizarra» en la sala.
 * - **Para los alumnos**: la presentación que miran antes (se sube aquí mismo).
 * - **Notas para el profe**.
 *
 * Los archivos se guardan al subirlos; lo demás, con «Guardar». Si la clase
 * tiene gemela (el otro grupo), la casilla de siempre lo copia allí.
 */
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Check, FileText, Link2, Trash2, UploadCloud, X } from 'lucide-react'
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
import { createFileActivity, updateActivity } from '@services/courses/activities'
import { cuando, diaLegible, estadoDeClase, quienDa, tieneDocumento, type SemanaEquipo } from '@/lib/nawar/salaProfes'
import { confirmar } from '@/lib/nawar/confirmar'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import GrabacionDeSala from '@components/Pages/Grabaciones/GrabacionDeSala'
import { PasarLista } from '@components/Pages/Profes/ListaYGrupo'
import { MensajeDelAdmin } from './PrepararClase'
import type { ClaseEquipo } from './useClasesEquipo'
import { POPPINS } from './estilo'

const BOTON =
  'shrink-0 h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg border border-[#DDE3EF] bg-white text-[13.5px] font-semibold text-[#0b2da0] hover:border-[#0b2da0]'
const BOTON_AZUL = 'shrink-0 h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold hover:bg-[#0a2690]'
const CAMPO = 'w-full rounded-lg border border-[#DDE3EF] bg-white px-3 py-2 text-[14px] text-[#0B1033] outline-none focus:border-[#0b2da0]'
const ETIQUETA = 'text-[13px] font-semibold text-[#3B4262]'
const TITULO = 'text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]'

const TONO: Record<string, string> = {
  'por-preparar': 'border-[#E9DCC0] bg-[#FFFBF2] text-[#8A6A2A]',
  lista: 'border-[#BFE3CB] bg-[#F3FBF5] text-[#15803D]',
  hoy: 'border-[#0b2da0] bg-[#0b2da0] text-white',
  dada: 'border-[#DDE3EF] bg-[#F6F8FC] text-[#3B4262]',
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
  const [presentaciones, setPresentaciones] = useState(semana.presentaciones.length)
  const [nombreEnlace, setNombreEnlace] = useState('')
  const [url, setUrl] = useState('')
  const [conEnlace, setConEnlace] = useState(false)
  const [ocupado, setOcupado] = useState('')
  const [encima, setEncima] = useState(false)
  const [lista, setLista] = useState(false)
  const [archivosTocados, setArchivosTocados] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const entradaAlumnos = useRef<HTMLInputElement>(null)
  // La misma clase en el otro grupo (10/11/2026): se edita una vez.
  const [gemela, setGemela] = useState<Gemela | null>(null)
  const [tambien, setTambien] = useState(true)

  useEffect(() => {
    let vivo = true
    getGemela(semana.semanaId, token)
      .then((r) => vivo && setGemela(r.gemela))
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
    material: { ...material, profe },
    presentaciones: presentaciones ? semana.presentaciones.concat(semana.presentaciones.length ? [] : [{ activity_uuid: 'nueva', nombre: 'Presentación' }]) : [],
  }
  const estado = estadoDeClase(ahora, hoy, profeClase)
  const yaFue = !!semana.fecha && semana.fecha <= hoy
  const esHoy = semana.fecha === hoy
  const da = quienDa(ahora, profeClase)
  const pizarra = material.pizarra
  const hayPdf = tieneDocumento(ahora)

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
  const subirParaAlumnos = async (f?: File | null) => {
    if (!f || !semana.chapterId) return
    setOcupado('alumnos')
    try {
      const act: any = await createFileActivity(f, 'documentpdf', { name: 'Presentación' }, semana.chapterId, token)
      if (!act?.activity_uuid) throw new Error('No se ha podido subir la presentación')
      await updateActivity({ published: true }, act.activity_uuid, token)
      setPresentaciones((n) => n + 1)
      setArchivosTocados(true)
      toast.success('Los alumnos ya la pueden ver')
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido subir')
    } finally {
      setOcupado('')
      if (entradaAlumnos.current) entradaAlumnos.current.value = ''
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

  const despuesDeLaClase = yaFue ? (
    <section className="px-5 sm:px-6 py-5 border-b border-[#EEF1F7]">
      <p className={TITULO}>{esHoy ? 'Hoy, al terminar' : 'Después de la clase'}</p>
      <ul className="mt-1.5 divide-y divide-[#EEF1F7]">
        <Linea
          hecho={!!semana.lista?.pasada}
          titulo={semana.lista?.pasada ? `Asistencia: vinieron ${semana.lista.vinieron}` : 'Asistencia: la cuenta la sala sola'}
          detalle={semana.lista?.pasada ? undefined : 'Quien entra a la sala cuenta. Si alguien vino por otro sitio, corrígelo.'}
          accion={
            <button onClick={() => setLista(true)} className={BOTON}>
              {semana.lista?.pasada ? 'Ver la lista' : 'Corregir'}
            </button>
          }
        />
        <Linea
          hecho={!!pizarra?.publicada_at}
          titulo={
            pizarra?.publicada_at
              ? `Pizarra: los alumnos ya tienen las notas de la clase (${pizarra.paginas || 0} páginas)`
              : pizarra?.guardada_at
                ? 'Pizarra: hay cosas escritas, sin guardar para los alumnos'
                : 'Pizarra: no se escribió nada'
          }
          accion={
            hayPdf || pizarra?.guardada_at ? (
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
      {/* Lo que grabó la sala ese día, para publicarlo o recortarlo. */}
      <GrabacionDeSala semana={{ id: semana.semanaId, tema: semana.tema, fecha: semana.fecha }} courseUuid={uuid} hoy={hoy} />
      <label className="block mt-4">
        <span className={ETIQUETA}>Cómo fue la clase</span>
        <textarea
          value={despues}
          onChange={(e) => setDespues(e.target.value)}
          rows={2}
          placeholder="Dos líneas: hasta dónde llegasteis, qué costó, qué repetir la próxima vez."
          className={`${CAMPO} mt-1 resize-y`}
        />
        {semana.material?.despues?.por ? <span className="block mt-1 text-[12.5px] text-[#6B7393]">Lo escribió {semana.material.despues.por}.</span> : null}
      </label>
    </section>
  ) : null

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-[#0a1656]/40" onClick={cerrar}>
      <div className="w-full sm:max-w-[640px] h-full overflow-y-auto bg-white" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera */}
        <header className="sticky top-0 z-10 bg-white px-5 sm:px-6 pt-5 pb-4 border-b border-[#EEF1F7]">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5B6382]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: semana.color }} />
                <span className="truncate">{semana.curso}</span>
              </p>
              <h2 className="mt-1 text-[21px] font-bold text-[#0B1033] leading-tight" style={POPPINS}>
                {tema.trim() || 'Sin tema todavía'}
              </h2>
              <p className="mt-1 text-[13.5px] text-[#3B4262] first-letter:uppercase">
                {[fecha ? (esHoy ? `hoy, ${diaLegible(fecha)}` : diaLegible(fecha)) : '', clase?.hora || semana.hora, da ? `la da ${da}` : 'sin profe puesto'].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className={`shrink-0 mt-0.5 inline-flex h-7 items-center rounded-full border px-2.5 text-[12.5px] font-semibold ${TONO[estado.estado]}`}>{estado.texto}</span>
            <button onClick={cerrar} aria-label="Cerrar" className="shrink-0 -mr-1.5 p-1.5 rounded-lg text-[#6B7393] hover:text-[#0B1033]">
              <X size={20} />
            </button>
          </div>
          {estado.faltan.length && estado.estado !== 'dada' ? (
            <p className="mt-2 text-[13px] text-[#8A6A2A]">Falta: {estado.faltan.join(', ')}.</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {esHoy ? (
              <Link href={ruta(`/sala/${uuid}`)} className={BOTON_AZUL}>
                Entrar a la sala
              </Link>
            ) : null}
            {hayPdf ? (
              <a href={`/pizarra/${semana.semanaId}`} className={esHoy ? BOTON : BOTON_AZUL}>
                Abrir la pizarra
              </a>
            ) : null}
            <Link href={ruta(`/course/${uuid}`)} className={BOTON}>
              Página de la clase
            </Link>
          </div>
        </header>

        {/* El mensaje del administrador, tal como lo ve el profe */}
        {!admin && semana.material?.mensaje?.texto ? (
          <div className="px-5 sm:px-6 pt-1 pb-4 border-b border-[#EEF1F7]">
            <MensajeDelAdmin semana={semana} admin={false} token={token} onLeido={onCambio} />
          </div>
        ) : null}

        {/* Ya dada: lo primero es lo que pasó. Si es hoy, va al final (primero se prepara). */}
        {yaFue && !esHoy ? despuesDeLaClase : null}

        {/* La clase */}
        <section className="px-5 sm:px-6 py-5 border-b border-[#EEF1F7]">
          <p className={TITULO}>La clase</p>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-[1fr_170px]">
            <label className="block">
              <span className={ETIQUETA}>Tema</span>
              <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Se puede poner después" className={`${CAMPO} mt-1`} />
            </label>
            <label className="block">
              <span className={ETIQUETA}>Día</span>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`${CAMPO} mt-1`} />
            </label>
          </div>
          {admin ? (
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className={ETIQUETA}>Quién la da</span>
                <input
                  value={profe}
                  onChange={(e) => setProfe(e.target.value)}
                  list="nawar-ficha-nombres"
                  placeholder={profeClase ? `Vacío = ${profeClase} (quien da esta clase)` : 'Nombre del profe o del monitor'}
                  className={`${CAMPO} mt-1`}
                />
                <datalist id="nawar-ficha-nombres">
                  {nombres.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <span className="block mt-1 text-[12.5px] text-[#6B7393]">Su nombre de pila, como en su cuenta. Le sale en su sala de profes.</span>
              </label>
              <label className="block">
                <span className={ETIQUETA}>Mensaje para quien la da</span>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={2}
                  placeholder="Lo verá arriba de esta clase, con tu nombre, y lo marcará como leído."
                  className={`${CAMPO} mt-1 resize-y`}
                />
                {semana.material?.mensaje?.texto ? (
                  <span className="block mt-1 text-[12.5px] text-[#6B7393]">
                    {semana.material.mensaje.leido_por ? `Leído por ${semana.material.mensaje.leido_por}.` : 'Aún sin leer.'}
                  </span>
                ) : null}
              </label>
            </div>
          ) : null}
        </section>

        {/* El documento de la clase */}
        <section className="px-5 sm:px-6 py-5 border-b border-[#EEF1F7]">
          <p className={TITULO}>El documento de la clase</p>
          <p className="mt-1 text-[13px] text-[#5B6382]">
            Solo lo ve el equipo. Si es un PDF, es lo que se abre al pulsar «Pizarra» en la sala, listo para escribir encima.
          </p>
          {material.archivos.length ? (
            <ul className="mt-2.5 divide-y divide-[#EEF1F7] rounded-xl border border-[#E4E8F2]">
              {material.archivos.map((a) => (
                <li key={a.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  {a.tipo === 'enlace' ? <Link2 size={16} className="text-[#0b2da0] shrink-0" /> : <FileText size={16} className="text-[#0b2da0] shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-[#0B1033] truncate">{a.nombre}</span>
                    <span className="block text-[12px] text-[#6B7393]">{a.por ? `Lo añadió ${a.por}` : ''}</span>
                  </span>
                  <button onClick={() => abrirArchivoProfe(semana.semanaId, a, token).catch((e) => toast.error(e?.message || 'No se ha podido abrir'))} className={BOTON}>
                    Abrir
                  </button>
                  <button onClick={() => quitar(a)} disabled={ocupado === a.id} aria-label="Quitar" className="p-1.5 rounded-lg text-[#8A91AD] hover:text-[#B42323]">
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
            accept=".pdf,.pptx,.ppt,.key,.odp,.docx,.doc,.png,.jpg,.jpeg,.webp,.mp3,.m4a,.mp4"
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
            className={`mt-2.5 w-full rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
              encima ? 'border-[#0b2da0] bg-[#F3F6FE]' : 'border-[#D5DEEE] hover:border-[#0b2da0]'
            }`}
          >
            <UploadCloud size={22} strokeWidth={1.7} className="mx-auto text-[#0b2da0]" />
            <span className="mt-1.5 block text-[14px] font-semibold text-[#0B1033]">{ocupado === 'subir' ? 'Subiendo…' : 'Arrastra aquí el documento o pulsa para elegirlo'}</span>
            <span className="block text-[12.5px] text-[#6B7393]">PDF para la pizarra. También PowerPoint, Keynote, Word, audio… hasta 80 MB.</span>
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
        </section>

        {/* Para los alumnos */}
        <section className="px-5 sm:px-6 py-5 border-b border-[#EEF1F7]">
          <p className={TITULO}>Para los alumnos</p>
          <ul className="mt-1.5">
            <Linea
              hecho={presentaciones > 0}
              titulo={presentaciones > 0 ? 'Presentación para mirar antes de la clase, subida' : 'Sin presentación para mirar antes de la clase'}
              detalle={
                presentaciones > 0
                  ? 'La ven en la página de su clase.'
                  : 'Opcional. Un PDF que los alumnos ven en su clase antes de que empiece; el documento de arriba no lo ven.'
              }
              accion={
                semana.chapterId ? (
                  <button onClick={() => entradaAlumnos.current?.click()} disabled={!!ocupado} className={BOTON}>
                    {ocupado === 'alumnos' ? 'Subiendo…' : presentaciones > 0 ? 'Subir otra' : 'Subir PDF'}
                  </button>
                ) : (
                  <Link href={ruta(`/course/${uuid}`)} className={BOTON}>
                    En la clase
                  </Link>
                )
              }
            />
          </ul>
          <input ref={entradaAlumnos} type="file" accept=".pdf" className="hidden" onChange={(e) => subirParaAlumnos(e.target.files?.[0])} />
        </section>

        {esHoy ? despuesDeLaClase : null}

        {/* Notas */}
        <section className="px-5 sm:px-6 py-5">
          <label className="block">
            <span className={TITULO}>Notas para quien la da</span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={4}
              placeholder="Cómo dar la clase, qué repasar, a quién preguntar, qué hacer si sobra tiempo…"
              className={`${CAMPO} mt-2 resize-y`}
            />
          </label>

          {gemela ? (
            <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#E4EBF8] bg-[#F5F8FE] px-3.5 py-3 cursor-pointer">
              <input type="checkbox" checked={tambien} onChange={(e) => setTambien(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0b2da0]" />
              <span className="text-[13.5px] leading-snug text-[#2B3150]">
                <span className="font-semibold text-[#0B1033]">
                  Guardar también en {gemela.curso} ({diaLegible(gemela.fecha)})
                </span>
                <br />
                El tema, la tarea, las notas y el documento. Cada grupo conserva su día, quién la da, su grabación y sus entregas.
              </span>
            </label>
          ) : null}

          {admin ? (
            <button onClick={quitarClase} disabled={!!ocupado} className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#B42323] hover:underline">
              <Trash2 size={14} /> Quitar esta clase
            </button>
          ) : null}
        </section>

        <footer className="sticky bottom-0 bg-white border-t border-[#EEF1F7] px-5 sm:px-6 py-3 flex items-center justify-end gap-2">
          {semana.fecha > hoy ? <span className="mr-auto text-[12.5px] text-[#6B7393] first-letter:uppercase">{cuando(semana.fecha, hoy)}</span> : null}
          <button onClick={cerrar} className="h-10 px-4 rounded-lg border border-[#DDE3EF] text-[14px] font-semibold text-[#3B4262]">
            Cerrar
          </button>
          <button onClick={guardar} disabled={!!ocupado || !cambiado} className="h-10 px-4 rounded-lg bg-[#0b2da0] text-white text-[14px] font-semibold disabled:opacity-50">
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
