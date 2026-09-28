'use client'

/**
 * "¿Seguro?" dibujado por la propia escuela, en vez de `window.confirm`.
 *
 * ⚠️ Por qué (28/09): el usuario decía "no me deja eliminar nada". En el
 * ordenador de pruebas borraba bien; lo que falla es el diálogo del navegador,
 * que algunos navegadores de móvil —la escuela instalada como app, el navegador
 * de dentro de Instagram— bloquean o contestan "no" solos. Entonces el botón
 * de borrar parece muerto. Este se pinta en la página y funciona en todos.
 *
 *   if (!(await confirmar('¿Borrar esta tarea?'))) return
 */

import React from 'react'
import { createRoot } from 'react-dom/client'

type Opciones = { boton?: string; peligro?: boolean }

function Dialogo({ texto, boton, peligro, fin }: { texto: string; boton: string; peligro: boolean; fin: (ok: boolean) => void }) {
  React.useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fin(false)
      if (e.key === 'Enter') fin(true)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [fin])
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/40 p-3"
      onClick={() => fin(false)}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-[14.5px] text-gray-900 leading-relaxed whitespace-pre-line">{texto}</p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={() => fin(false)}
            className="rounded-lg border border-[#DDE6F5] px-4 py-2.5 text-[14px] font-semibold text-[#5A6480] hover:bg-[#F0F5FF]"
          >
            Cancelar
          </button>
          <button
            autoFocus
            onClick={() => fin(true)}
            className={`rounded-lg px-4 py-2.5 text-[14px] font-semibold ${
              peligro ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#4da3ff] text-[#0a1656] hover:bg-[#5eb4ff]'
            }`}
          >
            {boton}
          </button>
        </div>
      </div>
    </div>
  )
}

export function confirmar(texto: string, opciones: Opciones = {}): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false)
  return new Promise((resolver) => {
    const caja = document.createElement('div')
    document.body.appendChild(caja)
    const raiz = createRoot(caja)
    let hecho = false
    const fin = (ok: boolean) => {
      if (hecho) return
      hecho = true
      raiz.unmount()
      caja.remove()
      resolver(ok)
    }
    raiz.render(
      <Dialogo texto={texto} boton={opciones.boton ?? 'Sí, borrar'} peligro={opciones.peligro ?? true} fin={fin} />
    )
  })
}
