'use client'

import React from 'react'
import { RefreshCcw } from 'lucide-react'

/**
 * Corta el fuego alrededor de un trozo de pantalla.
 *
 * Sin esto, si UNA tarjeta del Inicio se rompe (un dato con una forma que no
 * esperábamos, un curso borrado a medias, una respuesta a medio desplegar),
 * React desmonta la página entera y el alumno se queda con la pantalla de
 * error — aunque el resto funcionara perfectamente.
 *
 * Con esto, esa tarjeta se sustituye por un aviso pequeño y todo lo demás
 * sigue en pie. El error se registra en la consola para poder mirarlo.
 *
 * Uso:
 *   <SafeArea nombre="Tu repaso de hoy"><RepasoCard … /></SafeArea>
 *
 * `fallback={null}` esconde el trozo del todo, para adornos que no merecen
 * ni un aviso.
 */
interface Props {
  children: React.ReactNode
  /** Qué es este trozo, para el aviso y para el log. */
  nombre?: string
  /** Qué pintar si falla. Por defecto, un aviso discreto. */
  fallback?: React.ReactNode
}

interface State {
  failed: boolean
}

export default class SafeArea extends React.Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[SafeArea] "${this.props.nombre ?? 'sección'}" falló:`, error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    if (this.props.fallback !== undefined) return this.props.fallback

    return (
      <div className="rounded-2xl border border-[#DDE6F5] bg-white p-5 text-center">
        <p className="text-[13px] text-[#5A6480]">
          Esta parte no se ha podido cargar
          {this.props.nombre ? ` (${this.props.nombre})` : ''}. El resto de la
          página funciona con normalidad.
        </p>
        <button
          onClick={() => this.setState({ failed: false })}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDE6F5] hover:border-[#4da3ff] text-[#025dc7] text-[12px] font-semibold transition-colors"
        >
          <RefreshCcw size={13} /> Reintentar
        </button>
      </div>
    )
  }
}
