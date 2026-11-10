'use client'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Cuelga lo que lleva dentro del cuerpo de la página, por encima de todo.
 *
 * Para las pantallas que ocupan toda la ventana (la pizarra de clase, el
 * editor de recorte, un vídeo a pantalla completa): pintadas dentro del marco
 * de la escuela, la barra de arriba se les quedaba POR ENCIMA aunque llevaran
 * un `z-index` alto, porque el contenido de la escuela tiene su propia capa.
 * `confirmar()` y los avisos siguen quedando encima (z 1000).
 */
export default function EnElCuerpo({ children }: { children: React.ReactNode }) {
  const [listo, setListo] = useState(false)
  useEffect(() => setListo(true), [])
  if (!listo) return null
  return createPortal(<div className="relative z-[999]">{children}</div>, document.body)
}
