import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { StickyNote, Trash2, X, Check } from 'lucide-react'
import {
  HIGHLIGHT_COLORS,
  type HighlightColor,
  type LessonHighlight,
  listHighlightsForActivity,
  createHighlight,
  updateHighlight,
  deleteHighlight,
} from '@services/student/highlights'
import {
  setLessonHighlights,
  type HLItem,
} from './LessonHighlightExtension'

type Props = {
  editor: any
  activity: any
}

const COLOR_ORDER: HighlightColor[] = ['yellow', 'pink', 'blue', 'green']

function courseUuidFromPath(pathname: string | null): string {
  if (!pathname) return ''
  const m = pathname.match(/course\/([0-9a-fA-F-]{8,})/)
  return m ? m[1] : ''
}

export default function HighlightLayer({ editor, activity }: Props) {
  const session = useLHSession() as any
  const accessToken: string | undefined = session?.data?.tokens?.access_token
  const pathname = usePathname()
  const activityUuid: string = activity?.activity_uuid || ''
  const activityName: string = activity?.name || ''
  const courseUuid = courseUuidFromPath(pathname)

  const [highlights, setHighlights] = useState<LessonHighlight[]>([])
  const [popup, setPopup] = useState<{ visible: boolean; top: number; left: number; from: number; to: number; quote: string }>({
    visible: false, top: 0, left: 0, from: 0, to: 0, quote: '',
  })
  const [composer, setComposer] = useState<{ open: boolean; from: number; to: number; quote: string; color: HighlightColor; note: string }>({
    open: false, from: 0, to: 0, quote: '', color: 'yellow', note: '',
  })
  const [viewer, setViewer] = useState<{ open: boolean; top: number; left: number; hl: LessonHighlight | null; noteDraft: string }>({
    open: false, top: 0, left: 0, hl: null, noteDraft: '',
  })

  const highlightsRef = useRef<LessonHighlight[]>([])
  highlightsRef.current = highlights

  // Push items into the editor decoration plugin whenever they change.
  const syncDecorations = useCallback((list: LessonHighlight[]) => {
    if (!editor) return
    const items: HLItem[] = list.map((h) => ({
      id: h.id,
      from: h.pm_from,
      to: h.pm_to,
      color: h.color,
      hasNote: !!(h.note && h.note.trim()),
    }))
    setLessonHighlights(editor, items)
  }, [editor])

  // Initial fetch.
  useEffect(() => {
    if (!accessToken || !activityUuid) return
    let active = true
    listHighlightsForActivity(activityUuid, accessToken).then((list) => {
      if (!active) return
      setHighlights(list)
    })
    return () => { active = false }
  }, [accessToken, activityUuid])

  // Re-paint whenever highlights or the editor change.
  useEffect(() => {
    if (editor) syncDecorations(highlights)
  }, [editor, highlights, syncDecorations])

  // Selection popup positioning.
  const updatePopup = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) { setPopup((p) => ({ ...p, visible: false })); return }
    const quote = editor.state.doc.textBetween(from, to, ' ')
    if (!quote || quote.trim().length === 0) { setPopup((p) => ({ ...p, visible: false })); return }
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.toString().trim().length === 0) {
      setPopup((p) => ({ ...p, visible: false })); return
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    const width = 196
    const top = rect.top + window.scrollY - 48
    const left = Math.max(10, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 10))
    setPopup({ visible: true, top: Math.max(10, top), left, from, to, quote })
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const onSel = () => requestAnimationFrame(updatePopup)
    const onScroll = () => setPopup((p) => (p.visible ? { ...p, visible: false } : p))
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Element
      if (!document.getElementById('nawar-hl-popup')?.contains(target)) {
        setPopup((p) => ({ ...p, visible: false }))
      }
    }
    // Click on an existing highlight or its note icon → open the viewer.
    const onDomClick = (e: MouseEvent) => {
      const el = (e.target as Element)?.closest?.('[data-hl-id]') as HTMLElement | null
      if (!el) return
      const id = parseInt(el.getAttribute('data-hl-id') || '', 10)
      if (!id) return
      const hl = highlightsRef.current.find((h) => h.id === id)
      if (!hl) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      setViewer({
        open: true,
        top: rect.bottom + window.scrollY + 6,
        left: Math.max(10, Math.min(rect.left + window.scrollX, window.innerWidth - 320)),
        hl,
        noteDraft: hl.note || '',
      })
    }
    editor.on('selectionUpdate', onSel)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('mousedown', onClickOutside)
    editor.view.dom.addEventListener('click', onDomClick)
    return () => {
      editor.off('selectionUpdate', onSel)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('mousedown', onClickOutside)
      editor.view.dom.removeEventListener('click', onDomClick)
    }
  }, [editor, updatePopup])

  const clearSelection = () => {
    try { window.getSelection()?.removeAllRanges() } catch {}
    setPopup((p) => ({ ...p, visible: false }))
  }

  const addHighlight = async (color: HighlightColor, from: number, to: number, quote: string, note = '') => {
    if (!accessToken) return
    // Optimistic temp item so the colour shows instantly.
    const created = await createHighlight(
      { activity_uuid: activityUuid, activity_name: activityName, course_uuid: courseUuid, color, quote, note, pm_from: from, pm_to: to },
      accessToken
    )
    if (created) setHighlights((prev) => [created, ...prev])
    clearSelection()
  }

  const onPickColor = (color: HighlightColor) => {
    addHighlight(color, popup.from, popup.to, popup.quote)
  }

  const onOpenComposer = () => {
    setComposer({ open: true, from: popup.from, to: popup.to, quote: popup.quote, color: 'yellow', note: '' })
    setPopup((p) => ({ ...p, visible: false }))
  }

  const saveComposer = async () => {
    await addHighlight(composer.color, composer.from, composer.to, composer.quote, composer.note.trim())
    setComposer((c) => ({ ...c, open: false }))
  }

  const saveViewerNote = async () => {
    if (!viewer.hl || !accessToken) return
    const updated = await updateHighlight(viewer.hl.id, { note: viewer.noteDraft.trim() }, accessToken)
    if (updated) setHighlights((prev) => prev.map((h) => (h.id === updated.id ? updated : h)))
    setViewer((v) => ({ ...v, open: false }))
  }

  const changeViewerColor = async (color: HighlightColor) => {
    if (!viewer.hl || !accessToken) return
    const updated = await updateHighlight(viewer.hl.id, { color }, accessToken)
    if (updated) {
      setHighlights((prev) => prev.map((h) => (h.id === updated.id ? updated : h)))
      setViewer((v) => ({ ...v, hl: updated }))
    }
  }

  const removeViewer = async () => {
    if (!viewer.hl || !accessToken) return
    const okDel = await deleteHighlight(viewer.hl.id, accessToken)
    if (okDel) setHighlights((prev) => prev.filter((h) => h.id !== viewer.hl!.id))
    setViewer((v) => ({ ...v, open: false }))
  }

  const mounted = typeof document !== 'undefined'
  if (!accessToken) return null

  return (
    <>
      <style>{`
        .nawar-hl-note-icon{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-right:3px;color:#025dc7;background:#F0F5FF;border:1px solid #DDE6F5;border-radius:5px;vertical-align:middle;cursor:pointer;transition:background .15s}
        .nawar-hl-note-icon:hover{background:#e0e9ff}
        .nawar-hl{transition:filter .15s}
        .nawar-hl:hover{filter:brightness(0.96)}
      `}</style>

      {/* Selection popup: colours + note */}
      {mounted && popup.visible && createPortal(
        <div
          id="nawar-hl-popup"
          className="absolute z-[9999] flex items-center gap-1.5 bg-white rounded-full shadow-lg border border-[#DDE6F5] px-2 py-1.5"
          style={{ top: popup.top, left: popup.left }}
        >
          {COLOR_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => onPickColor(c)}
              title={`Resaltar (${HIGHLIGHT_COLORS[c].label})`}
              className="w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform"
              style={{ backgroundColor: HIGHLIGHT_COLORS[c].bg }}
            />
          ))}
          <div className="w-px h-5 bg-[#DDE6F5] mx-0.5" />
          <button
            onClick={onOpenComposer}
            title="Resaltar y añadir nota"
            className="w-6 h-6 rounded-full flex items-center justify-center text-[#025dc7] hover:bg-[#F0F5FF] transition-colors"
          >
            <StickyNote size={15} />
          </button>
        </div>,
        document.body
      )}

      {/* Note composer modal */}
      {mounted && composer.open && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 p-4" onClick={() => setComposer((c) => ({ ...c, open: false }))}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#1D0084]" style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}>Añadir nota</h3>
              <button onClick={() => setComposer((c) => ({ ...c, open: false }))} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-[13px] text-gray-500 mb-1">Texto seleccionado</p>
            <p className="text-[13px] text-gray-800 bg-[#F0F5FF] rounded-lg px-3 py-2 mb-3 line-clamp-3 italic">“{composer.quote}”</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[13px] text-gray-500">Color:</span>
              {COLOR_ORDER.map((c) => (
                <button
                  key={c}
                  onClick={() => setComposer((s) => ({ ...s, color: c }))}
                  className={`w-6 h-6 rounded-full border transition-transform ${composer.color === c ? 'ring-2 ring-[#4da3ff] ring-offset-1 scale-110' : 'border-black/10'}`}
                  style={{ backgroundColor: HIGHLIGHT_COLORS[c].bg }}
                />
              ))}
            </div>
            <textarea
              autoFocus
              value={composer.note}
              onChange={(e) => setComposer((s) => ({ ...s, note: e.target.value }))}
              placeholder="Escribe tu nota aquí…"
              rows={4}
              className="w-full bg-[#F0F5FF] rounded-xl px-3 py-2.5 text-[14px] text-[#1D0084] placeholder:text-[#1D0084]/40 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/20 transition-colors resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setComposer((c) => ({ ...c, open: false }))} className="px-4 py-2 rounded-lg text-[14px] font-semibold text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={saveComposer} className="px-4 py-2 rounded-lg text-[14px] font-bold bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] inline-flex items-center gap-2"><Check size={15} strokeWidth={2.5} /> Guardar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Viewer popover for an existing highlight */}
      {mounted && viewer.open && viewer.hl && createPortal(
        <div className="fixed inset-0 z-[10000]" onClick={() => setViewer((v) => ({ ...v, open: false }))}>
          <div
            className="absolute bg-white rounded-2xl shadow-xl border border-[#DDE6F5] w-[300px] p-4"
            style={{ top: viewer.top, left: viewer.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#025dc7]">Tu nota</span>
              <button onClick={() => setViewer((v) => ({ ...v, open: false }))} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <p className="text-[12.5px] text-gray-700 bg-[#F0F5FF] rounded-lg px-2.5 py-1.5 mb-2.5 line-clamp-2 italic">“{viewer.hl.quote}”</p>
            <textarea
              value={viewer.noteDraft}
              onChange={(e) => setViewer((v) => ({ ...v, noteDraft: e.target.value }))}
              placeholder="Escribe una nota…"
              rows={3}
              className="w-full bg-[#F0F5FF] rounded-lg px-2.5 py-2 text-[13.5px] text-[#1D0084] placeholder:text-[#1D0084]/40 border border-transparent outline-none focus:bg-white focus:border-[#4da3ff] transition-colors resize-none"
            />
            <div className="flex items-center gap-1.5 mt-2.5">
              {COLOR_ORDER.map((c) => (
                <button
                  key={c}
                  onClick={() => changeViewerColor(c)}
                  className={`w-5 h-5 rounded-full border transition-transform ${viewer.hl!.color === c ? 'ring-2 ring-[#4da3ff] ring-offset-1' : 'border-black/10'}`}
                  style={{ backgroundColor: HIGHLIGHT_COLORS[c].bg }}
                />
              ))}
              <div className="flex-1" />
              <button onClick={removeViewer} title="Borrar" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></button>
              <button onClick={saveViewerNote} className="px-3 py-1.5 rounded-lg text-[13px] font-bold bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656]">Guardar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
