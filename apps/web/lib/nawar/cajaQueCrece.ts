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
    // Esta caja la lleva su pantalla: el ajuste de toda la escuela
    // (`CajasQueCrecen`) se la salta.
    if (ref.current) ref.current.dataset.crece = 'propia'
    ajustarCaja(ref.current, topeDeCaja(fraccion, maximo))
  }, [valor, fraccion, maximo])
}

/**
 * El alto que una caja tiene que tener con su texto, sin tocar nada: nunca
 * menos de lo que medía al empezar (`minimo`, sus filas o su clase de alto) ni
 * más del tope, salvo que ya naciera más alta. Pura, para el test.
 */
export function altoDeCaja(contenido: number, minimo: number, tope: number): { alto: number; scroll: boolean } {
  const techo = Math.max(tope, minimo)
  const alto = Math.max(minimo, Math.min(contenido, techo))
  return { alto, scroll: contenido > techo }
}
