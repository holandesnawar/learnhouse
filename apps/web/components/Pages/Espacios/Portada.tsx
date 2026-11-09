'use client'
/**
 * La portada de un espacio, como en Circle (rediseño, rama diseno, 07/11/2026):
 * un banner limpio con el título del espacio y, debajo, lo que se quiera
 * poner (las carpetas de Recursos, la descripción de un canal).
 *
 * Lo pone el administrador con «Editar portada»: título, una frase y una
 * imagen (una dirección https). Sin imagen, el azul de la escuela con su luz
 * y sus puntos, igual que el banner de «Bienvenida» (08/11).
 * Se guarda en org_config `portadas[clave]` (`PUT /orgs/{id}/config/portadas/{clave}`).
 */
import React, { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
  etiqueta = '',
  children,
}: {
  clave: string
  titulo: string
  subtitulo?: string
  pequena?: boolean
  /** La línea pequeña encima del título («Comunidad», «Empieza aquí»). */
  etiqueta?: string
  children?: React.ReactNode
}) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const { isAdmin } = useAdminStatus() as any
  const inicial = usePortada(clave, { titulo, subtitulo })
  const [datos, setDatos] = useState<PortadaDatos>(inicial)
  const queryClient = useQueryClient()
  // Lo guardado puede llegar después de pintar (la escuela aún cargaba) o
  // cambiar al guardar: la portada sigue a lo guardado (09/11/2026, "lo guardo
  // y me lo pone como antes").
  const huella = `${inicial.titulo}|${inicial.subtitulo}|${inicial.imagen}`
  useEffect(() => {
    setDatos(inicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella])
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
      // Que la escuela vuelva a leer su configuración: si no, al volver a
      // esta página salía la portada de antes (la guardada en memoria 5 min).
      queryClient.invalidateQueries({ queryKey: ['org'] })
    } catch (e: any) {
      setError(String(e?.message || 'No se pudo guardar'))
    } finally {
      setGuardando(false)
    }
  }

  const conImagen = !!datos.imagen
  const fondo = conImagen
    ? { backgroundImage: `linear-gradient(rgba(6,18,80,0.45), rgba(6,18,80,0.45)), url('${datos.imagen}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined
  const frase = datos.subtitulo

  return (
    <div className={children ? 'rounded-2xl overflow-hidden border border-[#E4E8F2] bg-white' : ''}>
      {/* El mismo banner que «Bienvenida» (Empieza aquí): azul de la escuela,
          la luz arriba a la derecha y los puntos de la marca. */}
      <section
        className={`rounded-2xl ${children ? 'rounded-b-none' : ''} bg-[#0b2da0] text-white px-5 sm:px-8 ${pequena ? 'py-6 sm:py-7' : 'py-7 sm:py-9'} relative overflow-hidden`}
        style={fondo}
      >
        {!conImagen ? (
          <div aria-hidden className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle 420px at 100% 0%, rgba(77,163,255,0.35), transparent 70%), radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: 'auto, 26px 26px' }} />
        ) : null}
        <div className="relative pr-28 sm:pr-36">
          {etiqueta ? <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9CC9FF]">{etiqueta}</p> : null}
          <h1 className={`${etiqueta ? 'mt-2' : ''} text-[26px] sm:text-[32px] font-bold leading-tight`} style={POPPINS}>
            {datos.titulo || titulo}
          </h1>
          {frase ? <p className="mt-2 text-[15px] text-white/90 max-w-[560px]">{frase}</p> : null}
        </div>
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
      </section>
      {children ? <div className="px-5 sm:px-6 py-4">{children}</div> : null}

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
            <p className="text-[12px] text-[#6B7393]">Sin imagen sale el azul de la escuela, como el de Bienvenida.</p>
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
