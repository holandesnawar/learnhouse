'use client'

import React from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

/**
 * "¿Seguro?" con la cara de la escuela.
 *
 * Por qué no `window.confirm`: el navegador puede decidir no enseñarlo —en el
 * móvil, o si alguna vez se marcó "impedir que esta página muestre más
 * diálogos"— y entonces **devuelve «no» sin avisar**. Desde fuera se ve como
 * que pulsas Eliminar y no pasa absolutamente nada: ni borra, ni da error.
 * Este sale siempre, y de paso se parece al resto de la plataforma.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // Escape cierra, como cualquier ventana modal.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-modal-content, 220)' }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center">
            <AlertTriangle size={17} className="text-rose-600" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-gray-900">{title}</p>
            {description && (
              <p className="text-[13.5px] text-gray-600 mt-1 leading-relaxed">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-[14px] font-semibold text-[#5A6480] hover:text-[#1D0084] transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[14px] font-bold transition-colors disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
