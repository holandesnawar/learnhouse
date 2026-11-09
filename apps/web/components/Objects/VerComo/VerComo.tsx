'use client'
/**
 * «Ver como» un alumno (08/11/2026). Lo explica entero
 * apps/api/src/services/panel/ver_como.py.
 *
 * - `BotonVerComo`: en Organizar → Alumnos (solo administradores).
 * - `FranjaVerComo`: abajo, mientras se mira como otra persona, con «Volver
 *   a mi cuenta». Lee la cookie `LH_ver_como` (solo el nombre).
 * - `volverDeVerComo`: lo usa también «Cerrar sesión» del perfil.
 */
import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Eye, ArrowLeft } from 'lucide-react'

export function nombreVerComo(): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.split('; ').find((c) => c.startsWith('LH_ver_como='))
  if (!m) return ''
  try {
    return decodeURIComponent(decodeURIComponent(m.slice('LH_ver_como='.length)))
  } catch {
    return m.slice('LH_ver_como='.length)
  }
}

export async function volverDeVerComo() {
  try {
    await fetch('/api/auth/ver-como/salir', { method: 'POST', credentials: 'include' })
  } catch {}
  window.location.href = '/organizar'
}

export function BotonVerComo({ orgId, userId, nombre }: { orgId: number; userId: number; nombre: string }) {
  const [ocupado, setOcupado] = useState(false)
  const pila = (nombre || '').split(' ')[0] || 'este alumno'
  return (
    <button
      type="button"
      disabled={ocupado}
      title={`Ver la escuela como la ve ${nombre}. Solo mirar: no se cambia nada.`}
      onClick={async () => {
        setOcupado(true)
        try {
          const r = await fetch('/api/auth/ver-como', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: orgId, user_id: userId }),
          })
          const d = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(d?.detail || 'No se ha podido')
          window.location.href = '/'
        } catch (e: any) {
          toast.error(e?.message || 'No se ha podido')
          setOcupado(false)
        }
      }}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#DDE3F0] bg-white text-[13px] font-semibold text-[#0b2da0] hover:border-[#0b2da0] disabled:opacity-60"
    >
      <Eye size={14} /> Ver como {pila}
    </button>
  )
}

export function FranjaVerComo() {
  const [nombre, setNombre] = useState('')
  useEffect(() => setNombre(nombreVerComo()), [])
  if (!nombre) return null
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-[#0B1033] text-white pl-4 pr-1.5 py-1.5 shadow-lg max-w-[calc(100vw-24px)]"
      style={{ zIndex: 9999 }}
      role="status"
    >
      <Eye size={16} className="shrink-0 text-[#8CC2FF]" />
      <span className="text-[13.5px] truncate">
        Estás viendo la escuela como <b>{nombre}</b> · solo mirar
      </span>
      <button
        onClick={volverDeVerComo}
        className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-white text-[#0B1033] text-[13px] font-semibold hover:bg-[#EAF0FE]"
      >
        <ArrowLeft size={14} /> Volver a mi cuenta
      </button>
    </div>
  )
}
