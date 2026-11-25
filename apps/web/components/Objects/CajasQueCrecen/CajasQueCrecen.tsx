'use client'
/**
 * Todas las cajas de escribir de la escuela crecen con el texto (25/11/2026:
 * «mismo fallo que arreglamos en mensajes… esto tiene que estar como en
 * mensajes en toda la escuela», visto en la corrección de una tarea).
 *
 * En vez de tocar las ochenta pantallas con caja de escribir una a una, esto
 * se monta una vez en el layout raíz y escucha a todo el documento:
 * - al escribir (`input`), al entrar en la caja (`focusin`, por si ya traía
 *   texto) y al aparecer una caja nueva con texto puesto;
 * - la caja mide lo que su texto, nunca menos de lo que medía al nacer (sus
 *   filas o su clase de alto: un cuadro grande sigue grande) y hasta el 60 %
 *   de la pantalla (560 px como mucho); pasado eso, scroll dentro.
 *
 * Se salta las cajas que ya crecen por su cuenta (`useCajaQueCrece`, marcan
 * `data-crece="propia"`) y las que no deben crecer (`data-no-crecer`: el texto
 * de la pizarra, que se coloca a mano).
 */
import { useEffect } from 'react'
import { altoDeCaja, topeDeCaja } from '@/lib/nawar/cajaQueCrece'

function ajustar(el: HTMLTextAreaElement) {
  if (el.dataset.crece === 'propia' || el.hasAttribute('data-no-crecer')) return
  if (!el.isConnected || el.offsetParent === null) return // escondida: no se puede medir
  if (!el.dataset.altoInicial) {
    el.dataset.altoInicial = String(el.getBoundingClientRect().height)
  }
  // Si la persona la estiró a mano con la esquina, se respeta como mínimo.
  const minimo = Math.max(Number(el.dataset.altoInicial) || 0, Number(el.dataset.altoMano) || 0)
  const borde = el.offsetHeight - el.clientHeight
  const antes = el.style.height
  el.style.height = 'auto'
  const contenido = el.scrollHeight + borde
  const { alto, scroll } = altoDeCaja(contenido, minimo, topeDeCaja(0.6, 560))
  el.style.height = `${alto}px`
  el.style.overflowY = scroll ? 'auto' : 'hidden'
  el.dataset.altoPuesto = String(alto)
  if (antes && antes !== el.style.height && document.activeElement === el) {
    // Que la línea que se escribe no se quede escondida bajo el borde.
    const r = el.getBoundingClientRect()
    if (r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest' })
  }
}

export default function CajasQueCrecen() {
  useEffect(() => {
    const esCaja = (t: EventTarget | null): t is HTMLTextAreaElement => t instanceof HTMLTextAreaElement
    const alEscribir = (e: Event) => { if (esCaja(e.target)) ajustar(e.target) }
    // La esquina de estirar: si la deja más alta de lo que la puso la escuela,
    // ese alto pasa a ser su mínimo.
    const alSoltar = (e: Event) => {
      const el = e.target
      if (!esCaja(el) || !el.dataset.altoPuesto) return
      const ahora = el.getBoundingClientRect().height
      if (Math.abs(ahora - Number(el.dataset.altoPuesto)) > 4) {
        el.dataset.altoMano = String(ahora)
        ajustar(el)
      }
    }
    document.addEventListener('input', alEscribir, true)
    document.addEventListener('focusin', alEscribir, true)
    document.addEventListener('mouseup', alSoltar, true)

    const nuevas = (raiz: ParentNode) => {
      raiz.querySelectorAll?.('textarea').forEach((el) => { if (el.value) ajustar(el) })
    }
    nuevas(document)
    const mo = new MutationObserver((cambios) => {
      for (const c of cambios) {
        c.addedNodes.forEach((n) => {
          if (n instanceof HTMLTextAreaElement) { if (n.value) ajustar(n) }
          else if (n instanceof HTMLElement) nuevas(n)
        })
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      document.removeEventListener('input', alEscribir, true)
      document.removeEventListener('focusin', alEscribir, true)
      document.removeEventListener('mouseup', alSoltar, true)
      mo.disconnect()
    }
  }, [])
  return null
}
