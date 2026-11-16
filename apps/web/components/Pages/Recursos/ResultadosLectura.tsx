'use client'

/**
 * Para el equipo: quién ha hecho los ejercicios de una lectura, con cuánto, y
 * los que más se fallan (16/11/2026). Servidor: `services/lecturas/resultados.py`.
 */

import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import EnElCuerpo from '@components/Objects/EnElCuerpo'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getResultados, type ResultadosLectura as Datos } from '@services/lecturas/lecturas'

const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

function cuando(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
}

export default function ResultadosLectura({ orgId, lecturaId, titulo, onCerrar }: { orgId: number; lecturaId: string; titulo: string; onCerrar: () => void }) {
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const [datos, setDatos] = useState<Datos | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [verSin, setVerSin] = useState(false)

  useEffect(() => {
    if (!token) return
    getResultados(orgId, token)
      .then((l) => setDatos(l.find((x) => x.id === lecturaId) || null))
      .catch((e) => setError(e?.message || 'No se pudieron leer los resultados'))
  }, [orgId, lecturaId, token])

  return (
    <EnElCuerpo>
      <div className="fixed inset-0 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4" onClick={onCerrar}>
        <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-[640px] sm:max-h-[90vh] h-full sm:h-auto bg-white sm:rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-start gap-3 px-5 py-4 border-b border-[#EEF1F7]">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0b2da0]">Resultados de los alumnos</p>
              <h2 style={POPPINS} className="text-[18px] font-bold text-[#0B1033] truncate" lang="nl">
                {titulo}
              </h2>
            </div>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-2 rounded-lg text-[#6B7393] hover:text-[#0B1033]">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {error ? <p className="text-[14px] text-red-700">{error}</p> : null}
            {datos === undefined && !error ? <p className="text-[14px] text-[#6B7393]">Cargando…</p> : null}
            {datos === null ? <p className="text-[14px] text-[#6B7393]">Esta lectura aún no tiene ejercicios.</p> : null}
            {datos ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-[#EEF1F7] px-2 py-3">
                    <p style={POPPINS} className="text-[22px] font-semibold text-[#0B1033]">{datos.hechos.length}</p>
                    <p className="text-[12.5px] text-[#6B7393]">la han hecho</p>
                  </div>
                  <div className="rounded-xl border border-[#EEF1F7] px-2 py-3">
                    <p style={POPPINS} className="text-[22px] font-semibold text-[#0B1033]">{datos.sin_hacer.length}</p>
                    <p className="text-[12.5px] text-[#6B7393]">aún no</p>
                  </div>
                  <div className="rounded-xl border border-[#EEF1F7] px-2 py-3">
                    <p style={POPPINS} className="text-[22px] font-semibold text-[#0B1033]">{datos.media_pct === null ? '—' : `${datos.media_pct} %`}</p>
                    <p className="text-[12.5px] text-[#6B7393]">de aciertos</p>
                  </div>
                </div>

                {datos.mas_fallados.length ? (
                  <div>
                    <h3 className="text-[14px] font-bold text-[#0B1033] mb-2">Lo que más fallan</h3>
                    <ul className="space-y-1.5">
                      {datos.mas_fallados.map((f) => (
                        <li key={f.numero} className="text-[14px] text-[#0B1033]">
                          <span className="font-semibold">{f.numero}.</span> <span lang="nl">{f.pregunta}</span>
                          <span className="text-[#6B7393]">
                            {' '}· lo fallaron {f.veces} · respuesta: <span lang="nl">{f.correcta}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div>
                  <h3 className="text-[14px] font-bold text-[#0B1033] mb-2">Quién la ha hecho</h3>
                  {datos.hechos.length ? (
                    <ul className="divide-y divide-[#EEF1F7] rounded-xl border border-[#EEF1F7]">
                      {datos.hechos.map((h) => (
                        <li key={h.user_id} className="flex items-center gap-3 px-3 py-2.5">
                          <span className="flex-1 min-w-0">
                            <span className="block text-[14.5px] font-medium text-[#0B1033] truncate">{h.nombre}</span>
                            <span className="block text-[12.5px] text-[#8A91AD]">
                              {cuando(h.ultima)}
                              {h.veces && h.veces > 1 ? ` · ${h.veces} veces, la mejor ${h.mejor} de ${h.total}` : ''}
                              {h.fallos?.length ? ` · falló la ${h.fallos.join(', ')}` : ''}
                            </span>
                          </span>
                          <span className={`text-[14.5px] font-semibold ${h.aciertos === h.total ? 'text-[#16A34A]' : 'text-[#0B1033]'}`}>
                            {h.aciertos} de {h.total}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[14px] text-[#6B7393]">Nadie todavía.</p>
                  )}
                </div>

                {datos.sin_hacer.length ? (
                  <div>
                    <button type="button" onClick={() => setVerSin((v) => !v)} className="text-[13.5px] font-semibold text-[#0b2da0]">
                      {verSin ? 'Esconder' : 'Ver'} quién no la ha hecho ({datos.sin_hacer.length})
                    </button>
                    {verSin ? <p className="mt-2 text-[14px] text-[#4A5272]">{datos.sin_hacer.map((a) => a.nombre).join(', ')}</p> : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </EnElCuerpo>
  )
}
