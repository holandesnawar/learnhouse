'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, FileText, Send, AlertTriangle, CheckCircle2 } from 'lucide-react'
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
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [modo, setModo] = useState<string>('')
  const [filas, setFilas] = useState<MatriculaPagada[] | null>(null)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [recargando, setRecargando] = useState(false)

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
        <button
          onClick={refrescar}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-[#025dc7] hover:bg-[#EAF3FF] transition-colors"
        >
          <RefreshCw size={15} className={recargando ? 'animate-spin' : ''} />
          Actualizar
        </button>
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
