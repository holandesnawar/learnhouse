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

const ETIQUETA: Record<ReturnType<typeof tipoDe>, string> = {
  drive: 'Google Drive',
  youtube: 'Vídeo',
  pdf: 'PDF',
  imagen: 'Imagen',
  audio: 'Audio',
  enlace: 'Enlace',
  archivo: 'Archivo',
}

export default function RecursosPage() {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token
  const [carpetas, setCarpetas] = useState<Carpeta[] | null>(null)

  useEffect(() => {
    if (!accessToken) return
    getRecursos(accessToken).then(setCarpetas)
  }, [accessToken])

  return (
    <div className="pb-10">
      <div className="flex items-center gap-2 mb-2">
        <FolderSimple size={24} weight="fill" className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Recursos</h1>
      </div>
      <p className="text-[14px] text-gray-600 mb-6">
        Materiales de la escuela: apuntes, audios, carpetas compartidas y enlaces útiles.
      </p>

      {carpetas === null ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : carpetas.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE6F5] bg-white p-6 text-[14px] text-gray-600">
          Todavía no hay recursos. En cuanto el equipo suba algo, aparecerá aquí.
        </div>
      ) : (
        <div className="space-y-6">
          {carpetas.map((c) => (
            <section key={c.id} className="rounded-2xl border border-[#DDE6F5] bg-white p-4 sm:p-5">
              <h2 className="text-[16px] font-bold text-[#1D0084] flex items-center gap-2">
                <FolderSimple size={18} weight="fill" className="text-[#025dc7]" />
                {c.name}
              </h2>
              {c.description ? <p className="text-[13px] text-gray-500 mt-1">{c.description}</p> : null}
              {c.items.length === 0 ? (
                <p className="text-[13px] text-[#9CA3AF] mt-3">Esta carpeta está vacía.</p>
              ) : (
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {c.items.map((it) => (
                    <li key={it.id}>
                      <a
                        href={abrirUrl(it)}
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-3 rounded-xl border border-[#DDE6F5] bg-[#F7FAFF] hover:bg-[#EEF4FF] px-3.5 py-3 transition-colors"
                      >
                        <span className="w-9 h-9 rounded-lg bg-white border border-[#DDE6F5] flex items-center justify-center shrink-0">
                          <IconoRecurso item={it} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[14px] font-semibold text-gray-900 truncate">{it.title}</span>
                          <span className="block text-[12px] text-gray-500 truncate">
                            {ETIQUETA[tipoDe(it)]}
                            {it.size ? ` · ${tamano(it.size)}` : ''}
                          </span>
                        </span>
                        <ExternalLink size={15} className="text-[#9CA3AF] shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
