'use client'
/**
 * «¿Vienes a la clase?» (rediseño, 08/11/2026): Asistiré / No puedo. Lo usan
 * el Inicio y la página de cada clase. Va aparte para que la página de la
 * clase (SemanasClase) lo use sin importar de MisClasesAlumno, que a su vez
 * importa de ella. La clave de la caché es la de `claveSemanas`.
 */
import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { confirmarVoy, type Semana } from '@services/tareas/tareas'

// ── «¿Vienes a la clase?» ───────────────────────────────────────────────────

export function Vienes({
  semana,
  courseUuid,
  compacto = false,
  textos = ['Voy', 'No puedo'],
  segmento = false,
}: {
  semana: Semana
  courseUuid: string
  compacto?: boolean
  textos?: [string, string]
  /** Un solo control con dos mitades, sin mensajes (Inicio, 08/11). */
  segmento?: boolean
}) {
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const qc = useQueryClient()
  const [voy, setVoy] = useState<boolean | null>(semana.voy ?? null)
  const [guardando, setGuardando] = useState(false)
  const elegir = async (va: boolean) => {
    if (guardando) return
    const nuevo = voy === va ? null : va
    setVoy(nuevo)
    setGuardando(true)
    try {
      await confirmarVoy(semana.id, nuevo, token)
      qc.invalidateQueries({ queryKey: ['tareas', 'semanas', String(courseUuid || '').replace(/^course_/, '')] })
      qc.invalidateQueries({ queryKey: ['tareas', 'mi-semana'] })
    } catch {
      setVoy(semana.voy ?? null)
    } finally {
      setGuardando(false)
    }
  }
  const boton = (va: boolean, texto: string) => {
    const on = voy === va
    return (
      <button
        onClick={() => elegir(va)}
        disabled={guardando}
        className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13.5px] font-semibold border transition-colors ${
          on
            ? va
              ? 'bg-[#E9F7EF] border-[#86D3A6] text-[#13703D]'
              : 'bg-[#FDF0F0] border-[#F1B2B2] text-[#B42323]'
            : 'bg-white border-[#DDE3F0] text-[#2B3150] hover:border-[#0b2da0]/40'
        }`}
      >
        {va ? <Check size={15} strokeWidth={2.6} /> : <X size={15} strokeWidth={2.6} />}
        {texto}
      </button>
    )
  }
  if (segmento) {
    const parte = (va: boolean, texto: string) => {
      const on = voy === va
      return (
        <button
          type="button"
          onClick={() => elegir(va)}
          disabled={guardando}
          aria-pressed={on}
          className={`h-9 px-4 text-[13.5px] font-semibold transition-colors ${
            on ? (va ? 'bg-[#0b2da0] text-white' : 'bg-[#EEF1F7] text-[#0B1033]') : 'bg-white text-[#3B4262] hover:bg-[#F5F7FC]'
          }`}
        >
          {texto}
        </button>
      )
    }
    return (
      <div className="inline-flex rounded-lg border border-[#DDE3F0] overflow-hidden divide-x divide-[#DDE3F0]">
        {parte(true, textos[0])}
        {parte(false, textos[1])}
      </div>
    )
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compacto ? '' : 'pt-1'}`}>
      {!compacto && <span className="text-[13.5px] font-semibold text-[#2B3150] mr-1">¿Vienes a la clase?</span>}
      {boton(true, textos[0])}
      {boton(false, textos[1])}
      {voy === true && <span className="text-[12.5px] text-[#13703D]">¡Te esperamos!</span>}
      {voy === false && <span className="text-[12.5px] text-[#6B7393]">Tendrás la grabación después.</span>}
    </div>
  )
}

