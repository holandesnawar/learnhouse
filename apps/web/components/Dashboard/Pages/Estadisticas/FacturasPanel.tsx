'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Loader2,
  RefreshCw,
  FileText,
  Send,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  Copy,
} from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'

/**
 * Las facturas de los últimos pagos, con su botón.
 *
 * Existe porque el camino del cobro se traga sus propios errores a propósito
 * —un fallo de Stripe no puede dejar sin cuenta a quien acaba de pagar— y eso
 * deja al administrador sin forma de ver qué pasó ni de arreglarlo. Antes la
 * única salida era pedirle a alguien que lanzara peticiones a mano.
 *
 * Aquí se ve qué factura tiene cada pago y se puede reenviar o emitir la que
 * falte. Sirve igual el día que un alumno escriba diciendo que no le llegó.
 */

interface FacturaStripe {
  id: string
  numero: string
  estado: string
  finalizada: boolean
  correo_cliente: string
  pdf: string
}

interface MatriculaPagada {
  matricula: number
  email: string
  pagada: string
  importe: string
  atendida: boolean
  cliente_stripe: string
  facturas: FacturaStripe[]
  error: string
}

export default function FacturasPanel() {
  const [altaAbierta, setAltaAbierta] = useState(false)
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [modo, setModo] = useState<string>('')
  const [filas, setFilas] = useState<MatriculaPagada[] | null>(null)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [recargando, setRecargando] = useState(false)

  // Alta a mano: para quien pagó por fuera del checkout (un Payment Link, una
  // transferencia) o para quien el correo de bienvenida se le perdió.
  const [altaEmail, setAltaEmail] = useState('')
  const [altaNombre, setAltaNombre] = useState('')
  const [altaImporte, setAltaImporte] = useState('')
  const [altaSoloVenta, setAltaSoloVenta] = useState(false)
  const [dandoAlta, setDandoAlta] = useState(false)
  const [altaEnlace, setAltaEnlace] = useState('')

  const cargar = useCallback(async () => {
    if (!accessToken) return
    try {
      const r = await fetch(`${getAPIUrl()}superadmin/payments/diagnostico?limite=10`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!r.ok) throw new Error(`El servidor respondió ${r.status}`)
      const d = await r.json()
      setModo(d.modo_stripe || '')
      setFilas(d.matriculas || [])
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo cargar', { duration: 10000 })
      setFilas([])
    }
  }, [accessToken])

  useEffect(() => {
    cargar()
  }, [cargar])

  const refrescar = async () => {
    setRecargando(true)
    await cargar()
    setRecargando(false)
  }

  /** El motivo de verdad, que es lo que hacía falta y no había. */
  const contar = (d: any) => {
    if (d?.ok) {
      toast.success(
        d.numero ? `Factura ${d.numero} enviada a ${d.correo_cliente || 'el cliente'}` : 'Hecho',
        { duration: 8000 }
      )
    } else {
      toast.error(`${d?.paso ? d.paso + ': ' : ''}${d?.error || 'No se pudo'}`, { duration: 20000 })
    }
  }

  const reenviar = async (invoiceId: string) => {
    setTrabajando(invoiceId)
    try {
      const r = await fetch(`${getAPIUrl()}superadmin/payments/reenviar-factura/${invoiceId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      contar(await r.json())
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo reenviar', { duration: 15000 })
    } finally {
      setTrabajando(null)
      await cargar()
    }
  }

  const emitir = async (matricula: number) => {
    setTrabajando(`m${matricula}`)
    try {
      const r = await fetch(`${getAPIUrl()}superadmin/payments/factura/${matricula}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      contar(await r.json())
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo emitir', { duration: 15000 })
    } finally {
      setTrabajando(null)
      await cargar()
    }
  }

  const darDeAlta = async () => {
    const email = altaEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      toast.error('Escribe el correo con el que pagó')
      return
    }
    // El importe se escribe en euros y viaja en céntimos, que es como lo
    // guarda la tabla. Se acepta la coma decimal: en España se escribe "197,50".
    const euros = Number(altaImporte.trim().replace(',', '.'))
    const importe_cents = Number.isFinite(euros) && euros > 0 ? Math.round(euros * 100) : 0
    if (altaImporte.trim() && !importe_cents) {
      toast.error('El importe no se entiende. Escribe solo la cifra, por ejemplo 197')
      return
    }
    setDandoAlta(true)
    setAltaEnlace('')
    try {
      const r = await fetch(`${getAPIUrl()}superadmin/payments/dar-de-alta`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          nombre: altaNombre.trim(),
          importe_cents,
          enviar_correo: !altaSoloVenta,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d?.detail || `El servidor respondió ${r.status}`, { duration: 20000 })
        return
      }
      if (d.enlace) setAltaEnlace(d.enlace)
      if (altaSoloVenta) {
        toast.success(`${email} · sin tocar su cuenta`, { duration: 8000 })
        setAltaEmail('')
        setAltaNombre('')
        setAltaImporte('')
      } else if (d.correo_enviado) {
        toast.success(
          `${d.ya_existia ? 'Ya tenía cuenta' : 'Cuenta creada'} · correo enviado a ${email}`,
          { duration: 10000 }
        )
        setAltaEmail('')
        setAltaNombre('')
        setAltaImporte('')
      } else {
        toast.error(
          d.motivo || 'La cuenta está lista pero el correo no salió. Pásale el enlace a mano.',
          { duration: 25000 }
        )
      }
      // La venta va en su propio aviso: puede ir bien con el correo fallando, o
      // al revés, y lo que hay que hacer en cada caso es distinto.
      if (d.venta?.nota) {
        if (d.venta.contada) toast.success(d.venta.nota, { duration: 10000 })
        else toast.error(d.venta.nota, { duration: 25000 })
      }
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo dar de alta', { duration: 15000 })
    } finally {
      setDandoAlta(false)
      await cargar()
    }
  }

  if (filas === null) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-[#8A96AB] py-6">
        <Loader2 size={14} className="animate-spin" /> Cargando…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-[#5A6480] leading-relaxed max-w-2xl">
          Los últimos pagos y la factura de cada uno. Si a alguien no le llegó, aquí se
          reenvía. Modo de Stripe:{' '}
          <span className={`font-bold ${modo === 'live' ? 'text-emerald-700' : 'text-[#8A6A2A]'}`}>
            {modo || '—'}
          </span>
        </p>
        {/* Sin "Actualizar" propio: el de arriba de la página ya recarga esto. */}
      </div>

      {/* Alta a mano. Va ARRIBA, antes de la lista, porque cuando se abre esta
          pantalla con un alumno esperando es lo que se viene a hacer. */}
      {/* Sigue arriba, pero plegado: se usa poco y abierto tapaba la lista. */}
      <div className="rounded-xl border border-[#DDE6F5] bg-[#F7FAFF] px-4 py-3.5">
        <button onClick={() => setAltaAbierta((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
          <span className="flex items-center gap-2 text-[14px] font-bold text-[#1D0084]">
            <UserPlus size={16} className="text-[#025dc7]" />
            Dar de alta a mano
            <span className="font-normal text-[12.5px] text-[#5A6480]">· para quien pagó por fuera del checkout</span>
          </span>
          <ChevronDown size={16} className={`text-[#5A6480] transition-transform ${altaAbierta ? 'rotate-180' : ''}`} />
        </button>
        {altaAbierta ? (<>
        <p className="mt-1 text-[13px] text-[#5A6480] leading-relaxed max-w-2xl">
          Para quien pagó por fuera del checkout (un enlace de pago, una transferencia) o
          para quien el correo de bienvenida se perdió. Crea la cuenta si no existe, le
          manda el correo de &quot;crea tu contraseña&quot; y <strong>apunta la venta</strong>{' '}
          para que cuente en las estadísticas. Se puede repetir sin problema.
        </p>
        <p className="mt-1.5 text-[12.5px] text-[#8A6A2A] bg-[#FFFBF2] border border-[#EFE3C9] rounded-lg px-2.5 py-1.5 leading-relaxed max-w-2xl">
          Pon el importe que pagó de verdad — estos cobros suelen ir a otro precio. Sin
          importe la cuenta se crea igual, pero la venta no se apunta (para no meter un
          0 € en los ingresos). Si ya tenía una matrícula pagada, no se duplica.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="email"
            value={altaEmail}
            onChange={(e) => setAltaEmail(e.target.value)}
            placeholder="correo con el que pagó"
            className="flex-1 min-w-[220px] bg-white rounded-lg px-3 py-2 text-[13.5px] text-[#1D0084] border border-[#DDE6F5] outline-none focus:border-[#4da3ff] transition-colors"
          />
          <input
            type="text"
            value={altaNombre}
            onChange={(e) => setAltaNombre(e.target.value)}
            placeholder="nombre (opcional)"
            className="flex-1 min-w-[160px] bg-white rounded-lg px-3 py-2 text-[13.5px] text-[#1D0084] border border-[#DDE6F5] outline-none focus:border-[#4da3ff] transition-colors"
          />
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={altaImporte}
              onChange={(e) => setAltaImporte(e.target.value)}
              placeholder="197"
              className="w-[120px] bg-white rounded-lg pl-3 pr-7 py-2 text-[13.5px] text-[#1D0084] border border-[#DDE6F5] outline-none focus:border-[#4da3ff] transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#8A96AB] pointer-events-none">
              €
            </span>
          </div>
          <button
            onClick={darDeAlta}
            disabled={dandoAlta}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] text-[13px] font-bold transition-colors disabled:opacity-60"
          >
            {dandoAlta ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            {altaSoloVenta ? 'Apuntar la venta' : 'Darle de alta'}
          </button>
        </div>

        {/* Para arreglar la contabilidad de alguien que YA está dentro sin
            mandarle un "crea tu contraseña" que no espera. */}
        <label className="mt-2.5 flex items-center gap-2 text-[13px] text-[#5A6480] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={altaSoloVenta}
            onChange={(e) => setAltaSoloVenta(e.target.checked)}
            className="accent-[#025dc7] w-[15px] h-[15px]"
          />
          Ya entró: solo apuntar la venta, sin mandarle ningún correo
        </label>

        {/* El enlace se enseña SIEMPRE que la operación llega hasta aquí, salga
            o no el correo: así se le puede pasar por WhatsApp sin esperar a que
            el email aparezca (o a que salga de spam). */}
        {altaEnlace && (
          <div className="mt-3 rounded-lg border border-[#DDE6F5] bg-white px-3 py-2.5">
            <p className="text-[12.5px] font-semibold text-[#0a1656]">
              Su enlace para crear la contraseña (vale 7 días):
            </p>
            <p className="mt-1 text-[12px] text-[#5A6480] break-all leading-relaxed">
              {altaEnlace}
            </p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(altaEnlace)
                toast.success('Enlace copiado')
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold text-[#025dc7] border border-[#DDE6F5] hover:bg-[#F0F5FF] transition-colors"
            >
              <Copy size={13} /> Copiar el enlace
            </button>
          </div>
        )}
        </>) : null}
      </div>

      {filas.length === 0 && (
        <p className="text-[13.5px] text-[#8A96AB] py-4">Todavía no hay pagos confirmados.</p>
      )}

      <div className="space-y-2">
        {filas.map((f) => {
          const factura = f.facturas[0]
          return (
            <div
              key={f.matricula}
              className="rounded-xl border border-[#DDE6F5] bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[14px] font-bold text-[#1D0084]">{f.email}</span>
                <span className="text-[13px] text-[#5A6480]">{f.importe}</span>
                <span className="text-[12px] text-[#9CA3AF]">
                  matrícula {f.matricula}
                  {f.pagada ? ` · ${new Date(f.pagada).toLocaleDateString('es-ES')}` : ''}
                </span>
                {!f.atendida && (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#8A6A2A] bg-[#FFFBF2] border border-[#EFE3C9] rounded-md px-1.5 py-0.5">
                    <AlertTriangle size={11} /> sin correo de bienvenida
                  </span>
                )}
              </div>

              {f.error && (
                <p className="mt-2 text-[12.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 leading-relaxed">
                  {f.error}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {factura ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                      <CheckCircle2 size={14} />
                      {factura.numero || 'sin número'}
                      <span className="font-normal text-[#5A6480]">· {factura.estado}</span>
                    </span>
                    {factura.pdf && (
                      <a
                        href={factura.pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-[#025dc7] border border-[#DDE6F5] hover:bg-[#F0F5FF] transition-colors"
                      >
                        <FileText size={13} /> Ver el PDF
                      </a>
                    )}
                    <button
                      onClick={() => reenviar(factura.id)}
                      disabled={trabajando === factura.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] text-[12.5px] font-bold transition-colors disabled:opacity-60"
                    >
                      {trabajando === factura.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Send size={13} />
                      )}
                      Reenviar la factura
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] text-[#8A6A2A]">Sin factura.</span>
                    <button
                      onClick={() => emitir(f.matricula)}
                      disabled={trabajando === `m${f.matricula}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] text-[12.5px] font-bold transition-colors disabled:opacity-60"
                    >
                      {trabajando === `m${f.matricula}` ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <FileText size={13} />
                      )}
                      Emitir y enviar
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[12.5px] text-[#8A96AB] leading-relaxed">
        Si algo falla, el aviso rojo trae el motivo que da Stripe tal cual. Ese texto es
        justo lo que hace falta para arreglarlo, así que cópialo entero.
      </p>
    </div>
  )
}
