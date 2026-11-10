'use client'
/**
 * La caja de escribir que crece con el texto (10/11/2026: «al ir escribiendo,
 * que la cajita se ponga más grande, como en redes sociales, hasta que llega
 * un punto en que toca hacer scroll»).
 *
 * La caja mide lo que mide su texto, de una línea hasta el tope (el 40 % de la
 * pantalla, entre 120 y 320 px; `tope` lo cambia). Pasado el tope, scroll
 * dentro. Al mandar el mensaje (el texto vuelve a vacío) se encoge sola.
 */
import { useEffect, useLayoutEffect, type RefObject } from 'react'

const useAlPintar = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function topeDeCaja(fraccion = 0.4, maximo = 320): number {
  if (typeof window === 'undefined') return maximo
  return Math.max(120, Math.min(Math.round(window.innerHeight * fraccion), maximo))
}

export function ajustarCaja(el: HTMLTextAreaElement | null, tope = topeDeCaja()) {
  if (!el) return
  el.style.height = 'auto'
  const alto = el.scrollHeight
  el.style.height = `${Math.min(alto, tope)}px`
  el.style.overflowY = alto > tope ? 'auto' : 'hidden'
}

export function useCajaQueCrece(ref: RefObject<HTMLTextAreaElement | null>, valor: string, fraccion = 0.4, maximo = 320) {
  useAlPintar(() => {
    ajustarCaja(ref.current, topeDeCaja(fraccion, maximo))
  }, [valor, fraccion, maximo])
}
