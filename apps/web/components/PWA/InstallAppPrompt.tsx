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

interface PasoProps {
  numero: number
  icono: React.ReactNode
  children: React.ReactNode
}

function Paso({ numero, icono, children }: PasoProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-3">
      <span className="relative shrink-0 w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-[#4da3ff]">
        {icono}
        <span className="absolute -top-1.5 -left-1.5 w-[18px] h-[18px] rounded-full bg-[#4da3ff] text-[#0a1656] text-[11px] font-bold flex items-center justify-center">
          {numero}
        </span>
      </span>
      <p className="text-[13.5px] leading-relaxed text-white/80 min-w-0">{children}</p>
    </div>
  )
}

export default function InstallAppPrompt() {
  const [visible, setVisible] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [dentroDeOtraApp, setDentroDeOtraApp] = useState(false)
  const [promptNativo, setPromptNativo] = useState<PromptDeInstalacion | null>(null)
  // Qué pasos se enseñan. Arranca en el móvil que se detecta, pero el alumno
  // puede cambiarlo: se detecta bien casi siempre, y cuando falla (un iPad que
  // se hace pasar por Mac, un navegador raro) sin las pestañas se quedaba
  // mirando instrucciones de otro teléfono sin manera de llegar a las suyas.
  const [pestana, setPestana] = useState<'ios' | 'android'>('ios')

  useEffect(() => {
    if (yaInstalada()) return

    const plat = detectarPlataforma()
    const incrustado = esNavegadorDeOtraApp()
    setPestana(plat === 'android' ? 'android' : 'ios')
    setDentroDeOtraApp(incrustado)

    // En escritorio solo se ofrece si el navegador dice que se puede instalar;
    // no tiene sentido explicarle a nadie cómo instalar algo que su navegador
    // no soporta. En móvil siempre hay un camino que enseñar.
    if (plat === 'ios' || plat === 'android') setVisible(true)

    const alPoderInstalar = (e: Event) => {
      // Sin esto Chrome enseña su propia barra; queremos el botón nuestro.
      e.preventDefault()
      setPromptNativo(e as PromptDeInstalacion)
      setVisible(true)
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
          {/* Oscuro, con el mismo lenguaje que la web y que esta misma pantalla
              de entrar: fondo #1D0084, glow azul arriba y la trama de puntos.
              Una tarjeta blanca aquí encendía media pantalla y parecía de otra
              casa. Los degradados van en `backgroundImage` y no en clases de
              Tailwind porque son tres capas apiladas con tamaños distintos. */}
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/12 p-5 sm:p-7 shadow-2xl max-h-full overflow-y-auto"
            style={{
              backgroundColor: '#1D0084',
              backgroundImage: [
                'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                'radial-gradient(circle 420px at 100% 0%, rgba(11,109,240,0.45) 0%, transparent 65%)',
                'radial-gradient(circle 360px at 0% 100%, rgba(11,109,240,0.20) 0%, transparent 65%)',
              ].join(','),
              backgroundSize: '28px 28px, auto, auto',
              backgroundRepeat: 'repeat, no-repeat, no-repeat',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Selector de móvil ENCIMA del título: sí se puede instalar en los
                dos, y los pasos no se parecen en nada. Arranca en el que se
                detecta, pero se puede cambiar — la detección acierta casi
                siempre y, cuando falla, sin esto el alumno se quedaba mirando
                las instrucciones de otro teléfono. */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div
                role="tablist"
                aria-label="Elige tu móvil"
                className="inline-flex p-1 rounded-xl bg-white/[0.07] border border-white/12"
              >
                {(['ios', 'android'] as const).map((clave) => (
                  <button
                    key={clave}
                    type="button"
                    role="tab"
                    aria-selected={pestana === clave}
                    onClick={() => setPestana(clave)}
                    className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                      pestana === clave
                        ? 'bg-[#4da3ff] text-[#0a1656]'
                        : 'text-white/60 hover:text-white/90'
                    }`}
                  >
                    {clave === 'ios' ? 'iPhone' : 'Android'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <h2
              id="titulo-instalar-app"
              className="text-[20px] sm:text-[24px] font-bold leading-tight"
              style={{
                fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.55) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Instala la escuela en tu {pestana === 'ios' ? 'iPhone' : 'Android'}
            </h2>

            <p className="text-[13.5px] leading-relaxed text-white/65 mt-1.5 mb-4">
              Se añade a tu pantalla de inicio como una app: se abre a pantalla
              completa y entras de un toque, sin escribir la dirección.
            </p>

            {/* El aviso de "estás dentro de otra app" NO va numerado: no es un
                paso de la instalación, es que ni siquiera puedes empezar. */}
            {dentroDeOtraApp && (
              <div className="flex items-start gap-3 rounded-xl border border-[#4da3ff]/35 bg-[#4da3ff]/10 px-3 py-3 mb-2.5">
                <ExternalLink size={17} strokeWidth={2.2} className="shrink-0 mt-0.5 text-[#4da3ff]" />
                <p className="text-[13.5px] leading-relaxed text-white/80 min-w-0">
                  Antes de nada: estás dentro de otra app. Toca el menú{' '}
                  <strong className="text-white">···</strong> y elige{' '}
                  <strong className="text-white">Abrir en el navegador</strong>. Desde ahí
                  sigue los pasos.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {pestana === 'ios' ? (
                <>
                  <Paso numero={1} icono={<Share size={17} strokeWidth={2.2} />}>
                    Toca el botón <strong className="text-white">Compartir</strong> en la barra de
                    abajo de Safari.
                  </Paso>
                  {/* El paso que todo el mundo se salta: en la lista de
                      Compartir hay que bajar y tocar "Ver más" ANTES de que
                      aparezca "Añadir a pantalla de inicio". Sin decirlo, el
                      alumno mira la lista, no lo ve y se rinde. */}
                  <Paso numero={2} icono={<Plus size={17} strokeWidth={2.2} />}>
                    Baja y toca <strong className="text-white">Ver más</strong>: ahí aparece{' '}
                    <strong className="text-white">Añadir a pantalla de inicio</strong>. Tócalo y
                    confirma.
                  </Paso>
                </>
              ) : (
                <>
                  <Paso numero={1} icono={<MoreVertical size={17} strokeWidth={2.2} />}>
                    Toca el menú <strong className="text-white">⋮</strong> arriba a la derecha de
                    Chrome.
                  </Paso>
                  <Paso numero={2} icono={<Smartphone size={17} strokeWidth={2.2} />}>
                    Elige <strong className="text-white">Instalar aplicación</strong> (o{' '}
                    <strong className="text-white">Añadir a pantalla de inicio</strong>) y confirma.
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
          </div>
        </div>
      )}
    </>
  )
}
