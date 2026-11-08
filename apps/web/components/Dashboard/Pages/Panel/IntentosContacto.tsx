'use client'
/**
 * Los intentos de contacto de «Contactado», en la ficha (08/11/2026).
 *
 * "Que al entrar en la ficha ponga: se ha llamado una vez, se ha escrito el
 * primer mensaje por WhatsApp, no responde, siguiente etapa… y si a la
 * tercera nada, descarte". Tres intentos; en cada uno se apunta la llamada y
 * el WhatsApp. Lo apuntado sale también en la línea de tiempo y en la tarjeta
 * del tablero («Intento 2 de 3»). Tras el tercero, «Descartar» (mover a
 * Descartado, como siempre). Servidor: services/panel/intentos.py.
 */
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Check, MessageCircle, Phone, X } from 'lucide-react'
import { apuntarIntento, quitarIntento, type Intentos } from '@services/panel/panel'
import { haceCuanto } from '@/lib/nawar/haceCuanto'

const TITULO: Record<number, string> = {
  1: 'Intento 1 · llamada y primer mensaje',
  2: 'Intento 2 · llamada y segundo mensaje',
  3: 'Intento 3 · última llamada y último mensaje',
}

export default function IntentosContacto({
  orgId,
  token,
  email,
  datos,
  onCambio,
  onDescartar,
}: {
  orgId: number
  token: string
  email: string
  datos: Intentos
  onCambio: () => void
  onDescartar: () => void
}) {
  const [ocupado, setOcupado] = useState('')
  const nivel = datos.nivel
  // El intento que toca: el primero sin las dos cosas hechas; si todo está, el 3.
  const toca = datos.intentos.find((i) => !i.llamada || !i.whatsapp)?.intento ?? 3
  const completos = datos.intentos.filter((i) => i.llamada && i.whatsapp).length

  async function cambiar(intento: number, que: 'llamada' | 'whatsapp', hecho: boolean) {
    const id = `${intento}-${que}`
    setOcupado(id)
    try {
      if (hecho) await quitarIntento(orgId, token, email, intento, que)
      else await apuntarIntento(orgId, token, email, intento, que, que === 'llamada' ? 'no contesta' : '')
      onCambio()
    } catch (e: any) {
      toast.error(e?.message || 'No se ha podido guardar')
    } finally {
      setOcupado('')
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-[#E2E8F4] bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#EEF1F7]">
        <p className="text-[12.5px] font-semibold text-gray-900">Intentos de contacto</p>
        <span className="text-[12px] text-[#6B7280]">{nivel ? `Va por el intento ${nivel} de 3` : 'Ninguno apuntado'}</span>
      </div>
      <ol className="divide-y divide-[#EEF1F7]">
        {datos.intentos.map((i) => {
          const futuro = i.intento > toca && !i.llamada && !i.whatsapp
          return (
            <li key={i.intento} className={`px-3 py-2.5 ${futuro ? 'opacity-55' : ''}`}>
              <p className="text-[12.5px] font-semibold text-[#0a1656]">{TITULO[i.intento]}</p>
              <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                {(['llamada', 'whatsapp'] as const).map((que) => {
                  const paso = i[que]
                  const id = `${i.intento}-${que}`
                  return (
                    <button
                      key={que}
                      type="button"
                      disabled={ocupado === id}
                      onClick={() => cambiar(i.intento, que, !!paso)}
                      title={paso ? 'Quitar' : 'Apuntar como hecho'}
                      className={`group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                        paso ? 'border-[#BBE5C8] bg-[#F3FBF5]' : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF]'
                      }`}
                    >
                      <span
                        className={`w-[18px] h-[18px] shrink-0 rounded-full border-2 flex items-center justify-center ${
                          paso ? 'border-[#16A34A] text-[#16A34A]' : 'border-[#C9CFDE]'
                        }`}
                      >
                        {paso ? <Check size={10} strokeWidth={3.4} /> : null}
                      </span>
                      {que === 'llamada' ? <Phone size={13} className="text-gray-500 shrink-0" /> : <MessageCircle size={13} className="text-gray-500 shrink-0" />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-gray-900">
                          {que === 'llamada' ? (paso ? 'Llamado · no contesta' : 'Llamar') : paso ? 'WhatsApp enviado' : 'Escribir por WhatsApp'}
                        </span>
                        {paso ? (
                          <span className="block text-[11.5px] text-[#6B7280] truncate">
                            {paso.autor || 'El equipo'} · {haceCuanto(paso.cuando)}
                          </span>
                        ) : null}
                      </span>
                      {paso ? <X size={13} className="shrink-0 text-gray-400 opacity-0 group-hover:opacity-100" /> : null}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ol>
      <div className="px-3 py-2.5 border-t border-[#EEF1F7] text-[12.5px] text-[#4B5563]">
        {completos >= 3 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Tres intentos sin respuesta.</span>
            <button
              onClick={onDescartar}
              className="h-8 px-3 rounded-md bg-[#B4413C] text-white text-[12.5px] font-semibold hover:bg-[#9c3833]"
            >
              Descartar
            </button>
          </div>
        ) : nivel === 0 ? (
          'Primero, llámale y mándale el primer mensaje.'
        ) : (
          `Si no responde, siguiente paso: ${TITULO[toca].toLowerCase()}.`
        )}
      </div>
    </div>
  )
}
