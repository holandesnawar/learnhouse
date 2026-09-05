'use client'

/**
 * "Instalar la app" — la escuela en la pantalla de inicio del móvil.
 *
 * No hay ninguna app nativa: la escuela es una web que, instalada, se abre a
 * pantalla completa, con su icono y sin la barra del navegador. Eso es todo lo
 * que hace este componente.
 *
 * Tres caminos, porque instalar no se pide igual en todas partes:
 *
 *   1. **Android / Chrome de escritorio** — el navegador avisa con el evento
 *      `beforeinstallprompt`. Se guarda y el botón abre el diálogo NATIVO. Es
 *      el único camino de un solo toque.
 *   2. **iPhone y iPad** — Safari no tiene ese evento ni piensa tenerlo: la
 *      instalación es a mano por Compartir → Añadir a pantalla de inicio. Lo
 *      único que se puede hacer es enseñar los dos pasos, que es justo lo que
 *      pidió el usuario.
 *   3. **Navegador dentro de otra app** (Instagram, Facebook, TikTok…) — ahí
 *      NO se puede instalar de ninguna manera, ni con evento ni a mano. Y es un
 *      caso real y frecuente aquí: buena parte del tráfico llega desde un DM de
 *      Instagram. Si no se detecta, el alumno sigue instrucciones que no puede
 *      completar porque su pantalla no tiene esos botones. Por eso el primer
 *      paso, en ese caso, es "abre esto en Safari/Chrome".
 *
 * El evento `beforeinstallprompt` puede dispararse antes de que React monte.
 * Se asume: Chrome lo lanza después del `load` y para entonces la página ya
 * está hidratada. Si algún día llegara antes, el usuario vería las
 * instrucciones manuales en vez del diálogo — se degrada, no se rompe.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Share, Plus, Smartphone, X, MoreVertical, ExternalLink, Download } from 'lucide-react'

type Plataforma = 'ios' | 'android' | 'escritorio'

interface PromptDeInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** ¿Ya está abierta como app instalada? Entonces no hay nada que ofrecer. */
function yaInstalada(): boolean {
  if (typeof window === 'undefined') return false
  const comoApp = window.matchMedia?.('(display-mode: standalone)')?.matches
  // Safari en iOS no implementa display-mode y usa su propia propiedad.
  const enIOS = (window.navigator as any).standalone === true
  return Boolean(comoApp || enIOS)
}

function detectarPlataforma(): Plataforma {
  if (typeof navigator === 'undefined') return 'escritorio'
  const ua = navigator.userAgent
  // El iPad con iPadOS 13+ se presenta como un Mac; se distingue porque el Mac
  // de verdad no tiene pantalla táctil.
  const iPadDisfrazado = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/i.test(ua) || iPadDisfrazado) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'escritorio'
}

/** Navegador incrustado dentro de otra app: ahí no se puede instalar. */
function esNavegadorDeOtraApp(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|Line\/|TikTok|Twitter|LinkedInApp|Snapchat|Pinterest/i.test(
    navigator.userAgent
  )
}

const CLAVE_DESCARTADO = 'nawar_instalar_app_descartado'

interface PasoProps {
  icono: React.ReactNode
  children: React.ReactNode
}

function Paso({ icono, children }: PasoProps) {
  return (
    <div className="flex items-center gap-3 bg-[#F0F5FF] rounded-xl px-3 py-3">
      <span className="shrink-0 w-9 h-9 rounded-lg bg-white flex items-center justify-center text-[#025dc7]">
        {icono}
      </span>
      <p className="text-[13.5px] leading-relaxed text-[#0a1656] min-w-0">{children}</p>
    </div>
  )
}

