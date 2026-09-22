'use client'

/**
 * El bloc de enlaces UTM: monta una URL con sus utm_* y la guarda para
 * copiarla cuando toque. Vivía dentro de Estadísticas; ahora está en Webs,
 * que es donde se gestionan las direcciones. Se guarda en org_config
 * (`utm_links`), como siempre.
 */

import React, { useState } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { baseSinUtm, buildUtmUrl, readUtmLinks, saveUtmLinks, type UtmLink } from '@services/stats/school'
import { Check, Copy, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const CARD = 'rounded-2xl border border-[#DDE6F5] bg-white p-3.5 sm:p-5'
const INPUT =
  'bg-[#F0F5FF] rounded-xl px-3 py-2 text-[14px] text-[#1D0084] placeholder:text-[#1D0084]/45 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 transition-colors w-full'
const BTN =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] text-[14px] font-bold transition-colors disabled:opacity-60'

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[#9CA3AF] py-6 text-center">{children}</p>
}

const EMPTY_LINK: UtmLink = { name: '', url: '', source: '', medium: '', campaign: '', content: '' }

export default function UtmNotepad() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [links, setLinks] = useState<UtmLink[]>(() => readUtmLinks(org))
  const [draft, setDraft] = useState<UtmLink>(EMPTY_LINK)
  const [editando, setEditando] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  const preview = buildUtmUrl(draft)

  const persist = async (next: UtmLink[]) => {
    setSaving(true)
    const ok = await saveUtmLinks(org.id, next, accessToken)
    setSaving(false)
    if (ok) {
      setLinks(next)
      toast.success('Guardado')
      return true
    }
    toast.error('No se pudo guardar')
    return false
  }

  /**
   * Guardar es lo mismo para uno nuevo y para uno que se está editando: la
   * única diferencia es si se añade al final o se reemplaza en su sitio. Se
   * hace así, y no borrando y volviendo a añadir, para que editar NUNCA pueda
   * perder un enlace si el guardado falla a mitad: la lista se manda entera y
   * solo se cambia en pantalla cuando el servidor dice que sí.
   */
  const guardar = async () => {
    if (!draft.url.trim()) {
      toast.error('Falta el enlace')
      return
    }
    const montado = { ...draft, url: buildUtmUrl(draft) }
    const next =
      editando === null
        ? [...links, montado]
        : links.map((l, i) => (i === editando ? montado : l))
    if (await persist(next)) {
      setDraft(EMPTY_LINK)
      setEditando(null)
    }
  }

  /** Lleva el enlace al formulario. La dirección vuelve limpia de utm_ para
   *  que al reconstruirla no se peguen dos tandas de parámetros. */
  const editar = (i: number) => {
    const l = links[i]
    setDraft({ ...l, url: baseSinUtm(l.url) })
    setEditando(i)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelar = () => {
    setDraft(EMPTY_LINK)
    setEditando(null)
  }

  const copy = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(index)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Tu navegador no ha dejado copiar')
    }
  }

  const field = (key: keyof UtmLink, placeholder: string) => (
    <input
      value={draft[key]}
      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      placeholder={placeholder}
      className={INPUT}
    />
  )

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
          <Link2 size={16} className="text-[#025dc7]" />
          {editando === null ? 'Montar un enlace' : 'Editar el enlace'}
        </h3>
        <p className="text-[12.5px] text-[#9CA3AF] mt-0.5 mb-3">
          {editando === null
            ? 'Esto es un bloc de notas: guarda los enlaces montados para copiarlos cuando toque. La escuela no lee los UTM de nadie, así que no aparecerán en los números.'
            : 'Cambia lo que necesites y guarda. Se sustituye solo este enlace; el resto se queda como está.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {field('name', 'Nombre para acordarte (ej. Correo 1 lanzamiento)')}
          {field('url', 'https://www.holandesnawar.com/…')}
          {field('source', 'utm_source (ej. email, instagram)')}
          {field('medium', 'utm_medium (ej. newsletter, bio)')}
          {field('campaign', 'utm_campaign (ej. lanzamiento-sept)')}
          {field('content', 'utm_content (ej. boton-final)')}
        </div>

        {preview && (
          <div className="mt-3 rounded-xl bg-[#F0F5FF] px-3.5 py-3">
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">
              Queda así
            </p>
            <p className="text-[12.5px] text-[#0a1656] break-all">{preview}</p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={guardar} disabled={saving} className={BTN}>
            {editando === null ? <Plus size={15} /> : <Check size={15} />}
            {editando === null ? 'Guardar enlace' : 'Guardar cambios'}
          </button>
          {editando !== null && (
            <button
              onClick={cancelar}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-[#5A6480] hover:bg-[#F0F5FF] transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className={CARD}>
        <h3 className="text-[14px] font-bold text-gray-900 mb-3">Tus enlaces</h3>
        {links.length === 0 ? (
          <Empty>Todavía no has guardado ninguno.</Empty>
        ) : (
          <div className="space-y-2">
            {links.map((l, i) => (
              <div
                key={`${l.url}-${i}`}
                className={`rounded-xl border px-3.5 py-3 flex items-start gap-3 ${
                  editando === i ? 'border-[#4da3ff] bg-[#F0F5FF]' : 'border-[#E7EEF9]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-gray-900">
                    {l.name || l.campaign || 'Sin nombre'}
                  </p>
                  <p className="text-[12px] text-gray-500 break-all mt-0.5">{l.url}</p>
                </div>
                <button
                  onClick={() => copy(l.url, i)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12px] font-bold transition-colors"
                >
                  {copied === i ? <Check size={13} /> : <Copy size={13} />}
                  {copied === i ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  onClick={() => editar(i)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F0F5FF] hover:bg-[#e3edff] text-[#025dc7] text-[12px] font-bold transition-colors"
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  onClick={async () => {
                    if (await persist(links.filter((_, j) => j !== i))) {
                      // Los índices bailan al quitar una fila: si el que se
                      // estaba editando era ese, se sale; si estaba más abajo,
                      // se recoloca. Si no, "Guardar cambios" escribiría encima
                      // del enlace equivocado.
                      if (editando === i) cancelar()
                      else if (editando !== null && editando > i) setEditando(editando - 1)
                    }
                  }}
                  className="shrink-0 text-gray-300 hover:text-rose-500 transition-colors mt-1.5"
                  aria-label="Borrar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
