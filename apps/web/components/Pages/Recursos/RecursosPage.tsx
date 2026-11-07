'use client'

/**
 * Recursos — lo que el equipo comparte con los alumnos: PDFs de las clases,
 * carpetas de Drive, audios, enlaces. Por carpetas, en el orden que decide el
 * administrador. Se abre todo en pestaña nueva: aquí no se edita nada.
 */

import React, { useEffect, useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { FolderSimple } from '@phosphor-icons/react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { abrirUrl, getRecursos, tamano, tipoDe, type Carpeta } from '@services/recursos/recursos'
import IconoRecurso from './IconoRecurso'
import Portada from '@components/Pages/Espacios/Portada'

const ETIQUETA: Record<ReturnType<typeof tipoDe>, string> = {
  drive: 'Google Drive',
  youtube: 'Vídeo',
  pdf: 'PDF',
  imagen: 'Imagen',
  audio: 'Audio',
  enlace: 'Enlace',
  archivo: 'Archivo',
}

/** `embebido`: en el panel (el closer, Ventas → Recursos), sin el título. */
export default function RecursosPage({ embebido = false }: { embebido?: boolean }) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [carpetas, setCarpetas] = useState<Carpeta[] | null>(null)

  useEffect(() => {
    if (!accessToken) return
    getRecursos(accessToken).then(setCarpetas)
  }, [accessToken])

  const lista = carpetas || []
  const [filtro, setFiltro] = useState<string>('')
  const vistas = filtro ? lista.filter((c) => String(c.id) === filtro) : lista

  const contenido =
    carpetas === null ? (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    ) : carpetas.length === 0 ? (
      <div className="rounded-2xl border border-[#E4E8F2] bg-white p-6 text-[14px] text-[#4A5272]">
        Todavía no hay recursos. En cuanto el equipo suba algo, aparecerá aquí.
      </div>
    ) : (
      <div className="space-y-5">
        {vistas.map((c) => (
          <section key={c.id} id={`carpeta-${c.id}`} className="rounded-2xl border border-[#E4E8F2] bg-white">
            <div className="px-5 pt-4 pb-3 border-b border-[#EEF1F7]">
              <h2 className="text-[16px] font-bold text-[#0B1033]">{c.name}</h2>
              {c.description ? <p className="text-[13.5px] text-[#4A5272] mt-0.5">{c.description}</p> : null}
            </div>
            {c.items.length === 0 ? (
              <p className="px-5 py-4 text-[13.5px] text-[#8A91AD]">Esta carpeta está vacía.</p>
            ) : (
              <ul className="divide-y divide-[#EEF1F7]">
                {c.items.map((it) => (
                  <li key={it.id}>
                    <a href={abrirUrl(it)} target="_blank" rel="noopener" className="flex items-center gap-3 px-5 py-3 hover:bg-[#F7F9FD]">
                      <span className="shrink-0 text-[#6B7393]">
                        <IconoRecurso item={it} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14.5px] font-medium text-[#0B1033] truncate">{it.title}</span>
                        <span className="block text-[12.5px] text-[#8A91AD] truncate">
                          {ETIQUETA[tipoDe(it)]}
                          {it.size ? ` · ${tamano(it.size)}` : ''}
                        </span>
                      </span>
                      <ExternalLink size={15} className="text-[#A3AAC2] shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    )

  if (embebido) return <div className="pb-10">{contenido}</div>

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-5">
      <Portada clave="recursos" titulo="Recursos" subtitulo="Materiales de la escuela: apuntes, audios, carpetas compartidas y enlaces útiles.">
        {lista.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {[{ id: '', name: 'Todo' }, ...lista.map((c) => ({ id: String(c.id), name: c.name }))].map((c) => (
              <button
                key={c.id || 'todo'}
                type="button"
                onClick={() => setFiltro(c.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium border ${
                  filtro === c.id ? 'bg-[#EAF0FE] border-[#C9D6F5] text-[#0b2da0]' : 'bg-white border-[#E4E8F2] text-[#3B4262] hover:border-[#C9D4EC]'
                }`}
              >
                {c.id ? <FolderSimple size={14} /> : null}
                {c.name}
              </button>
            ))}
          </div>
        ) : null}
      </Portada>
      {contenido}
    </div>
  )
}
