'use client'
import React, { useEffect, useState } from 'react'
import AvisosComposer from './AvisosComposer'
import EmailCatalog from './EmailCatalog'
import SeedCommunity from './SeedCommunity'
import RecordatorioAuto, { RecordatorioDelPlan } from './RecordatorioAuto'
import CorreoReserva from './CorreoReserva'
import EbookBlackFriday from './EbookBlackFriday'
import CorreosPanel from '../Panel/CorreosPanel'
import CabeceraPagina from '../Panel/Cabecera'
import { Mail, PenLine, Inbox, Sparkles, BellRing, CalendarCheck, BookOpen, Users } from 'lucide-react'

/**
 * La pantalla de Avisos tiene tres caras:
 *  - Escribir un aviso: el correo que redacta el equipo y sale cuando se pulsa.
 *  - Correos automáticos: los que la escuela manda sola, para verlos por dentro.
 *  - 1 semana sin entrar: el recordatorio que sale solo (con su interruptor,
 *    apagado de serie) y su texto, que se edita aquí.
 *  - Al reservar: el correo de Rida a quien reserva su llamada en Calendly.
 *  - Ebook Black Friday: el ebook a 1 €, su PDF y su campaña de correos.
 *  - Arranque: sembrar la comunidad antes de que entren los primeros alumnos.
 *  - Quién recibe qué (04/11/2026): lo que era Panel → Correos (quién está en
 *    cada campaña y a quién le llegó qué). Eran dos entradas en la barra para
 *    lo mismo, «Correos» y «Avisos y correos»; ahora es una, «Correos y avisos».
 */
export default function AvisosTabs() {
  const [tab, setTab] = useState<'escribir' | 'campana' | 'automaticos' | 'semana' | 'reserva' | 'ebook' | 'arranque'>('escribir')
  // Se puede entrar directo a una pestaña con ?tab= (tras pintar, para que el
  // servidor y el navegador empiecen igual).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'ebook' || t === 'reserva' || t === 'semana' || t === 'automaticos' || t === 'campana') setTab(t)
  }, [])

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-colors ${
      active
        ? 'bg-white text-[#1D0084] shadow-sm border border-[#DDE6F5]'
        : 'text-[#5A6480] hover:text-[#1D0084] border border-transparent'
    }`

  return (
    <div className="h-full w-full bg-[#F4F7FD] px-4 sm:px-9 py-6 sm:py-9 pb-24 lg:pb-10">
      <div className="mb-5">
        <CabeceraPagina
          icono={<Mail size={20} />}
          titulo="Correos y avisos"
          descripcion="Todo lo que la escuela manda por correo: los avisos a los alumnos, los automáticos y quién recibe cada campaña."
        />
      </div>

      <div className="inline-flex flex-wrap items-center gap-1 bg-[#E9EFFB] rounded-xl p-1 mb-7 max-w-full">
        <button className={tabClass(tab === 'escribir')} onClick={() => setTab('escribir')}>
          <PenLine size={16} />
          Escribir un aviso
        </button>
        <button className={tabClass(tab === 'campana')} onClick={() => setTab('campana')}>
          <Users size={16} />
          Quién recibe qué
        </button>
        <button className={tabClass(tab === 'automaticos')} onClick={() => setTab('automaticos')}>
          <Inbox size={16} />
          Correos automáticos
        </button>
        <button className={tabClass(tab === 'semana')} onClick={() => setTab('semana')}>
          <BellRing size={16} />
          1 semana sin entrar
        </button>
        <button className={tabClass(tab === 'reserva')} onClick={() => setTab('reserva')}>
          <CalendarCheck size={16} />
          Al reservar
        </button>
        <button className={tabClass(tab === 'ebook')} onClick={() => setTab('ebook')}>
          <BookOpen size={16} />
          Ebook Black Friday
        </button>
        <button className={tabClass(tab === 'arranque')} onClick={() => setTab('arranque')}>
          <Sparkles size={16} />
          Arranque
        </button>
      </div>

      {tab === 'escribir' ? (
        <AvisosComposer />
      ) : tab === 'campana' ? (
        <CorreosPanel />
      ) : tab === 'automaticos' ? (
        <EmailCatalog />
      ) : tab === 'semana' ? (
        <div className="space-y-4">
          <RecordatorioDelPlan />
          <RecordatorioAuto />
        </div>
      ) : tab === 'reserva' ? (
        <CorreoReserva />
      ) : tab === 'ebook' ? (
        <EbookBlackFriday />
      ) : (
        <SeedCommunity />
      )}
    </div>
  )
}
