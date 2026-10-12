'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Las páginas de un PDF pintadas por la escuela, una debajo de otra (12/10/2026).
 *
 * Antes la clase de PDF era un `<iframe>` con el PDF dentro, y lo que salía
 * era el visor del NAVEGADOR: en Chrome, una barra oscura con miniaturas y
 * zoom; en el iPhone, solo la primera página. Cada navegador lo pintaba a su
 * manera y ninguno se parecía a la escuela. Ahora pdf.js convierte cada
 * página en una imagen y se ven todas seguidas, en blanco, igual en todas
 * partes.
 *
 * - Las páginas se pintan cuando se acercan a la pantalla, de una en una:
 *   un cuaderno de 40 páginas no se dibuja entero al abrir la clase.
 * - Cada página acaba en una `<img>` y el lienzo se suelta. Un lienzo por
 *   página a tamaño de pantalla Retina se come la memoria del iPhone; una
 *   imagen, el navegador la descarta solo cuando no se ve.
 * - Si algo falla (un navegador muy viejo, un PDF raro), `alFallar` y la
 *   pantalla vuelve al visor del navegador, como antes. Nadie se queda sin el
 *   documento por esto.
 */

type Tam = { ancho: number; alto: number }

/** Ancho máximo en píxeles reales de cada página: nitidez sin reventar la memoria. */
const ANCHO_MAX_PX = 1800

export default function PaginasPdf({ url, alFallar }: { url: string; alFallar: () => void }) {
  const [paginas, setPaginas] = useState<Tam[] | null>(null)
  const docRef = useRef<any>(null)
  // Las páginas se pintan de una en una: pdf.js puede con varias a la vez,
  // pero el pico de memoria de varios lienzos juntos es lo que tumba un móvil.
  const colaRef = useRef<Promise<void>>(Promise.resolve())
  const alFallarRef = useRef(alFallar)
  alFallarRef.current = alFallar

  useEffect(() => {
    let vivo = true
    let worker: Worker | null = null
    let tarea: any = null
    setPaginas(null)
    ;(async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
        worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' })
        tarea = pdfjs.getDocument({ url, worker: new pdfjs.PDFWorker({ port: worker }) })
        const doc = await tarea.promise
        const tams: Tam[] = []
        for (let n = 1; n <= doc.numPages; n++) {
          const pagina = await doc.getPage(n)
          const v = pagina.getViewport({ scale: 1 })
          tams.push({ ancho: v.width, alto: v.height })
        }
        if (!vivo) return
        docRef.current = doc
        setPaginas(tams)
      } catch {
        if (vivo) alFallarRef.current()
      }
    })()
    return () => {
      vivo = false
      docRef.current = null
      Promise.resolve(tarea?.destroy()).finally(() => worker?.terminate())
    }
  }, [url])

  // Estable entre renders: si cambiara, cada página volvería a pintarse y
  // soltaría la imagen que está enseñando.
  const pintar = useCallback((numero: number, anchoCss: number): Promise<string | null> => {
    const turno = colaRef.current.then(async () => {
      const doc = docRef.current
      if (!doc) return null
      const pagina = await doc.getPage(numero)
      const base = pagina.getViewport({ scale: 1 })
      const densidad = Math.min(window.devicePixelRatio || 1, 2.5)
      const anchoPx = Math.min(ANCHO_MAX_PX, Math.max(600, Math.ceil(anchoCss * densidad)))
      const viewport = pagina.getViewport({ scale: anchoPx / base.width })
      const lienzo = document.createElement('canvas')
      lienzo.width = Math.floor(viewport.width)
      lienzo.height = Math.floor(viewport.height)
      const ctx = lienzo.getContext('2d')
      if (!ctx) return null
      await pagina.render({ canvas: lienzo, canvasContext: ctx, viewport }).promise
      const blob: Blob | null = await new Promise((ok) => lienzo.toBlob(ok, 'image/png'))
      lienzo.width = 0
      lienzo.height = 0
      pagina.cleanup()
      return blob ? URL.createObjectURL(blob) : null
    })
    colaRef.current = turno.then(
      () => undefined,
      () => undefined
    )
    return turno
  }, [])

  if (!paginas) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-full max-w-[820px] aspect-[1/1.414] rounded-md border border-[#DDE6F5] bg-white flex items-center justify-center">
          <p className="text-[13.5px] text-[#0a1656]/60 animate-pulse">Cargando el documento…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-5">
      {paginas.map((tam, i) => (
        <Pagina key={`${url}-${i}`} numero={i + 1} tam={tam} pintar={pintar} />
      ))}
    </div>
  )
}

function Pagina({
  numero,
  tam,
  pintar,
}: {
  numero: number
  tam: Tam
  pintar: (numero: number, anchoCss: number) => Promise<string | null>
}) {
  const caja = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const el = caja.current
    if (!el) return
    let vivo = true
    let hecha: string | null = null
    const obs = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return
        obs.disconnect()
        pintar(numero, el.clientWidth).then((u) => {
          if (!u) return
          if (vivo) {
            hecha = u
            setSrc(u)
          } else URL.revokeObjectURL(u)
        })
      },
      { rootMargin: '1200px 0px' }
    )
    obs.observe(el)
    return () => {
      vivo = false
      obs.disconnect()
      if (hecha) URL.revokeObjectURL(hecha)
    }
  }, [numero, pintar])

  return (
    <div
      ref={caja}
      className="relative w-full max-w-[820px] overflow-hidden rounded-md border border-[#DDE6F5] bg-white shadow-[0_1px_3px_rgba(16,24,64,0.06)]"
      style={{ aspectRatio: `${tam.ancho} / ${tam.alto}` }}
    >
      {src ? (
        <img src={src} alt={`Página ${numero}`} className="block h-full w-full" draggable={false} />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-[#F7F9FD]" />
      )}
    </div>
  )
}
