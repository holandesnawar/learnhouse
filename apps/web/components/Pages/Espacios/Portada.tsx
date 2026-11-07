'use client'
/**
 * La portada de un espacio, como en Circle (rediseño, rama diseno, 07/11/2026):
 * un banner limpio con el título del espacio y, debajo, lo que se quiera
 * poner (las carpetas de Recursos, la descripción de un canal).
 *
 * Lo pone el administrador con «Editar portada»: título, una frase y una
 * imagen (una dirección https). Sin imagen, el degradado azul de la escuela.
 * Se guarda en org_config `portadas[clave]` (`PUT /orgs/{id}/config/portadas/{clave}`).
 */
import React, { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { getAPIUrl } from '@services/config/config'

export type PortadaDatos = { titulo: string; subtitulo: string; imagen: string }

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

export function usePortada(clave: string, porDefecto: Partial<PortadaDatos>) {
  const org = useOrg() as any
  const guardada = (org?.config?.config?.portadas || {})[clave] as PortadaDatos | undefined
  return {
    titulo: guardada?.titulo || porDefecto.titulo || '',
    subtitulo: guardada?.subtitulo ?? porDefecto.subtitulo ?? '',
    imagen: guardada?.imagen || porDefecto.imagen || '',
  }
}

export default function Portada({
  clave,
  titulo,
  subtitulo = '',
  pequena = false,
  children,
}: {
  clave: string
  titulo: string
  subtitulo?: string
  pequena?: boolean
  children?: React.ReactNode
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const { isAdmin } = useAdminStatus() as any
  const inicial = usePortada(clave, { titulo, subtitulo })
  const [datos, setDatos] = useState<PortadaDatos>(inicial)
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState<PortadaDatos>(inicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      const r = await fetch(`${getAPIUrl()}orgs/${org.id}/config/portadas/${encodeURIComponent(clave)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.data?.tokens?.access_token}` },
        body: JSON.stringify(borrador),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.detail || 'No se pudo guardar')
      const d = await r.json()
      setDatos({ titulo: d.titulo || titulo, subtitulo: d.subtitulo ?? '', imagen: d.imagen || '' })
      setEditando(false)
    } catch (e: any) {
      setError(String(e?.message || 'No se pudo guardar'))
    } finally {
      setGuardando(false)
    }
  }

  const fondo = datos.imagen
    ? { backgroundImage: `linear-gradient(rgba(6,18,80,0.35), rgba(6,18,80,0.35)), url('${datos.imagen}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundImage: 'radial-gradient(circle 520px at 80% 120%, rgba(56,189,248,0.55), transparent 70%), linear-gradient(180deg, #0a1a6b 0%, #0b2da0 55%, #1d6ff2 100%)' }

  return (
    <div className="rounded-2xl overflow-hidden border border-[#E4E8F2] bg-white">
      <div className={`relative flex flex-col items-center justify-center text-center px-6 ${pequena ? 'h-[150px] sm:h-[170px]' : 'h-[190px] sm:h-[230px]'}`} style={fondo}>
        <h1 className="text-white font-bold leading-tight text-[30px] sm:text-[44px]" style={POPPINS}>
          {datos.titulo || titulo}
        </h1>
        <span className="mt-2 h-[2px] w-24 rounded-full bg-white/70" />
        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setBorrador(datos)
              setEditando(true)
            }}
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/90 text-[#0b2da0] text-[12.5px] font-semibold hover:bg-white"
          >
            <Pencil size={13} /> Editar portada
          </button>
        ) : null}
      </div>
      {datos.subtitulo || children ? (
        <div className="px-5 sm:px-6 py-4">
          {datos.subtitulo ? <p className="text-[14.5px] text-[#3B4262] leading-relaxed">{datos.subtitulo}</p> : null}
          {children ? <div className={datos.subtitulo ? 'mt-3' : ''}>{children}</div> : null}
        </div>
      ) : null}

      {editando ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[#0a1656]/40" onClick={() => setEditando(false)}>
          <div className="w-full max-w-[460px] rounded-2xl bg-white p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#0B1033]">Portada de «{titulo}»</h2>
              <button type="button" onClick={() => setEditando(false)} className="p-1.5 rounded-lg text-[#6B7393] hover:bg-[#F2F5FB]" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            {(
              [
                ['titulo', 'Título', titulo],
                ['subtitulo', 'Frase debajo (opcional)', 'Para qué sirve este espacio'],
                ['imagen', 'Imagen (dirección https, opcional)', 'https://…'],
              ] as const
            ).map(([k, etiqueta, ph]) => (
              <label key={k} className="block">
                <span className="block text-[12.5px] font-semibold text-[#3B4262] mb-1">{etiqueta}</span>
                <input
                  value={(borrador as any)[k]}
                  onChange={(e) => setBorrador({ ...borrador, [k]: e.target.value })}
                  placeholder={ph}
                  className="w-full h-10 px-3 rounded-lg border border-[#DDE3F0] text-[14px] outline-none focus:border-[#0b2da0]"
                />
              </label>
            ))}
            <p className="text-[12px] text-[#6B7393]">Sin imagen sale el degradado azul de la escuela.</p>
            {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditando(false)} className="h-9 px-3.5 rounded-lg text-[13.5px] font-semibold text-[#3B4262] hover:bg-[#F2F5FB]">
                Cancelar
              </button>
              <button type="button" disabled={guardando} onClick={guardar} className="h-9 px-4 rounded-lg bg-[#0b2da0] text-white text-[13.5px] font-semibold disabled:opacity-60">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
