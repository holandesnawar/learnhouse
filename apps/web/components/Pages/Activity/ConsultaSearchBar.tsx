'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { HelpCircle, Search, Loader2, ArrowUpRight, Plus } from 'lucide-react'
import {
  listConsultas,
  htmlToText,
  type Consulta,
  CATEGORY_BY_ID,
} from '@/lib/consultas/consultas'
import { getUriWithOrg } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'

interface ConsultaSearchBarProps {
  initialQuery?: string
}

/**
 * Search bar shown below each lesson. The student types their doubt, sees the
 * top 3 matching consultas inline (already-answered get a "Respondida" badge),
 * and can either jump to one of them or open the full /consultas page in the
 * academy with the query pre-applied. Everything stays inside the academy —
 * no jumps to the legacy external Consultas app.
 */
export default function ConsultaSearchBar({ initialQuery = '' }: ConsultaSearchBarProps) {
  const org = useOrg() as any
  const orgslug = org?.slug || ''
  const [query, setQuery] = useState(initialQuery)
  const [all, setAll] = useState<Consulta[] | null>(null)
  const [loading, setLoading] = useState(false)
  const fetched = useRef(false)

  async function ensureLoaded() {
    if (fetched.current || loading) return
    fetched.current = true
    setLoading(true)
    try {
      setAll(await listConsultas())
    } catch {
      setAll([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialQuery) ensureLoaded()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !all) return []
    // Match the search term across title, content and the published answer
    // (respuesta_nawar) so any consulta that mentions the word — whether in
    // the question or in our reply — surfaces here.
    return all
      .filter((c) => {
        const blob = [
          c.title,
          c.content,
          c.respuesta_nawar ?? '',
        ]
          .map((s) => (s ? htmlToText(s).toLowerCase() : ''))
          .join(' ')
        return blob.includes(q)
      })
      .slice(0, 3)
  }, [all, query])

  const consultasHref = (extra: string = '') =>
    getUriWithOrg(orgslug, `/consultas${extra}`)

  return (
    <div className="rounded-2xl border border-[#DDE6F5] bg-white p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <HelpCircle size={18} className="text-[#025dc7] shrink-0" />
        <p className="text-[15px] font-semibold text-gray-900">
          ¿Tienes una duda sobre esta lección?
        </p>
      </div>
      <p className="text-[14.5px] text-gray-500 -mt-1 leading-relaxed">
        Escribe las palabras clave de tu duda. Por ejemplo, si no entiendes el verbo
        «nemen», busca <strong>nemen</strong> (mejor que escribir «¿Cómo se usa el verbo nemen?»).
        Si no aparece nada, puedes crear una consulta nueva.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const q = query.trim()
          if (!q) return
          window.location.href = consultasHref(`?q=${encodeURIComponent(q)}`)
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onFocus={ensureLoaded}
            onChange={(e) => {
              setQuery(e.target.value)
              if (e.target.value) ensureLoaded()
            }}
            placeholder={'p. ej. "zijn", "trabajar", "saludos"…'}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#F0F5FF] hover:bg-[#E5ECFF] focus:bg-white text-[#1D0084] placeholder:text-[#1D0084]/45 outline-none border border-transparent focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 text-[14.5px] placeholder:text-[14px] transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim()}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#1D0084] text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search size={14} />
          Buscar
        </button>
      </form>

      {query.trim() && (
        <div className="space-y-2 pt-1">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              Buscando…
            </div>
          )}
          {!loading && matches.length > 0 && (
            <>
              <p className="text-[11px] font-bold text-[#025dc7] uppercase tracking-wider px-1">
                {matches.length} {matches.length === 1 ? 'resultado' : 'resultados'}
              </p>
              <ul className="space-y-1.5">
                {matches.map((c) => {
                  const cat = CATEGORY_BY_ID[c.category]
                  return (
                    <li key={c.id}>
                      <Link
                        href={consultasHref(
                          `?id=${encodeURIComponent(String(c.id))}&q=${encodeURIComponent(query.trim())}`
                        )}
                        className="group flex items-start gap-2 px-3 py-2 rounded-lg bg-[#F0F5FF] hover:bg-[#E5ECFF] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[13px] font-semibold text-gray-900 truncate">
                              {c.title}
                            </p>
                            {c.resolved && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-wider">
                                Respondida
                              </span>
                            )}
                          </div>
                          {cat && (
                            <span className="text-[10px] text-[#025dc7] font-semibold uppercase tracking-wider">
                              {cat.short}
                            </span>
                          )}
                        </div>
                        <ArrowUpRight
                          size={14}
                          className="text-gray-400 group-hover:text-[#025dc7] mt-0.5 shrink-0"
                        />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          {!loading && matches.length === 0 && all !== null && (
            <div className="rounded-lg bg-[#F0F5FF] px-3 py-3 text-sm text-gray-600 flex items-center justify-between gap-2 flex-wrap">
              <span>
                No encontramos consultas con <strong>{query.trim()}</strong>.
              </span>
              <Link
                href={consultasHref(`?q=${encodeURIComponent(query.trim())}&new=1`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#1D0084] text-xs font-bold transition-colors"
              >
                <Plus size={12} /> Crear consulta
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
