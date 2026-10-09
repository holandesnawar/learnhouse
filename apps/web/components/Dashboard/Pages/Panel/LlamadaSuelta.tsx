'use client'

/**
 * Tarjeta suelta de Nuevo / Por llamar (08/10): alguien de la lista de Llamadas que
 * no tiene ficha (apuntado a mano solo con el móvil, o con un correo que no ha
 * dejado ningún otro rastro). Como no hay ficha que abrir, se abre esto: lo
 * mismo que sale al abrirlo en Llamadas (`DetalleLlamada`), en el mismo panel
 * lateral que la ficha.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { cambiarTemplada, quitarTemplada, type DatosTemplada, type Templada } from '@services/stats/contactos'
import { DetalleLlamada, Termometro } from '../Estadisticas/LlamadasTempladas'
import { confirmar } from '@lib/nawar/confirmar'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { META } from './ui'

export default function LlamadaSuelta({ llamada, onClose, onCambio }: { llamada: Templada; onClose: () => void; onCambio: () => void }) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [t, setT] = useState<Templada>(llamada)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])

  async function cambiar(d: DatosTemplada, aviso = 'Guardado') {
    setGuardando(true)
    const r = await cambiarTemplada(org?.id, t.id, d, accessToken)
    setGuardando(false)
    if (!r.ok || !r.datos) {
      toast.error(r.error || 'No se ha podido guardar')
      return false
    }
    toast.success(aviso)
    onCambio()
    // Hecha: sale del tablero (sin correo no hay columna a la que pasar).
    if (d.estado && d.estado !== 'pendiente') onClose()
    else {
      // Lo que devuelve el servidor no trae la temperatura (sale al listar):
      // se queda la que había, o la que se acaba de poner a mano.
      const nuevo: Templada = { ...t, ...r.datos.templada }
      if (d.temperatura !== undefined) {
        nuevo.temperatura_manual = d.temperatura
        nuevo.temperatura = d.temperatura || t.temperatura_auto
      }
      setT(nuevo)
    }
    return true
  }

  async function quitar() {
    const quien = t.nombre || t.telefono || t.email
    const borra = t.origen === 'mano' && !t.email
    const pregunta = borra
      ? `¿Borrar a ${quien} de la lista de Llamadas? Sus notas de aquí se pierden.`
      : `¿Quitar a ${quien} de la lista de Llamadas? No vuelve a entrar sola (se puede devolver desde Llamadas, «Hechas o quitadas»).`
    if (!(await confirmar(pregunta))) return
    const r = await quitarTemplada(org?.id, t.id, accessToken)
    if (!r.ok) {
      toast.error(r.error || 'No se ha podido quitar')
      return
    }
    onCambio()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/25" />
      <div className="relative h-full w-full sm:max-w-[560px] bg-[#F9FAFB] border-l border-[#E5E7EB] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-4 sm:px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[18px] font-semibold text-gray-900 truncate">{t.nombre || t.telefono || t.email}</p>
              <p className="text-[12.5px] text-[#6B7280] truncate">{[t.email, t.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="shrink-0 p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]">
              <X size={18} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Termometro t={t.temperatura} aMano={Boolean(t.temperatura_manual)} />
            <span className={META}>
              {t.origen === 'mano' ? `Apuntada por ${t.creado_por || 'el equipo'}` : t.origen_nombre}
            </span>
          </div>
          {t.origen !== 'mano' && t.detalle ? <p className="mt-1.5 text-[13px] text-gray-800">{t.detalle}</p> : null}
        </div>
        <div className="p-4 sm:p-5">
          <div className="rounded-lg border border-[#E5E7EB] bg-white">
            <DetalleLlamada
              t={t}
              guardando={guardando}
              cambiar={(d, aviso) => cambiar(d, aviso)}
              quitar={quitar}
              onCambioNotas={onCambio}
              className="p-4 space-y-3"
            />
          </div>
          <p className="mt-3 text-[12px] text-[#9CA3AF] leading-relaxed">
            No tiene ficha porque no ha dejado ningún formulario con su correo. Al marcarla como hecha o quitarla, sale del
            tablero (sigue en Llamadas, en «Hechas o quitadas»).
          </p>
        </div>
      </div>
    </div>
  )
}