export default function InstallAppPrompt() {
  const [visible, setVisible] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [plataforma, setPlataforma] = useState<Plataforma>('escritorio')
  const [dentroDeOtraApp, setDentroDeOtraApp] = useState(false)
  const [promptNativo, setPromptNativo] = useState<PromptDeInstalacion | null>(null)

  useEffect(() => {
    if (yaInstalada()) return

    const plat = detectarPlataforma()
    const incrustado = esNavegadorDeOtraApp()
    setPlataforma(plat)
    setDentroDeOtraApp(incrustado)

    let descartado = false
    try {
      descartado = window.localStorage.getItem(CLAVE_DESCARTADO) === '1'
    } catch {
      // Navegación privada o cookies bloqueadas: se enseña igual, no pasa nada.
    }

    // En escritorio solo se ofrece si el navegador dice que se puede instalar;
    // no tiene sentido explicarle a nadie cómo instalar algo que su navegador
    // no soporta. En móvil siempre hay un camino que enseñar.
    if (!descartado && (plat === 'ios' || plat === 'android')) setVisible(true)

    const alPoderInstalar = (e: Event) => {
      // Sin esto Chrome enseña su propia barra; queremos el botón nuestro.
      e.preventDefault()
      setPromptNativo(e as PromptDeInstalacion)
      if (!descartado) setVisible(true)
    }
    const alInstalar = () => {
      setVisible(false)
      setAbierto(false)
    }

    window.addEventListener('beforeinstallprompt', alPoderInstalar)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [])

  const descartar = useCallback(() => {
    setAbierto(false)
    setVisible(false)
    try {
      window.localStorage.setItem(CLAVE_DESCARTADO, '1')
    } catch {
      /* sin almacenamiento: volverá a aparecer, que no es grave */
    }
  }, [])

  const instalarConDialogoNativo = useCallback(async () => {
    if (!promptNativo) return
    try {
      await promptNativo.prompt()
      await promptNativo.userChoice
    } catch {
      /* el diálogo solo se puede pedir una vez; si falla quedan los pasos */
    }
    // El prompt guardado ya no sirve una segunda vez.
    setPromptNativo(null)
    setAbierto(false)
  }, [promptNativo])

  const abrirModal = useCallback(() => {
    // Si el navegador nos deja instalar de verdad, el toque va directo al
    // diálogo nativo: abrir un popup para luego enseñar otro sería peor.
    if (promptNativo) {
      void instalarConDialogoNativo()
      return
    }
    setAbierto(true)
  }, [promptNativo, instalarConDialogoNativo])

  // Cerrar con Escape.
  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierto])

  if (!visible) return null

  return (
    <>
      <button
        type="button"
        onClick={abrirModal}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-3 text-[13.5px] font-semibold text-white/85 hover:text-white transition-colors"
      >
        <Download size={16} strokeWidth={2.2} />
        Instalar la escuela en tu móvil
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-3 py-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-instalar-app"
          onClick={() => setAbierto(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl p-5 sm:p-7 shadow-xl max-h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2
                id="titulo-instalar-app"
                className="text-[20px] sm:text-[24px] font-bold text-[#1D0084] leading-tight"
                style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
              >
                Instala la escuela en tu móvil
              </h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg text-[#1D0084]/50 hover:text-[#1D0084] hover:bg-[#F0F5FF] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-[13.5px] leading-relaxed text-[#0a1656]/75 mb-4">
              Se añade a tu pantalla de inicio como una app: se abre a pantalla
              completa y entras de un toque, sin escribir la dirección.
            </p>

            <div className="flex flex-col gap-2.5">
              {dentroDeOtraApp && (
                <Paso icono={<ExternalLink size={17} strokeWidth={2.2} />}>
                  Estás dentro de otra app. Toca el menú <strong>···</strong> y
                  elige <strong>Abrir en el navegador</strong>. Desde ahí sigue
                  los pasos de abajo.
                </Paso>
              )}

              {plataforma === 'ios' ? (
                <>
                  <Paso icono={<Share size={17} strokeWidth={2.2} />}>
                    Toca el botón <strong>Compartir</strong> en la barra de
                    abajo de Safari.
                  </Paso>
                  <Paso icono={<Plus size={17} strokeWidth={2.2} />}>
                    Elige <strong>Añadir a pantalla de inicio</strong> y
                    confirma.
                  </Paso>
                </>
              ) : (
                <>
                  <Paso icono={<MoreVertical size={17} strokeWidth={2.2} />}>
                    Toca el menú <strong>⋮</strong> arriba a la derecha de
                    Chrome.
                  </Paso>
                  <Paso icono={<Smartphone size={17} strokeWidth={2.2} />}>
                    Elige <strong>Instalar aplicación</strong> (o{' '}
                    <strong>Añadir a pantalla de inicio</strong>) y confirma.
                  </Paso>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="mt-5 w-full bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold py-3.5 rounded-xl text-[15px] transition-colors"
            >
              Entendido
            </button>

            <button
              type="button"
              onClick={descartar}
              className="mt-2 w-full text-[12.5px] text-[#0a1656]/50 hover:text-[#0a1656]/80 transition-colors py-1"
            >
              No volver a enseñarme esto
            </button>
          </div>
        </div>
      )}
    </>
  )
}
