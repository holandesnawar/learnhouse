'use client'

/**
 * Avisos → «Ebook Black Friday» (28/10/2026): el ebook «Neerlandés sin
 * miedo» a 1 € y la campaña de correos que le sigue.
 *
 * Aquí se sube el PDF, se abre o cierra la venta, se enciende o apaga la
 * campaña y se cambian los textos. La campaña la manda la tarea diaria (un
 * correo al día como mucho) y se para sola cuando la persona reserva su
 * llamada, paga la formación o se da de baja. Servidor:
 * apps/api/src/services/ebook/ebook.py.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  getEbook,
  guardarEbook,
  subirPdfEbook,
  vistaEbook,
  type CartaSuelta,
  type CorreoCampana,
  type Destino,
  type EbookBF,
} from '@services/ebook/ebook'
import { confirmar } from '@lib/nawar/confirmar'
import toast from 'react-hot-toast'
import { ChevronDown, Copy, Eye, FileUp, Loader2, Send } from 'lucide-react'
import { BOTON, BOTON_PRINCIPAL, META, TARJETA } from '../Panel/ui'

const CAMPO =
  'w-full bg-white rounded-md px-3 border border-[#E5E7EB] text-[13.5px] text-gray-900 placeholder:text-[#9CA3AF] outline-none focus:border-[#025dc7] transition-colors'

const DESTINOS: { valor: Destino; texto: string }[] = [
  { valor: 'admision', texto: 'El formulario de la llamada' },
  { valor: 'landing', texto: 'La oferta de la formación (/oferta)' },
  { valor: 'descarga', texto: 'Descargar el ebook' },
  { valor: 'ebook', texto: 'La página del ebook (para comprarlo)' },
]

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const diaCorto = (d: string) => {
  if (!d || d.length < 10) return d
  const [a, m, dd] = d.slice(0, 10).split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, dd, 12))
  return `${DIAS[f.getUTCDay()]} ${dd} ${f.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }).replace('.', '')}`
}
const cuandoSale = (c: CorreoCampana) =>
  c.fecha ? `El ${diaCorto(c.fecha)}, a todos los que sigan en la campaña` : `${c.dia === 1 ? '1 día' : `${c.dia} días`} después de comprar el ebook`

function Interruptor({ activo, onClick, ocupado }: { activo: boolean; onClick: () => void; ocupado: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      onClick={onClick}
      disabled={ocupado}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${activo ? 'bg-[#16A34A]' : 'bg-[#D1D5DB]'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function Enlace({ titulo, url }: { titulo: string; url: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-gray-900">{titulo}</p>
        <a href={url} target="_blank" rel="noreferrer" className="text-[12.5px] text-[#025dc7] break-all hover:underline">
          {url}
        </a>
      </div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(url).then(
            () => toast.success('Enlace copiado'),
            () => toast.error('No se ha podido copiar')
          )
        }}
        className={BOTON}
        aria-label={`Copiar ${titulo}`}
      >
        <Copy size={14} />
      </button>
    </div>
  )
}

export default function EbookBlackFriday() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token

  const [estado, setEstado] = useState<EbookBF | null>(null)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [entrega, setEntrega] = useState<EbookBF['entrega'] | null>(null)
  const [pendiente, setPendiente] = useState<CartaSuelta | null>(null)
  const [acceso, setAcceso] = useState<CartaSuelta | null>(null)
  const [correos, setCorreos] = useState<CorreoCampana[]>([])
  const [abierto, setAbierto] = useState<string>('')
  const [vista, setVista] = useState<{ cual: string; asunto: string; html: string } | null>(null)
  const [ocupado, setOcupado] = useState('')
  const [error, setError] = useState('')
  const archivo = useRef<HTMLInputElement>(null)

  const poner = (e: EbookBF) => {
    setEstado(e)
    setDesde(e.desde)
    setHasta(e.hasta)
    setEntrega(e.entrega)
    setPendiente(e.pendiente)
    setAcceso(e.acceso)
    setCorreos(e.correos)
  }

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    const r = await getEbook(org.id, token)
    if (!r.ok) return setError(r.error)
    poner(r.datos)
  }, [org?.id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  const cambiado =
    !!estado &&
    (desde !== estado.desde ||
      hasta !== estado.hasta ||
      JSON.stringify(entrega) !== JSON.stringify(estado.entrega) ||
      JSON.stringify(pendiente) !== JSON.stringify(estado.pendiente) ||
      JSON.stringify(acceso) !== JSON.stringify(estado.acceso) ||
      JSON.stringify(correos) !== JSON.stringify(estado.correos))

  const guardar = async (extra: Partial<EbookBF> = {}) => {
    if (!org?.id) return false
    setError('')
    const r = await guardarEbook(
      org.id,
      { desde, hasta, entrega: entrega || undefined, pendiente: pendiente || undefined, acceso: acceso || undefined, correos, ...extra },
      token
    )
    if (!r.ok) {
      setError(r.error)
      return false
    }
    poner(r.datos)
    return true
  }

  const alternar = async (campo: 'activo' | 'campana') => {
    if (!estado) return
    const nuevo = !estado[campo]
    if (!nuevo) {
      const ok = await confirmar(
        campo === 'activo'
          ? 'Nadie podrá comprar el ebook hasta que lo vuelvas a abrir. ¿Cierras la venta?'
          : 'No saldrá ningún correo de la campaña hasta que la vuelvas a encender. ¿La apagas?',
        { boton: campo === 'activo' ? 'Cerrar la venta' : 'Apagar la campaña' }
      )
      if (!ok) return
    }
    setOcupado(campo)
    const ok = await guardar({ [campo]: nuevo } as Partial<EbookBF>)
    setOcupado('')
    if (ok) toast.success(campo === 'activo' ? (nuevo ? 'Venta abierta' : 'Venta cerrada') : nuevo ? 'Campaña encendida' : 'Campaña apagada')
  }

  const subir = async (f: File | undefined) => {
    if (!f || !org?.id) return
    setOcupado('pdf')
    setError('')
    const r = await subirPdfEbook(org.id, f, token)
    setOcupado('')
    if (archivo.current) archivo.current.value = ''
    if (!r.ok) return setError(r.error)
    poner(r.datos)
    toast.success('PDF subido')
  }

  const ver = async (cual: string, aMi: boolean) => {
    setOcupado(`${aMi ? 'prueba' : 'vista'}:${cual}`)
    // La vista usa lo guardado: si hay cambios, se guardan antes.
    if (cambiado && !(await guardar())) return setOcupado('')
    const r = await vistaEbook(org.id, cual, aMi, token)
    setOcupado('')
    if (!r.ok) return setError(r.error)
    if (aMi) return toast.success('Prueba enviada a tu correo')
    setVista({ cual, asunto: r.datos.asunto, html: r.datos.html })
  }

  const cambiarCorreo = (id: string, cambio: Partial<CorreoCampana>) =>
    setCorreos((cs) => cs.map((c) => (c.id === id ? { ...c, ...cambio } : c)))

  // Un correo suelto (el de la oferta desbloqueada y el recordatorio del ebook):
  // asunto, texto, botón y a dónde lleva, y se puede apagar.
  const cartaSuelta = (clave: string, carta: CartaSuelta, poner: (c: CartaSuelta) => void, cuando: string) => (
    <div className={`rounded-lg border border-[#E5E7EB] ${carta.apagado ? 'opacity-60' : ''}`}>
      <button onClick={() => setAbierto(abierto === clave ? '' : clave)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
        <ChevronDown size={16} className={`shrink-0 text-[#6B7280] transition-transform ${abierto === clave ? '' : '-rotate-90'}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-gray-900 truncate">{carta.asunto}</span>
          <span className={META}>
            {carta.apagado ? 'Apagado · ' : ''}
            {cuando}
          </span>
        </span>
        <span className="shrink-0 text-[12.5px] text-[#6B7280] tabular-nums">
          {estado?.numeros.por_correo[clave] ? `Enviado a ${estado.numeros.por_correo[clave]}` : ''}
        </span>
      </button>
      {abierto === clave ? (
        <div className="border-t border-[#F3F4F6] p-3.5 space-y-3">
          <label className="inline-flex items-center gap-2 text-[13px] text-gray-800">
            <input type="checkbox" checked={carta.apagado} onChange={(e) => poner({ ...carta, apagado: e.target.checked })} />
            Apagar este correo
          </label>
          <input value={carta.asunto} onChange={(e) => poner({ ...carta, asunto: e.target.value })} className={`${CAMPO} h-9`} />
          <textarea
            value={carta.texto}
            onChange={(e) => poner({ ...carta, texto: e.target.value })}
            rows={12}
            className={`${CAMPO} py-2.5 leading-relaxed resize-y`}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={carta.boton} onChange={(e) => poner({ ...carta, boton: e.target.value })} placeholder="Texto del botón" className={`${CAMPO} h-9`} />
            <select value={carta.destino} onChange={(e) => poner({ ...carta, destino: e.target.value as Destino })} className={`${CAMPO} h-9`}>
              {DESTINOS.map((d) => (
                <option key={d.valor} value={d.valor}>
                  Lleva a: {d.texto}
                </option>
              ))}
            </select>
          </div>
          {botonesVista(clave)}
          {vistaDe(clave)}
        </div>
      ) : null}
    </div>
  )

  if (error && !estado) return <p className="text-[13.5px] text-red-700">{error}</p>
  if (!estado || !entrega)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )

  const n = estado.numeros
  const vistaDe = (cual: string) =>
    vista && vista.cual === cual ? (
      <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
        <p className="px-3.5 py-2 border-b border-[#E5E7EB] text-[12.5px] text-[#6B7280] truncate">
          Asunto: <span className="text-gray-900">{vista.asunto}</span> <span className="text-[#9CA3AF]">· con «Ana» de ejemplo</span>
        </p>
        <iframe title="Vista previa" srcDoc={vista.html} className="w-full h-[760px] bg-white" sandbox="" />
      </div>
    ) : null

  const botonesVista = (cual: string) => (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => ver(cual, false)} disabled={!!ocupado} className={BOTON}>
        {ocupado === `vista:${cual}` ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Ver cómo queda
      </button>
      <button onClick={() => ver(cual, true)} disabled={!!ocupado} className={BOTON}>
        {ocupado === `prueba:${cual}` ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Mandármelo a mí
      </button>
    </div>
  )

  return (
    <div className="max-w-3xl space-y-5">
      {/* Venta y campaña */}
      <div className={`${TARJETA} p-4 sm:p-5 space-y-4`}>
        <div>
          <p className="text-[16px] font-semibold text-gray-900">«{estado.nombre_ebook}» a {(estado.precio_cents / 100).toLocaleString('es-ES')} €</p>
          <p className="text-[13px] text-[#4B5563] mt-1 leading-relaxed">
            El ebook A0-A1 como imán de Black Friday. Quien lo compra recibe el PDF al momento y entra en la campaña de correos, que le
            lleva a pedir su llamada. <strong>La campaña se para sola</strong> en cuanto reserva la llamada, paga la formación o se da de baja.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[#F3F4F6] pt-3">
          <div>
            <p className="text-[14px] font-medium text-gray-900">Venta del ebook</p>
            <p className={META}>{estado.activo ? 'Abierta: se puede comprar' : 'Cerrada: la página dice que no está disponible'}</p>
          </div>
          <Interruptor activo={estado.activo} onClick={() => alternar('activo')} ocupado={ocupado === 'activo'} />
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[#F3F4F6] pt-3">
          <div>
            <p className="text-[14px] font-medium text-gray-900">Campaña de correos</p>
            <p className={META}>{estado.campana ? 'Encendida: sale cada mañana' : 'Apagada: no sale ningún correo de la campaña'}</p>
          </div>
          <Interruptor activo={estado.campana} onClick={() => alternar('campana')} ocupado={ocupado === 'campana'} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[#F3F4F6] pt-3">
          <label className="space-y-1.5">
            <span className="text-[13px] font-medium text-gray-800">Empieza</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={`${CAMPO} h-9`} />
          </label>
          <label className="space-y-1.5">
            <span className="text-[13px] font-medium text-gray-800">Termina (incluido)</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={`${CAMPO} h-9`} />
          </label>
        </div>
        <p className={META}>Después del último día ya no se vende el ebook y no sale ningún correo más.</p>
      </div>

      {/* El PDF */}
      <div className={`${TARJETA} p-4 sm:p-5 space-y-3`}>
        <p className="text-[15px] font-semibold text-gray-900">El PDF del ebook</p>
        {estado.pdf_listo ? (
          <p className="text-[13px] text-gray-800 inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#16A34A]" />
            Subido: {estado.pdf_nombre}
            {estado.pdf_subido_en ? (
              <span className="text-[#9CA3AF]">
                {' '}
                · {new Date(estado.pdf_subido_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-[13px] text-[#B91C1C] leading-relaxed">
            Todavía no hay PDF. Quien compre recibirá el correo igual, pero el enlace le dirá que el ebook se está preparando hasta que lo
            subas.
          </p>
        )}
        <input ref={archivo} type="file" accept="application/pdf" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
        <button onClick={() => archivo.current?.click()} disabled={!!ocupado} className={BOTON}>
          {ocupado === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}{' '}
          {estado.pdf_listo ? 'Cambiar el PDF' : 'Subir el PDF'}
        </button>
        <p className={META}>Los enlaces ya enviados siguen funcionando: descargan siempre el último PDF que subas.</p>
      </div>

      {/* Números */}
      <div className={`${TARJETA} p-4 sm:p-5 space-y-3`}>
        <p className="text-[15px] font-semibold text-gray-900">Cómo va</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            ['Desbloquearon la oferta', n.lista ?? 0],
            ['Compraron el ebook', n.compradores],
            ['Sin comprar el ebook', n.a_medias ?? 0],
            ['En la campaña', n.en_campana],
            ['Reservaron llamada', n.reservaron],
            ['Pagaron la formación', n.pagaron],
            ['Se dieron de baja', n.bajas],
          ].map(([t, v]) => (
            <div key={t as string}>
              <p className="text-[22px] font-semibold text-gray-900 tabular-nums">{v as number}</p>
              <p className={META}>{t as string}</p>
            </div>
          ))}
        </div>
        {n.ultimos.length ? (
          <div className="border-t border-[#F3F4F6] pt-2 divide-y divide-[#F3F4F6]">
            {n.ultimos.map((u) => (
              <div key={u.email} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                <span className="min-w-0 truncate text-gray-900">
                  {u.nombre || u.email} <span className="text-[#9CA3AF]">· {u.email}{u.via ? ` · ${u.via}` : ''}</span>
                </span>
                <span className={`shrink-0 font-medium ${u.estado === 'pagó' ? 'text-[#15803D]' : u.estado === 'reservó' ? 'text-[#025dc7]' : 'text-[#6B7280]'}`}>
                  {u.estado}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={META}>Todavía no ha dejado sus datos nadie.</p>
        )}
      </div>

      {/* Las páginas */}
      <div className={`${TARJETA} p-4 sm:p-5`}>
        <p className="text-[15px] font-semibold text-gray-900 mb-1">Las páginas</p>
        <p className={`${META} mb-2`}>
          El camino: desbloquear la oferta → el ebook a 1 € → al pagar, la oferta de la formación y el botón a la llamada. Para anuncios y
          orgánico, el mismo enlace de la portada; con <code>utm_medium=paid</code> en el de los anuncios, cada compra sale como «Ads» en su
          ficha.
        </p>
        <Enlace titulo="Desbloquear la oferta (solo el formulario: el enlace para anuncios, bio, historias y DM)" url={`${estado.bf_url}/`} />
        <Enlace titulo="Ebook · orgánico (a aquí lleva la portada sin anuncio)" url={`${estado.bf_url}/ebook`} />
        <Enlace titulo="Ebook · anuncios (a aquí lleva la portada con anuncio)" url={`${estado.bf_url}/ebook-ads`} />
        <Enlace titulo="La oferta de la formación (tras pagar el ebook; aquí llevan los correos de la campaña)" url={`${estado.bf_url}/oferta`} />
      </div>

      {/* Los correos */}
      <div className={`${TARJETA} p-4 sm:p-5 space-y-3`}>
        <div>
          <p className="text-[15px] font-semibold text-gray-900">Los correos</p>
          <p className={`${META} mt-0.5`}>
            Los firma Rida y llevan su botón. Huecos: <code>{'{nombre}'}</code> (su nombre de pila) y <code>{'{hasta}'}</code> (el último
            día, p. ej. «lunes 30 de noviembre»). Una línea con <code>[boton]</code> pone el botón ahí (en el de entrega,{' '}
            <code>[descarga]</code> es el del PDF). <code>*así*</code> va en negrita.
          </p>
        </div>

        {/* Entrega */}
        <div className="rounded-lg border border-[#E5E7EB]">
          <button onClick={() => setAbierto(abierto === 'entrega' ? '' : 'entrega')} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
            <ChevronDown size={16} className={`shrink-0 text-[#6B7280] transition-transform ${abierto === 'entrega' ? '' : '-rotate-90'}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-gray-900 truncate">{entrega.asunto}</span>
              <span className={META}>Al momento, al comprar (con el PDF)</span>
            </span>
          </button>
          {abierto === 'entrega' ? (
            <div className="border-t border-[#F3F4F6] p-3.5 space-y-3">
              <input value={entrega.asunto} onChange={(e) => setEntrega({ ...entrega, asunto: e.target.value })} className={`${CAMPO} h-9`} />
              <textarea
                value={entrega.texto}
                onChange={(e) => setEntrega({ ...entrega, texto: e.target.value })}
                rows={14}
                className={`${CAMPO} py-2.5 leading-relaxed resize-y`}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={entrega.boton}
                  onChange={(e) => setEntrega({ ...entrega, boton: e.target.value })}
                  placeholder="Texto del segundo botón"
                  className={`${CAMPO} h-9`}
                />
                <select value={entrega.destino} onChange={(e) => setEntrega({ ...entrega, destino: e.target.value as Destino })} className={`${CAMPO} h-9`}>
                  {DESTINOS.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      Lleva a: {d.texto}
                    </option>
                  ))}
                </select>
              </div>
              {botonesVista('entrega')}
              {vistaDe('entrega')}
            </div>
          ) : null}
        </div>

        {/* Al desbloquear la oferta, y a quien dejó sus datos y no compró el ebook */}
        {acceso ? cartaSuelta('acceso', acceso, setAcceso, 'Al momento, a quien desbloquea la oferta en la portada (lleva al ebook)') : null}
        {pendiente ? cartaSuelta('pendiente', pendiente, setPendiente, 'Al día siguiente, a quien dejó sus datos y no compró el ebook') : null}

        {correos.map((c) => (
          <div key={c.id} className={`rounded-lg border border-[#E5E7EB] ${c.apagado ? 'opacity-60' : ''}`}>
            <button onClick={() => setAbierto(abierto === c.id ? '' : c.id)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
              <ChevronDown size={16} className={`shrink-0 text-[#6B7280] transition-transform ${abierto === c.id ? '' : '-rotate-90'}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-gray-900 truncate">{c.asunto}</span>
                <span className={META}>
                  {c.apagado ? 'Apagado · ' : ''}
                  {cuandoSale(c)}
                </span>
              </span>
              <span className="shrink-0 text-[12.5px] text-[#6B7280] tabular-nums">
                {n.por_correo[c.id] ? `Enviado a ${n.por_correo[c.id]}` : ''}
              </span>
            </button>
            {abierto === c.id ? (
              <div className="border-t border-[#F3F4F6] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {c.fecha ? (
                    <label className="inline-flex items-center gap-2 text-[13px] text-gray-800">
                      Sale el
                      <input type="date" value={c.fecha} onChange={(e) => cambiarCorreo(c.id, { fecha: e.target.value })} className={`${CAMPO} h-9 w-auto`} />
                    </label>
                  ) : (
                    <label className="inline-flex items-center gap-2 text-[13px] text-gray-800">
                      Sale
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={c.dia}
                        onChange={(e) => cambiarCorreo(c.id, { dia: Number(e.target.value) || 1 })}
                        className={`${CAMPO} h-9 w-20`}
                      />
                      días después de comprar
                    </label>
                  )}
                  <label className="inline-flex items-center gap-2 text-[13px] text-gray-800">
                    <input type="checkbox" checked={c.apagado} onChange={(e) => cambiarCorreo(c.id, { apagado: e.target.checked })} />
                    Apagar este correo
                  </label>
                </div>
                <input value={c.asunto} onChange={(e) => cambiarCorreo(c.id, { asunto: e.target.value })} className={`${CAMPO} h-9`} />
                <textarea
                  value={c.texto}
                  onChange={(e) => cambiarCorreo(c.id, { texto: e.target.value })}
                  rows={14}
                  className={`${CAMPO} py-2.5 leading-relaxed resize-y`}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={c.boton} onChange={(e) => cambiarCorreo(c.id, { boton: e.target.value })} placeholder="Texto del botón" className={`${CAMPO} h-9`} />
                  <select value={c.destino} onChange={(e) => cambiarCorreo(c.id, { destino: e.target.value as Destino })} className={`${CAMPO} h-9`}>
                    {DESTINOS.map((d) => (
                      <option key={d.valor} value={d.valor}>
                        Lleva a: {d.texto}
                      </option>
                    ))}
                  </select>
                </div>
                {botonesVista(c.id)}
                {vistaDe(c.id)}
              </div>
            ) : null}
          </div>
        ))}

        {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={async () => {
              setOcupado('guardar')
              const ok = await guardar()
              setOcupado('')
              if (ok) toast.success('Guardado')
            }}
            disabled={!!ocupado || !cambiado}
            className={BOTON_PRINCIPAL}
          >
            {ocupado === 'guardar' ? <Loader2 size={14} className="animate-spin" /> : null} Guardar
          </button>
          {cambiado ? <p className="text-[12.5px] text-[#B45309]">Hay cambios sin guardar.</p> : null}
        </div>
      </div>
    </div>
  )
}
